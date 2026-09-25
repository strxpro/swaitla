"""
RDM (ANSI E1.20) - architecture for automatic device detection.

RDM needs BOTH a two-way interface (the adapter must switch its RS-485 driver to receive
and read the lamp's answer) AND a lamp that speaks RDM. A plain one-way "Open DMX" FTDI
cable (DoReMiDi, Eurolite USB-DMX512, most AliExpress cables) cannot receive, so Lumo
does not pretend: ``controller_for(output)`` returns None and the UI says why.

What is here:
  * UID, packet builder and parser (checksum, GET requests, DEVICE_INFO / labels decoding)
  * RdmDevice - what discovery found
  * RdmController - interface a two-way backend implements (discover(), get(uid, pid))
  * discover_and_describe() - runs discovery and reads every field Lumo shows
"""

from __future__ import annotations

import struct
from dataclasses import asdict, dataclass, field
from typing import Any, Protocol

SC_RDM, SC_SUB_MESSAGE = 0xCC, 0x01
GET_COMMAND, GET_COMMAND_RESPONSE = 0x20, 0x21
DISCOVERY_COMMAND = 0x10
PID = {
    "DISC_UNIQUE_BRANCH": 0x0001, "DISC_MUTE": 0x0002, "DISC_UN_MUTE": 0x0003,
    "DEVICE_INFO": 0x0060, "DEVICE_MODEL_DESCRIPTION": 0x0080, "MANUFACTURER_LABEL": 0x0081,
    "DEVICE_LABEL": 0x0082, "SOFTWARE_VERSION_LABEL": 0x00C0, "DMX_PERSONALITY": 0x00E0,
    "DMX_PERSONALITY_DESCRIPTION": 0x00E1, "DMX_START_ADDRESS": 0x00F0,
}
CONTROLLER_UID = (0x7FF0, 0x00000001)          # prototype / experimental manufacturer range


@dataclass(frozen=True)
class Uid:
    manufacturer: int
    device: int

    def __str__(self) -> str:
        return f"{self.manufacturer:04X}:{self.device:08X}"

    def pack(self) -> bytes:
        return struct.pack(">HI", self.manufacturer, self.device)

    @classmethod
    def unpack(cls, b: bytes) -> "Uid":
        m, d = struct.unpack(">HI", b[:6])
        return cls(m, d)


BROADCAST = Uid(0xFFFF, 0xFFFFFFFF)


def checksum(b: bytes) -> int:
    return sum(b) & 0xFFFF


def build_request(dest: Uid, cc: int, pid: int, data: bytes = b"", tn: int = 0, sub: int = 0,
                  src: Uid = Uid(*CONTROLLER_UID)) -> bytes:
    """RDM packet from the start code to the checksum."""
    length = 24 + len(data)
    body = bytes([SC_RDM, SC_SUB_MESSAGE, length]) + dest.pack() + src.pack() + bytes([tn & 0xFF, 1, 0]) \
        + struct.pack(">H", sub) + bytes([cc]) + struct.pack(">H", pid) + bytes([len(data)]) + data
    return body + struct.pack(">H", checksum(body))


@dataclass
class RdmResponse:
    src: Uid
    dest: Uid
    cc: int
    pid: int
    response_type: int
    data: bytes


def parse_response(pkt: bytes) -> RdmResponse:
    if len(pkt) < 26 or pkt[0] != SC_RDM or pkt[1] != SC_SUB_MESSAGE:
        raise ValueError("to nie jest odpowiedź RDM")
    length = pkt[2]
    if len(pkt) < length + 2 or struct.unpack(">H", pkt[length:length + 2])[0] != checksum(pkt[:length]):
        raise ValueError("zła suma kontrolna RDM")
    dest, src = Uid.unpack(pkt[3:9]), Uid.unpack(pkt[9:15])
    rtype = pkt[16]
    cc, pid, pdl = pkt[20], struct.unpack(">H", pkt[21:23])[0], pkt[23]
    return RdmResponse(src, dest, cc, pid, rtype, bytes(pkt[24:24 + pdl]))


def decode_device_info(d: bytes) -> dict[str, int]:
    """DEVICE_INFO (E1.20 table 10-4), 19 bytes."""
    if len(d) < 19:
        raise ValueError("DEVICE_INFO za krótkie")
    (proto, model, category, sw, footprint, pers_cur, pers_cnt, start, subdev, sensors) = struct.unpack(">HHHIHBBHHB", d[:19])
    return {"protocol": proto, "model_id": model, "product_category": category, "software_version": sw,
            "footprint": footprint, "personality": pers_cur, "personality_count": pers_cnt,
            "start_address": start, "sub_devices": subdev, "sensors": sensors}


def decode_label(d: bytes) -> str:
    return d.split(b"\x00", 1)[0].decode("ascii", "replace").strip()


@dataclass
class RdmDevice:
    uid: str
    manufacturer_id: int
    model_id: int | None = None
    manufacturer_label: str = ""
    model_description: str = ""
    device_label: str = ""
    start_address: int | None = None
    personality: int | None = None
    personality_count: int | None = None
    footprint: int | None = None
    software_version: str = ""
    personalities: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class RdmController(Protocol):
    """A two-way DMX interface that can talk RDM (e.g. ENTTEC DMX USB Pro with RDM firmware, Art-Net RDM node)."""
    name: str

    def discover(self) -> list[Uid]: ...
    def get(self, uid: Uid, pid: int, data: bytes = b"") -> RdmResponse | None: ...


def controller_for(output: Any) -> RdmController | None:
    """The RDM side of the current DMX output, or None when it is one-way."""
    return getattr(output, "rdm", None)


def why_unavailable(output: Any) -> str:
    name = getattr(output, "name", "")
    if name == "opendmx":
        return "opendmx"          # FTDI Open DMX cable: transmit only
    if name in ("simulation", "released", ""):
        return "nocable"
    return "backend"               # ENTTEC Pro / Art-Net / uDMX backends in Lumo do not read RDM (yet)


def discover_and_describe(ctl: RdmController) -> list[RdmDevice]:
    out = []
    for uid in ctl.discover():
        dev = RdmDevice(str(uid), uid.manufacturer)
        r = ctl.get(uid, PID["DEVICE_INFO"])
        if r:
            info = decode_device_info(r.data)
            dev.model_id, dev.start_address = info["model_id"], info["start_address"]
            dev.personality, dev.personality_count, dev.footprint = info["personality"], info["personality_count"], info["footprint"]
        for pid, attr in (("MANUFACTURER_LABEL", "manufacturer_label"), ("DEVICE_MODEL_DESCRIPTION", "model_description"),
                          ("DEVICE_LABEL", "device_label"), ("SOFTWARE_VERSION_LABEL", "software_version")):
            r = ctl.get(uid, PID[pid])
            if r:
                setattr(dev, attr, decode_label(r.data))
        for p in range(1, (dev.personality_count or 0) + 1):
            r = ctl.get(uid, PID["DMX_PERSONALITY_DESCRIPTION"], bytes([p]))
            if r and len(r.data) >= 3:
                dev.personalities.append({"n": r.data[0], "footprint": struct.unpack(">H", r.data[1:3])[0],
                                          "name": decode_label(r.data[3:])})
        out.append(dev)
    return out
