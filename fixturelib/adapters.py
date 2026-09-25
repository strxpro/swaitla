"""
Adapters: OFL JSON, QLC+ QXF, GDTF description.xml and the old Lumo library -> SpotlyFixtureDefinition.

Each adapter only reads its own format; nothing outside this file knows those formats.
"""

from __future__ import annotations

import io
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Any

from .model import Capability, Channel, ChannelType as CT, FROM_ROLE, Mode, SpotlyFixtureDefinition

COLOR_WORDS = {
    "red": "#ff0000", "czerwony": "#ff0000", "green": "#00ff00", "zielony": "#00ff00", "blue": "#0000ff", "niebieski": "#0000ff",
    "white": "#ffffff", "biały": "#ffffff", "open": "#ffffff", "yellow": "#ffff00", "żółty": "#ffff00", "orange": "#ff8000",
    "amber": "#ffbf00", "magenta": "#ff00ff", "pink": "#ff66cc", "purple": "#8000ff", "violet": "#8000ff", "cyan": "#00ffff",
    "light blue": "#66ccff", "light green": "#66ff66", "uv": "#6600ff", "deep red": "#b00000", "dark blue": "#0000a0",
}


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _category(words: str) -> str:
    w = words.lower()
    for key, cat in (("laser", "laser"), ("smoke", "smoke"), ("fog", "smoke"), ("haze", "smoke"), ("spider", "spider"),
                     ("moving head", "moving_head"), ("scanner", "moving_head"), ("barrel", "moving_head"),
                     ("strobe", "strobe"), ("blinder", "par"), ("bar", "bar"), ("flower", "derby"), ("effect", "derby"),
                     ("derby", "derby"), ("color changer", "par"), ("colour changer", "par"), ("par", "par"),
                     ("dimmer", "par"), ("matrix", "bar"), ("pixel", "bar")):
        if key in w:
            return cat
    return "other"


def _color_for(name: str) -> str | None:
    n = name.lower()
    for word in sorted(COLOR_WORDS, key=len, reverse=True):
        if word in n:
            return COLOR_WORDS[word]
    return None


def _semantic(name: str) -> str:
    """Meaning of a capability range from its name (used when the source has no typed capability)."""
    n = name.lower()
    if re.search(r"no function|nothing|unused|brak|n/?a\b", n):
        return "nofunction"
    if "reset" in n:
        return "reset"
    if re.search(r"sound|music|audio|dźwięk", n):
        return "sound"
    if re.search(r"auto|program|macro|show|chase", n):
        return "auto"
    if re.search(r"strob|flash", n):
        return "strobe"
    if re.search(r"\bopen\b|shutter open|on\b|otwart", n):
        return "open"
    if re.search(r"closed|blackout|\boff\b", n):
        return "closed"
    if re.search(r"rotat|spin|scroll|rainbow|obr", n):
        return "rotation"
    if "prism" in n:
        return "prism"
    if "gobo" in n:
        return "gobo"
    if _color_for(n):
        return "color"
    return ""


# =============================================================================
# QLC+ (.qxf)
# =============================================================================
class QlcFixtureAdapter:
    """QLC+ fixture definitions (QLC+ 4.x and 5.x, with and without channel presets)."""
    PRESET = {
        "IntensityMasterDimmer": CT.MasterDimmer, "IntensityDimmer": CT.Dimmer, "IntensityMasterDimmerFine": CT.Other,
        "IntensityDimmerFine": CT.Other, "IntensityRed": CT.Red, "IntensityGreen": CT.Green, "IntensityBlue": CT.Blue,
        "IntensityWhite": CT.White, "IntensityAmber": CT.Amber, "IntensityUV": CT.UV, "IntensityCyan": CT.Cyan,
        "IntensityMagenta": CT.Magenta, "IntensityYellow": CT.Yellow, "IntensityLime": CT.Other, "IntensityIndigo": CT.Other,
        "IntensityWarmWhite": CT.White, "IntensityColdWhite": CT.White,
        "PositionPan": CT.Pan, "PositionPanFine": CT.PanFine, "PositionTilt": CT.Tilt, "PositionTiltFine": CT.TiltFine,
        "PositionXAxis": CT.Pan, "PositionYAxis": CT.Tilt,
        "SpeedPanSlowFast": CT.PanTiltSpeed, "SpeedPanFastSlow": CT.PanTiltSpeed, "SpeedTiltSlowFast": CT.PanTiltSpeed,
        "SpeedTiltFastSlow": CT.PanTiltSpeed, "SpeedPanTiltSlowFast": CT.PanTiltSpeed, "SpeedPanTiltFastSlow": CT.PanTiltSpeed,
        "ColorMacro": CT.ColorWheel, "ColorWheel": CT.ColorWheel, "ColorRGBMixer": CT.Other, "ColorCTOMixer": CT.Other,
        "GoboWheel": CT.GoboWheel, "GoboIndex": CT.GoboRotation, "GoboIndexFine": CT.Other,
        "ShutterStrobeSlowFast": CT.Strobe, "ShutterStrobeFastSlow": CT.Strobe, "ShutterIrisMinToMax": CT.Iris,
        "ShutterIrisMaxToMin": CT.Iris, "BeamFocusNearFar": CT.Focus, "BeamFocusFarNear": CT.Focus,
        "BeamZoomSmallBig": CT.Zoom, "BeamZoomBigSmall": CT.Zoom, "PrismRotationSlowFast": CT.PrismRotation,
        "PrismRotationFastSlow": CT.PrismRotation, "NoFunction": CT.Unknown,
    }
    GROUP = {"Pan": CT.Pan, "Tilt": CT.Tilt, "Colour": CT.ColorWheel, "Gobo": CT.GoboWheel, "Shutter": CT.Shutter,
             "Speed": CT.PanTiltSpeed, "Prism": CT.Prism, "Beam": CT.Other, "Effect": CT.Macro, "Maintenance": CT.Reset,
             "Nothing": CT.Unknown}
    COLOUR = {"Red": CT.Red, "Green": CT.Green, "Blue": CT.Blue, "White": CT.White, "Amber": CT.Amber, "UV": CT.UV,
              "Cyan": CT.Cyan, "Magenta": CT.Magenta, "Yellow": CT.Yellow}

    @staticmethod
    def _t(el: ET.Element) -> str:
        return el.tag.split("}")[-1]

    def parse(self, data: bytes | str, path: str = "") -> SpotlyFixtureDefinition:
        root = ET.fromstring(data)
        kids = {self._t(c): c for c in root}
        man = (kids.get("Manufacturer").text or "").strip() if "Manufacturer" in kids else ""
        model = (kids.get("Model").text or "").strip() if "Model" in kids else ""
        ftype = (kids.get("Type").text or "").strip() if "Type" in kids else ""
        chans: dict[str, Channel] = {}
        for el in root:
            if self._t(el) != "Channel":
                continue
            chans[el.get("Name", "")] = self._channel(el)
        modes = []
        for el in root:
            if self._t(el) != "Mode":
                continue
            lst: list[Channel] = []
            for c in el:
                if self._t(c) != "Channel":
                    continue
                src = chans.get((c.text or "").strip())
                ch = Channel(len(lst), (c.text or "").strip(), src.type if src else CT.Unknown, src.fine if src else False,
                             src.default if src else 0, None, list(src.capabilities) if src else [])
                lst.append(ch)
            if lst:
                modes.append(Mode(el.get("Name", f"{len(lst)}CH"), lst))
        physical: dict[str, Any] = {}
        for el in root.iter():
            t = self._t(el)
            if t == "Focus":
                if el.get("PanMax"):
                    physical["pan_deg"] = float(el.get("PanMax") or 0) or None
                if el.get("TiltMax"):
                    physical["tilt_deg"] = float(el.get("TiltMax") or 0) or None
            elif t == "Lens" and el.get("DegreesMax"):
                physical["beam_deg"] = float(el.get("DegreesMax") or 0) or None
            elif t == "Dimensions" and el.get("Weight"):
                physical["weight"] = float(el.get("Weight") or 0)
            elif t == "Technical" and el.get("PowerConsumption"):
                physical["power"] = float(el.get("PowerConsumption") or 0)
        physical = {k: v for k, v in physical.items() if v}
        key = _slug(f"{man}-{model}")
        return SpotlyFixtureDefinition(f"qlc:{key}", man, model, _category(ftype + " " + model), modes, [], "qlc",
                                       "", path, 0.9, physical)

    def _channel(self, el: ET.Element) -> Channel:
        name = el.get("Name", "")
        preset = el.get("Preset", "")
        ct = self.PRESET.get(preset)
        fine = preset.endswith("Fine")
        default = int(el.get("Default", 0) or 0)
        group = None
        for c in el:
            t = self._t(c)
            if t == "Group":
                group = (c.text or "").strip()
                if c.get("Byte") == "1":
                    fine = True
            elif t == "Colour" and ct is None:
                ct = self.COLOUR.get((c.text or "").strip())
        if ct is None and group:
            ct = self.GROUP.get(group)
            if group == "Intensity":
                ct = CT.Dimmer
            if fine and ct == CT.Pan:
                ct = CT.PanFine
            elif fine and ct == CT.Tilt:
                ct = CT.TiltFine
        if ct is None:
            ct = _guess_type(name)
        caps = []
        for c in el:
            if self._t(c) != "Capability":
                continue
            cname = (c.text or "").strip() or c.get("Preset", "")
            sem = _semantic(cname)
            pr = c.get("Preset", "")
            if pr.startswith("Strobe") or "Strobe" in pr:
                sem = "strobe"
            elif pr in ("ShutterOpen", "LampOn"):
                sem = "open"
            elif pr in ("ShutterClose", "LampOff"):
                sem = "closed"
            elif pr.startswith("GoboMacro"):
                sem = "gobo"
            elif pr.startswith("ColorMacro") or pr.startswith("ColorWheel"):
                sem = "color"
            col = c.get("Res1") if (c.get("Res1") or "").startswith("#") else c.get("Color")
            if sem == "color" and not col:
                col = _color_for(cname)
            try:
                caps.append(Capability(int(c.get("Min", 0)), int(c.get("Max", 255)), cname, sem, col))
            except ValueError:
                continue
        # a group "Colour" channel whose ranges are gobos / a gobo channel with colours: trust the ranges
        if ct == CT.Shutter and any(x.semantic == "strobe" for x in caps) and not any(x.semantic == "open" for x in caps):
            ct = CT.Strobe
        if ct in (CT.Macro, CT.Other, CT.Unknown):
            ct = _refine_by_caps(ct, name, caps)
        return Channel(0, name, ct, fine or ct in (CT.PanFine, CT.TiltFine), default, None, caps)


def _guess_type(name: str) -> CT:
    """Type from a channel NAME (used by sources without types and by manual imports)."""
    n = name.lower()
    table = [
        (r"pan.*(fine|16|lsb)|fine.*pan", CT.PanFine), (r"tilt.*(fine|16|lsb)|fine.*tilt", CT.TiltFine),
        (r"(pan|tilt).*(speed|time)|p/?t ?speed|vector|motor speed|prędko", CT.PanTiltSpeed),
        (r"\bpan\b|obrót|x.?axis|horizontal", CT.Pan), (r"\btilt\b|pochyl|y.?axis|vertical", CT.Tilt),
        (r"master.*dim|dimmer master", CT.MasterDimmer), (r"dimm|intensity|jasno|brightness", CT.Dimmer),
        (r"\bred\b|czerw", CT.Red), (r"\bgreen\b|ziel", CT.Green), (r"\bblue\b|niebiesk", CT.Blue),
        (r"\bwhite\b|biał|bial", CT.White), (r"amber|bursztyn", CT.Amber), (r"\buv\b|ultra", CT.UV),
        (r"\bcyan\b", CT.Cyan), (r"magenta", CT.Magenta), (r"yellow|żółt", CT.Yellow),
        (r"gobo.*(rot|spin|index)", CT.GoboRotation), (r"gobo", CT.GoboWheel),
        (r"colou?r|kolor", CT.ColorWheel), (r"prism.*rot", CT.PrismRotation), (r"prism|pryzm", CT.Prism),
        (r"focus|ostro", CT.Focus), (r"zoom", CT.Zoom), (r"iris|przysł", CT.Iris),
        (r"strob", CT.Strobe), (r"shutter|migaw", CT.Shutter),
        (r"laser.*red|red.*laser", CT.LaserRed), (r"laser.*green|green.*laser", CT.LaserGreen),
        (r"laser.*blue|blue.*laser", CT.LaserBlue), (r"laser", CT.LaserRed),
        (r"reset", CT.Reset), (r"lamp.*(on|off|control)|control.*lamp", CT.LampControl),
        (r"sound|music|dźwięk", CT.SoundProgram), (r"auto|program|show", CT.AutoProgram),
        (r"macro|effect|efekt|function|funkc|mode\b|tryb", CT.Macro), (r"speed", CT.MotorSpeed),
    ]
    for pat, ct in table:
        if re.search(pat, n):
            return ct
    return CT.Other if n.strip() else CT.Unknown


def _refine_by_caps(ct: CT, name: str, caps: list[Capability]) -> CT:
    g = _guess_type(name)
    if g not in (CT.Other, CT.Unknown):
        return g
    if caps and all(c.semantic in ("reset", "nofunction") for c in caps) and any(c.semantic == "reset" for c in caps):
        return CT.Reset
    return ct


# =============================================================================
# Open Fixture Library (JSON)
# =============================================================================
class OflFixtureAdapter:
    """https://open-fixture-library.org fixture JSON (schema 12+)."""

    def parse(self, data: dict[str, Any] | str | bytes, key: str, manufacturer: str = "", url: str = "") -> SpotlyFixtureDefinition:
        import json
        d = json.loads(data) if isinstance(data, (str, bytes)) else data
        avail: dict[str, dict] = dict(d.get("availableChannels") or {})
        fine_of: dict[str, tuple[str, int]] = {}
        for cname, ch in list(avail.items()):
            for i, alias in enumerate(ch.get("fineChannelAliases") or []):
                fine_of[alias] = (cname, i + 1)
        tmpl = d.get("templateChannels") or {}
        modes = []
        for m in d.get("modes") or []:
            lst: list[Channel] = []
            for entry in m.get("channels") or []:
                if entry is None:
                    lst.append(Channel(len(lst), "—", CT.Unknown))
                    continue
                if isinstance(entry, dict):          # matrix insert / switching channel: take the first name
                    entry = (entry.get("repeatFor") and str(entry.get("templateChannels", ["?"])[0])) or str(entry.get("default") or "?")
                name = str(entry)
                if name in fine_of:
                    base, _n = fine_of[name]
                    bt = self._type(base, avail.get(base) or {})
                    ft = CT.PanFine if bt == CT.Pan else CT.TiltFine if bt == CT.Tilt else CT.Other
                    lst.append(Channel(len(lst), name, ft, True))
                    continue
                ch = avail.get(name) or tmpl.get(re.sub(r"\s*\d+$", " $pixelKey", name)) or {}
                ct = self._type(name, ch)
                caps = self._caps(ch)
                default = ch.get("defaultValue", 0)
                if isinstance(default, str):
                    default = int(float(default.rstrip("%")) * 2.55) if default.endswith("%") else 0
                hl = ch.get("highlightValue")
                lst.append(Channel(len(lst), name, ct, False, int(default or 0),
                                   int(hl) if isinstance(hl, (int, float)) else None, caps))
            if lst:
                modes.append(Mode(m.get("shortName") or m.get("name") or f"{len(lst)}CH", lst))
        phys = d.get("physical") or {}
        physical: dict[str, Any] = {}
        focus = phys.get("focus") or {}
        if isinstance(focus.get("panMax"), (int, float)):
            physical["pan_deg"] = focus["panMax"]
        if isinstance(focus.get("tiltMax"), (int, float)):
            physical["tilt_deg"] = focus["tiltMax"]
        lens = phys.get("lens") or {}
        if isinstance(lens.get("degreesMinMax"), list):
            physical["beam_deg"] = lens["degreesMinMax"][-1]
        if phys.get("weight"):
            physical["weight"] = phys["weight"]
        if phys.get("power"):
            physical["power"] = phys["power"]
        cats = " ".join(d.get("categories") or [])
        rdm = None
        if isinstance(d.get("rdm"), dict) and d["rdm"].get("modelId") is not None:
            rdm = {"model_id": int(d["rdm"]["modelId"])}
        return SpotlyFixtureDefinition(f"ofl:{key}", manufacturer or key.split("/")[0], d.get("name", key),
                                       _category(cats + " " + d.get("name", "")), modes,
                                       list(d.get("shortName") and [d["shortName"]] or []), "ofl",
                                       str((d.get("meta") or {}).get("lastModifyDate", "")), url, 0.95, physical, rdm)

    def _type(self, name: str, ch: dict[str, Any]) -> CT:
        caps = ch.get("capabilities") or ([ch["capability"]] if ch.get("capability") else [])
        types = [c.get("type") for c in caps]
        first = caps[0] if caps else {}
        t = first.get("type")
        if t == "ColorIntensity":
            return {"Red": CT.Red, "Green": CT.Green, "Blue": CT.Blue, "White": CT.White, "Amber": CT.Amber, "UV": CT.UV,
                    "Cyan": CT.Cyan, "Magenta": CT.Magenta, "Yellow": CT.Yellow, "Warm White": CT.White,
                    "Cold White": CT.White}.get(first.get("color"), CT.Other)
        if t == "Intensity":
            return CT.MasterDimmer if "master" in name.lower() else CT.Dimmer
        if t in ("Pan",):
            return CT.Pan
        if t == "Tilt":
            return CT.Tilt
        if t in ("PanTiltSpeed",):
            return CT.PanTiltSpeed
        wheel = any(x in types for x in ("WheelSlot", "WheelShake", "WheelRotation", "ColorPreset"))
        if wheel and re.search(r"colou?r|gobo", name, re.I):
            return CT.GoboWheel if "gobo" in name.lower() and "colo" not in name.lower() else CT.ColorWheel
        if "ShutterStrobe" in types:
            return CT.Strobe if not any((c.get("shutterEffect") == "Open") for c in caps) else CT.Shutter
        if "WheelSlot" in types or "WheelShake" in types or "WheelRotation" in types:
            n = name.lower()
            if "gobo" in n and "rot" in n:
                return CT.GoboRotation
            if "gobo" in n:
                return CT.GoboWheel
            if "colo" in n:
                return CT.ColorWheel
            return CT.GoboWheel if "gobo" in str(caps).lower() else CT.ColorWheel
        if "ColorPreset" in types:
            return CT.ColorWheel
        if t == "Prism" or "Prism" in types:
            return CT.Prism
        if t == "PrismRotation":
            return CT.PrismRotation
        if t == "Focus":
            return CT.Focus
        if t == "Zoom":
            return CT.Zoom
        if t == "Iris":
            return CT.Iris
        if t == "Maintenance" and any("reset" in str(c).lower() for c in caps):
            return CT.Reset
        if t in ("Speed", "EffectSpeed"):
            return CT.MotorSpeed if "motor" in name.lower() or "pan" in name.lower() else _guess_type(name) if _guess_type(name) != CT.Other else CT.MotorSpeed
        if t == "Rotation":
            return CT.GoboRotation
        if "Effect" in types or "SoundSensitivity" in types:
            return CT.SoundProgram if "sound" in str(caps).lower() and "auto" not in name.lower() else CT.AutoProgram if "auto" in name.lower() else CT.Macro
        if t == "NoFunction" and len(caps) <= 1:
            return CT.Unknown
        return _guess_type(name)

    def _caps(self, ch: dict[str, Any]) -> list[Capability]:
        caps = ch.get("capabilities") or ([dict(ch["capability"], dmxRange=[0, 255])] if ch.get("capability") else [])
        out = []
        for c in caps:
            rng = c.get("dmxRange") or [0, 255]
            t = c.get("type", "")
            name = c.get("comment") or c.get("effectName") or c.get("name") or t
            sem = {"NoFunction": "nofunction", "Prism": "prism", "WheelRotation": "rotation", "Rotation": "rotation"}.get(t, "")
            color = None
            if t == "ShutterStrobe":
                se = c.get("shutterEffect", "")
                sem = "open" if se == "Open" else "closed" if se == "Closed" else "strobe"
                name = c.get("comment") or se
            elif t in ("WheelSlot", "ColorPreset"):
                cols = c.get("colors") or []
                color = cols[0] if cols else _color_for(str(c.get("comment", "")))
                sem = "color" if color else "gobo"
                name = c.get("comment") or (f"Slot {c.get('slotNumber')}" if c.get("slotNumber") else t)
            elif t == "Effect":
                sem = "sound" if c.get("soundControlled") else "auto"
            elif t == "Maintenance":
                sem = "reset" if "reset" in str(c).lower() else ""
            out.append(Capability(int(rng[0]), int(rng[1]), str(name), sem or _semantic(str(name)), color))
        return out


# =============================================================================
# GDTF (.gdtf zip with description.xml)
# =============================================================================
class GdtfFixtureAdapter:
    ATTR = [
        (r"^Pan$", CT.Pan), (r"^Tilt$", CT.Tilt), (r"^PanTiltSpeed|^PanTiltTime|MSpeed", CT.PanTiltSpeed),
        (r"^Dimmer$", CT.Dimmer), (r"ColorAdd_R$|ColorRGB_Red", CT.Red), (r"ColorAdd_G$|ColorRGB_Green", CT.Green),
        (r"ColorAdd_B$|ColorRGB_Blue", CT.Blue), (r"ColorAdd_W$|ColorAdd_WW|ColorAdd_CW", CT.White),
        (r"ColorAdd_A$", CT.Amber), (r"ColorAdd_UV", CT.UV), (r"ColorSub_C|ColorAdd_C$", CT.Cyan),
        (r"ColorSub_M|ColorAdd_M$", CT.Magenta), (r"ColorSub_Y|ColorAdd_Y$", CT.Yellow), (r"^Color\d", CT.ColorWheel),
        (r"^Gobo\d+(Pos|SelectSpin|Rotate|Spin)", CT.GoboRotation), (r"^Gobo\d", CT.GoboWheel),
        (r"^Prism\d+(Pos|Rotate)", CT.PrismRotation), (r"^Prism", CT.Prism), (r"^Focus", CT.Focus), (r"^Zoom", CT.Zoom),
        (r"^Iris", CT.Iris), (r"^Shutter\d*Strobe|^StrobeFrequency|^StrobeDuration", CT.Strobe), (r"^Shutter", CT.Shutter),
        (r"Control|Reset|FixtureGlobalReset", CT.Reset), (r"LampControl", CT.LampControl),
        (r"^Effects|^Macro|^Program|^FixtureMacro", CT.Macro), (r"Sound", CT.SoundProgram),
    ]

    def parse(self, data: bytes, path: str = "") -> SpotlyFixtureDefinition:
        raw = data
        if data[:2] == b"PK":
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                raw = z.read("description.xml")
        root = ET.fromstring(raw)
        ft = root.find("FixtureType")
        if ft is None:
            raise ValueError("to nie jest plik GDTF (brak FixtureType)")
        man, model = ft.get("Manufacturer", ""), ft.get("LongName") or ft.get("Name", "")
        modes = []
        for mode in ft.iter("DMXMode"):
            slots: dict[int, Channel] = {}
            for dc in mode.iter("DMXChannel"):
                offs = (dc.get("Offset") or "").split(",")
                if not offs or not offs[0].strip().isdigit():
                    continue
                lc = dc.find("LogicalChannel")
                attr = lc.get("Attribute", "") if lc is not None else ""
                ct = next((c for pat, c in self.ATTR if re.search(pat, attr)), None) or _guess_type(attr)
                caps = []
                if lc is not None:
                    fns = list(lc.iter("ChannelFunction"))
                    for i, fn in enumerate(fns):
                        lo = _gdtf_dmx(fn.get("DMXFrom", "0/1"))
                        hi = _gdtf_dmx(fns[i + 1].get("DMXFrom", "256/1")) - 1 if i + 1 < len(fns) else 255
                        nm = fn.get("Name") or fn.get("Attribute", "")
                        caps.append(Capability(lo, max(lo, hi), nm, _semantic(nm)))
                default = _gdtf_dmx(dc.get("Default", "0/1"))
                first = int(offs[0]) - 1
                slots[first] = Channel(first, attr or dc.get("Name", ""), ct, False, default, None, caps)
                for k, o in enumerate(offs[1:], 1):
                    if o.strip().isdigit():
                        fine = CT.PanFine if ct == CT.Pan else CT.TiltFine if ct == CT.Tilt else CT.Other
                        slots[int(o) - 1] = Channel(int(o) - 1, f"{attr} fine", fine, True)
            if slots:
                n = max(slots) + 1
                lst = [slots.get(i) or Channel(i, "—", CT.Unknown) for i in range(n)]
                for i, c in enumerate(lst):
                    c.offset = i
                modes.append(Mode(mode.get("Name", f"{n}CH"), lst))
        rdm = None
        r = ft.find(".//FTRDM")
        if r is not None and r.get("ManufacturerID") and r.get("DeviceModelID"):
            rdm = {"manufacturer_id": int(r.get("ManufacturerID"), 16 if r.get("ManufacturerID", "").lower().startswith("0x") else 10),
                   "model_id": int(r.get("DeviceModelID"), 16 if r.get("DeviceModelID", "").lower().startswith("0x") else 10)}
        key = _slug(f"{man}-{model}")
        return SpotlyFixtureDefinition(f"gdtf:{key}", man, model, _category(model + " " + ft.get("Description", "")),
                                       modes, [ft.get("ShortName")] if ft.get("ShortName") else [], "gdtf",
                                       root.get("DataVersion", ""), path, 0.95, {}, rdm)


def _gdtf_dmx(v: str) -> int:
    """GDTF DMX value "128/1" (value/bytes) -> 0..255."""
    try:
        val, nb = v.split("/")
        return int(int(val) >> (8 * (int(nb) - 1)))
    except (ValueError, AttributeError):
        return 0


# =============================================================================
# Old Lumo library (fixture_library.json) and saved Lumo profiles
# =============================================================================
class SpotlyLibraryAdapter:
    def parse(self, e: dict[str, Any]) -> SpotlyFixtureDefinition:
        chans = []
        for i, role in enumerate(e.get("channels") or []):
            ct = FROM_ROLE.get(role, CT.Other if role.startswith("const:") else CT.Unknown)
            chans.append(Channel(i, role, ct, role.endswith("_fine"), int(role[6:] or 0) if role.startswith("const:") else 0))
        n = len(chans)
        brand = e.get("brand", "")
        phys = {k: e[k] for k in ("pan_deg", "tilt_deg", "beam_deg") if e.get(k)}
        mode = Mode(f"{n}CH", chans)
        for c in mode.channels:        # remember the colour wheel / gobo / shutter details of the library entry
            if c.type == CT.ColorWheel and e.get("wheel"):
                c.capabilities = [Capability(max(0, v - 4), min(255, v + 4), name, "color",
                                             "#%02x%02x%02x" % tuple(rgb)) for v, rgb, name in e["wheel"]]
            if c.type == CT.GoboWheel and e.get("gobos"):
                c.capabilities = [Capability(max(0, v - 4), min(255, v + 4), name, "gobo") for v, name in e["gobos"]]
            if c.type in (CT.Shutter, CT.Strobe) and "shutter_open" in e:
                c.capabilities = [Capability(e["shutter_open"], e["shutter_open"], "Open", "open"),
                                  Capability(e.get("strobe_min", 1), e.get("strobe_max", 255), "Strobe", "strobe")]
        return SpotlyFixtureDefinition(f"spotly:{e['key']}", brand or "Generic", e.get("model", e["key"]),
                                       e.get("type", "other"), [mode], [], "spotly", "", "", 0.98, phys)
