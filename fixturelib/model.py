"""
Lumo fixture definition - the one format every source is converted to.

Open Fixture Library (JSON), GDTF (description.xml), QLC+ (.qxf) and the user's own
profiles all end up as a SpotlyFixtureDefinition. The DMX engine never sees these
formats: a chosen mode is turned into the engine's channel roles by ``to_engine_spec``.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class ChannelType(str, Enum):
    Unknown = "Unknown"
    Pan = "Pan"
    PanFine = "PanFine"
    Tilt = "Tilt"
    TiltFine = "TiltFine"
    PanTiltSpeed = "PanTiltSpeed"
    MasterDimmer = "MasterDimmer"
    Dimmer = "Dimmer"
    Red = "Red"
    Green = "Green"
    Blue = "Blue"
    White = "White"
    Amber = "Amber"
    UV = "UV"
    Cyan = "Cyan"
    Magenta = "Magenta"
    Yellow = "Yellow"
    ColorWheel = "ColorWheel"
    GoboWheel = "GoboWheel"
    GoboRotation = "GoboRotation"
    Prism = "Prism"
    PrismRotation = "PrismRotation"
    Focus = "Focus"
    Zoom = "Zoom"
    Iris = "Iris"
    Shutter = "Shutter"
    Strobe = "Strobe"
    LaserRed = "LaserRed"
    LaserGreen = "LaserGreen"
    LaserBlue = "LaserBlue"
    Macro = "Macro"
    AutoProgram = "AutoProgram"
    SoundProgram = "SoundProgram"
    Reset = "Reset"
    LampControl = "LampControl"
    MotorSpeed = "MotorSpeed"
    Other = "Other"


# channel types that must never get an automatic non-zero value (probing, disambiguation)
DANGEROUS = {ChannelType.Reset, ChannelType.LampControl, ChannelType.LaserRed, ChannelType.LaserGreen,
             ChannelType.LaserBlue}

# ChannelType -> role of the Lumo DMX engine (roles the engine does not drive stay 0 unless a
# control / the desk sets them through a per-channel value)
ROLE = {
    ChannelType.Pan: "pan", ChannelType.PanFine: "pan_fine", ChannelType.Tilt: "tilt", ChannelType.TiltFine: "tilt_fine",
    ChannelType.PanTiltSpeed: "speed", ChannelType.MotorSpeed: "speed",
    ChannelType.MasterDimmer: "dimmer", ChannelType.Dimmer: "dimmer",
    ChannelType.Red: "red", ChannelType.Green: "green", ChannelType.Blue: "blue", ChannelType.White: "white",
    ChannelType.Amber: "amber", ChannelType.UV: "uv", ChannelType.Cyan: "cyan", ChannelType.Magenta: "magenta",
    ChannelType.Yellow: "yellow", ChannelType.ColorWheel: "cwheel", ChannelType.GoboWheel: "gobo",
    ChannelType.GoboRotation: "gobo_rot", ChannelType.Prism: "prism", ChannelType.PrismRotation: "prism_rot",
    ChannelType.Focus: "focus", ChannelType.Zoom: "zoom", ChannelType.Iris: "iris",
    ChannelType.Shutter: "shutter", ChannelType.Strobe: "shutter",
    ChannelType.LaserRed: "laser_r", ChannelType.LaserGreen: "laser_g", ChannelType.LaserBlue: "laser_b",
    ChannelType.Macro: "macro", ChannelType.AutoProgram: "auto", ChannelType.SoundProgram: "sound",
    ChannelType.Reset: "reset", ChannelType.LampControl: "lamp", ChannelType.Other: "other", ChannelType.Unknown: "none",
}
# engine role -> ChannelType (profiles saved by Lumo, the old library)
FROM_ROLE = {
    "pan": ChannelType.Pan, "pan_fine": ChannelType.PanFine, "tilt": ChannelType.Tilt, "tilt_fine": ChannelType.TiltFine,
    "speed": ChannelType.PanTiltSpeed, "dimmer": ChannelType.Dimmer, "red": ChannelType.Red, "green": ChannelType.Green,
    "blue": ChannelType.Blue, "white": ChannelType.White, "amber": ChannelType.Amber, "uv": ChannelType.UV,
    "cyan": ChannelType.Cyan, "magenta": ChannelType.Magenta, "yellow": ChannelType.Yellow,
    "cwheel": ChannelType.ColorWheel, "gobo": ChannelType.GoboWheel, "gobo_rot": ChannelType.GoboRotation,
    "spin": ChannelType.GoboRotation, "prism": ChannelType.Prism, "prism_rot": ChannelType.PrismRotation,
    "focus": ChannelType.Focus, "zoom": ChannelType.Zoom, "iris": ChannelType.Iris,
    "shutter": ChannelType.Shutter, "strobe": ChannelType.Strobe, "laser_r": ChannelType.LaserRed,
    "laser_g": ChannelType.LaserGreen, "laser_b": ChannelType.LaserBlue, "laser": ChannelType.LaserRed,
    "macro": ChannelType.Macro, "auto": ChannelType.AutoProgram, "sound": ChannelType.SoundProgram,
    "reset": ChannelType.Reset, "lamp": ChannelType.LampControl, "beam": ChannelType.Other, "strip": ChannelType.Macro,
    "strip_speed": ChannelType.MotorSpeed, "aux1": ChannelType.Strobe, "aux2": ChannelType.Strobe,
    "other": ChannelType.Other, "none": ChannelType.Unknown,
}

CATEGORIES = ("moving_head", "par", "bar", "derby", "strobe", "laser", "smoke", "spider", "other")


@dataclass
class Capability:
    min: int
    max: int
    name: str
    semantic: str = ""            # open | closed | strobe | color | gobo | rotation | sound | auto | reset | prism | nofunction ...
    color: str | None = None      # "#rrggbb" for colour wheel slots / colour macros

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v not in (None, "")}


@dataclass
class Channel:
    offset: int                   # 0-based inside the mode
    name: str
    type: ChannelType = ChannelType.Unknown
    fine: bool = False
    default: int = 0
    highlight: int | None = None
    capabilities: list[Capability] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = {"offset": self.offset, "name": self.name, "type": self.type.value, "default": self.default}
        if self.fine:
            d["fine"] = True
        if self.highlight is not None:
            d["highlight"] = self.highlight
        if self.capabilities:
            d["capabilities"] = [c.to_dict() for c in self.capabilities]
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Channel":
        try:
            ct = ChannelType(d.get("type", "Unknown"))
        except ValueError:
            ct = ChannelType.Unknown
        caps = [Capability(int(c.get("min", 0)), int(c.get("max", 255)), str(c.get("name", "")), c.get("semantic", ""),
                           c.get("color")) for c in d.get("capabilities") or []]
        return cls(int(d.get("offset", 0)), str(d.get("name", "")), ct, bool(d.get("fine")), int(d.get("default", 0) or 0),
                   d.get("highlight"), caps)


@dataclass
class Mode:
    name: str
    channels: list[Channel]

    @property
    def count(self) -> int:
        return len(self.channels)

    def types(self) -> list[ChannelType]:
        return [c.type for c in self.channels]

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "count": self.count, "channels": [c.to_dict() for c in self.channels]}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Mode":
        chans = [Channel.from_dict(c) for c in d.get("channels") or []]
        for i, c in enumerate(chans):
            c.offset = i
        return cls(str(d.get("name") or f"{len(chans)}CH"), chans)


@dataclass
class SpotlyFixtureDefinition:
    id: str                       # "<source>:<key>", unique across sources
    manufacturer: str
    model: str
    category: str = "other"
    modes: list[Mode] = field(default_factory=list)
    aliases: list[str] = field(default_factory=list)
    source: str = "spotly"        # rdm | mine | spotly | ofl | gdtf | qlc | calibration | manual
    source_version: str = ""
    source_url: str = ""
    confidence: float = 1.0
    physical: dict[str, Any] = field(default_factory=dict)       # pan_deg, tilt_deg, beam_deg, weight, power
    rdm: dict[str, int] | None = None                             # {"manufacturer_id": .., "model_id": ..}

    def mode(self, name_or_count: str | int | None = None) -> Mode | None:
        if not self.modes:
            return None
        if name_or_count is None:
            return self.modes[0]
        for m in self.modes:
            if m.name == name_or_count or (isinstance(name_or_count, int) and m.count == name_or_count):
                return m
        if isinstance(name_or_count, str) and name_or_count.rstrip("CHch").isdigit():
            return self.mode(int(name_or_count.rstrip("CHch")))
        return None

    def to_dict(self) -> dict[str, Any]:
        d = {"id": self.id, "manufacturer": self.manufacturer, "model": self.model, "category": self.category,
             "modes": [m.to_dict() for m in self.modes], "aliases": self.aliases, "source": self.source,
             "source_version": self.source_version, "source_url": self.source_url,
             "confidence": round(self.confidence, 3), "physical": self.physical}
        if self.rdm:
            d["rdm"] = self.rdm
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "SpotlyFixtureDefinition":
        return cls(str(d["id"]), str(d.get("manufacturer", "")), str(d.get("model", "")), d.get("category", "other"),
                   [Mode.from_dict(m) for m in d.get("modes") or []], list(d.get("aliases") or []),
                   d.get("source", "mine"), d.get("source_version", ""), d.get("source_url", ""),
                   float(d.get("confidence", 1.0)), dict(d.get("physical") or {}), d.get("rdm"))

    def summary(self) -> dict[str, Any]:
        """Small record for search results and the offline index."""
        return {"id": self.id, "manufacturer": self.manufacturer, "model": self.model, "category": self.category,
                "modes": [[m.name, m.count] for m in self.modes], "aliases": self.aliases, "source": self.source,
                "source_url": self.source_url, "types": [[c.type.value for c in m.channels] for m in self.modes]}

    @classmethod
    def from_summary(cls, e: dict[str, Any]) -> "SpotlyFixtureDefinition":
        """Light definition from an index record (channel types only) - enough for matching."""
        modes = []
        for (name, _n), types in zip(e.get("modes") or [], e.get("types") or []):
            modes.append(Mode(name, [Channel(i, t, ChannelType(t) if t in ChannelType._value2member_map_ else ChannelType.Unknown)
                                     for i, t in enumerate(types)]))
        return cls(e["id"], e.get("manufacturer", ""), e.get("model", ""), e.get("category", "other"), modes,
                   list(e.get("aliases") or []), e.get("source", ""))


# --------------------------------------------------------------------------- engine bridge
def _range(caps: list[Capability], *semantics: str) -> Capability | None:
    return next((c for c in caps if c.semantic in semantics), None)


def to_engine_spec(defn: SpotlyFixtureDefinition, mode: Mode) -> dict[str, Any]:
    """Keyword arguments for DMXEngine.add_fixture: roles per channel + what the capabilities tell."""
    roles = [ROLE.get(c.type, "none") for c in mode.channels]
    # a role the engine drives (pan, speed, colour wheel …) only on its first channel: a second "Pan continuous
    # rotation" or "Chase speed" must not get the pan / speed value. LED segments (RGBW ×4) keep their colour.
    seen: set[str] = set()
    for i, r in enumerate(roles):
        if r in seen and r not in ("red", "green", "blue", "white", "dimmer", "shutter", "none", "other", "reset", "lamp"):
            roles[i] = "other"
        seen.add(r)
    spec: dict[str, Any] = {
        "name": defn.model[:24], "model": f"{defn.manufacturer} {defn.model}".strip() if defn.manufacturer not in ("", "Generic") else defn.model,
        "type": defn.category if defn.category in ("moving_head", "bar", "derby", "par", "strobe", "laser", "smoke") else
        ("derby" if defn.category == "spider" else "par"),
        "library_key": defn.id, "channels": roles,
        "pan_16bit": "pan_fine" in roles, "tilt_16bit": "tilt_fine" in roles,
        "has_rgb": any(r in roles for r in ("red", "green", "blue")),
    }
    ph = defn.physical or {}
    for k in ("pan_deg", "tilt_deg", "beam_deg"):
        if ph.get(k):
            spec[k] = float(ph[k])
    if defn.category == "spider" or (spec["type"] == "derby" and "tilt" in roles and "pan" not in roles):
        spec.setdefault("tilt_deg", 180.0)
    caps: dict[str, list] = {}
    defaults: dict[int, int] = {}
    for c in mode.channels:
        if c.capabilities:
            caps[str(c.offset)] = [[x.min, x.max, x.name, x.semantic, x.color] for x in c.capabilities]
        if c.type in (ChannelType.Shutter, ChannelType.Strobe) and c.capabilities:
            op = _range(c.capabilities, "open")
            st = [x for x in c.capabilities if x.semantic == "strobe"]
            if op:
                spec["shutter_open"] = (op.min + op.max) // 2
            if st:
                spec["strobe_min"], spec["strobe_max"] = st[0].min, st[-1].max
        if c.type == ChannelType.ColorWheel and c.capabilities:
            slots = [[(x.min + x.max) // 2, _hex(x.color), x.name] for x in c.capabilities if x.semantic == "color" and x.color]
            if slots:
                spec["wheel"] = slots
        if c.type == ChannelType.GoboWheel and c.capabilities:
            g = [[(x.min + x.max) // 2, x.name] for x in c.capabilities if x.semantic == "gobo"]
            if g:
                spec["gobos"] = g
        if c.default and c.type not in DANGEROUS and ROLE.get(c.type) in ("none", "other", "macro", "auto", "sound",
                                                                        "prism", "zoom", "focus", "iris", "amber", "uv"):
            defaults[c.offset] = c.default
    spec["caps"] = caps
    spec["defaults"] = defaults
    return spec


def _hex(h: str | None) -> list[int]:
    h = (h or "#ffffff").lstrip("#")
    try:
        return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    except ValueError:
        return [255, 255, 255]
