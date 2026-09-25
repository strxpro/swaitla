"""
dmxdoctor.py
============
One click "check the cable and the lamps, repair what can be repaired".

Every check returns {id, state, key, params, fix}:
  state  ok | fixed | warn | err
  key    text key translated in the browser (dd.<id>.<state>)
  fix    a command the user can click when Lumo cannot repair it alone
The lamp list tells what to set on each lamp's own display (address, mode, channels).
"""

from __future__ import annotations

import logging
import subprocess
import time
from typing import Any

import dmx_controller as dc

log = logging.getLogger("doctor")


def _item(cid: str, state: str, fix: dict | None = None, **params: Any) -> dict[str, Any]:
    return {"id": cid, "state": state, "key": f"dd.{cid}.{state}", "params": params, "fix": fix}


def kill_rivals() -> None:
    """Close the other light programs (only after the user clicked it)."""
    from devices import RIVALS
    for exe, _label in RIVALS:
        subprocess.run(["taskkill", "/IM", exe, "/F"], capture_output=True, creationflags=0x08000000)


def run(rig: Any, fix: bool = True) -> dict[str, Any]:
    eng = rig.engine
    out: list[dict[str, Any]] = []
    ftdi = dc.d2xx_devices()
    rivals = list(dict.fromkeys(getattr(rig.devices, "rivals", []) or []))

    # 1. is the cable plugged in at all?
    ports = dc.list_serial_ports()
    ftdi_ports = [p for p in ports if p.get("vid") == 0x0403]
    if ftdi:
        d = ftdi[0]
        out.append(_item("cable", "ok", name=d["description"] or "FTDI", serial=d["serial"] or "?"))
    elif ftdi_ports:
        out.append(_item("cable", "warn", name=ftdi_ports[0]["description"], port=ftdi_ports[0]["device"]))
    else:
        out.append(_item("cable", "err"))

    # 2. another program holds the cable?
    if rivals:
        out.append(_item("rival", "err", {"type": "kill_rival"}, names=", ".join(rivals)))
    else:
        out.append(_item("rival", "ok"))

    # 3. the cable given away earlier ("Oddaj kabel") -> take it back
    if eng.released:
        if fix and not rivals:
            eng.take_output()
            out.append(_item("released", "fixed" if eng.output.ok else "err", {"type": "dmx_take"}))
        else:
            out.append(_item("released", "warn", {"type": "dmx_take"}))

    # 4. FTDI cable must be driven as Open DMX (like QLC+ does), not ENTTEC Pro / Art-Net / simulation
    cfg_backend = dc.DMX_BACKEND if dc.ENABLE_PHYSICAL_DMX else "sim"
    if (ftdi or ftdi_ports) and cfg_backend != "opendmx" and not eng.released:
        if fix and not rivals:
            eng.reconfigure_output("opendmx", ftdi_ports[0]["device"] if ftdi_ports else None)
            out.append(_item("mode", "fixed", was=cfg_backend))
        else:
            out.append(_item("mode", "warn", {"type": "dmx_output", "backend": "opendmx"}, was=cfg_backend))
    else:
        out.append(_item("mode", "ok", was=cfg_backend))

    # 5. connection open? try to reconnect once, then report
    if not eng.output.ok and not eng.released and (ftdi or ftdi_ports):
        if fix and not rivals:
            eng.reconfigure_output("opendmx")
        if eng.output.ok:
            out.append(_item("link", "fixed"))
        else:
            why = eng.output.status
            busy = any(d.get("busy") for d in ftdi) or "zajęty" in why or "Odmowa" in why or "denied" in why.lower()
            out.append(_item("busy" if busy else "link", "err", {"type": "kill_rival"} if busy else {"type": "dmx_take"}, why=why))
    elif eng.output.ok:
        out.append(_item("link", "ok", status=eng.output.label))

    # 6. data really leaves the chip (driver queue drains, steady frame rate)
    o = eng.output
    if eng.output.ok and hasattr(o, "tx_queue"):
        qs = []
        for _ in range(6):
            qs.append(o.tx_queue())
            time.sleep(0.05)
        hz = eng.send_hz
        if max(qs) > 2048 or hz < 15:
            out.append(_item("send", "err", {"type": "dmx_take"}, hz=round(hz), queue=max(qs)))
        else:
            out.append(_item("send", "ok", hz=round(hz)))
    elif eng.output.ok:
        out.append(_item("send", "ok", hz=round(eng.send_hz)))

    # 7. full 512-channel frames (like QLC+) - short frames confuse some lamps
    if eng.short_frames:
        if fix:
            eng.short_frames = False
            out.append(_item("frames", "fixed"))
        else:
            out.append(_item("frames", "warn", {"type": "short_frames", "value": False}))
    else:
        out.append(_item("frames", "ok"))

    # 8. lamps on the stage, nothing forcing them dark
    lamps = [f for f in eng.fixtures.values() if f.type not in ("smoke", "laser")]
    if not eng.fixtures:
        out.append(_item("lamps", "err", {"type": "open_setup", "pane": "lamps"}))
    else:
        out.append(_item("lamps", "ok", n=len(eng.fixtures)))
    if eng.blackout:
        if fix:
            eng.blackout = False
            out.append(_item("blackout", "fixed"))
        else:
            out.append(_item("blackout", "warn", {"type": "blackout", "value": False}))
    if eng.grand_master < 20:
        if fix:
            eng.grand_master = 255
            out.append(_item("master", "fixed"))
        else:
            out.append(_item("master", "warn", {"type": "grand_master", "value": 255}))
    if lamps and all(f.target.get("dimmer", 0) < 5 and not f.overrides for f in lamps):
        out.append(_item("dark", "warn", {"type": "doctor_light"}))
    conflicts = eng.address_conflicts()
    if conflicts:
        out.append(_item("overlap", "err", {"type": "open_setup", "pane": "lamps"}, list="; ".join(conflicts)))

    # what to set on every lamp's own menu
    lamp_help = []
    for f in sorted(eng.fixtures.values(), key=lambda x: x.address):
        lamp_help.append({"id": f.id, "name": f.name, "model": f.model, "address": f.address,
                          "channels": f.footprint, "end": f.address + f.footprint - 1,
                          "code": f"A{f.address:03d}", "code2": f"d{f.address:03d}"})
    worst = "err" if any(i["state"] == "err" for i in out) else "warn" if any(i["state"] == "warn" for i in out) else "ok"
    log.info("DMX doctor: %s", ", ".join(f"{i['id']}={i['state']}" for i in out))
    return {"checks": out, "lamps": lamp_help, "result": worst,
            "fixed": sum(1 for i in out if i["state"] == "fixed")}
