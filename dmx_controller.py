"""
dmx_controller.py
=================
DMX / Virtual Fixture Engine.

* ``Fixture``      – one moving head: DMX start address, channel profile
                     (Pan/Tilt 8 or 16 bit, Dimmer, Shutter/Strobe, RGB),
                     target + smoothed (current) values, calibration.
* ``DMXEngine``    – owns all fixtures, runs a fixed-rate thread (40 Hz) that
                     smooths values, renders a 512-byte DMX universe and pushes
                     it to the selected output backend.
* Output backends  – ``NullOutput`` (pure simulation), ``EnttecProOutput``,
                     ``OpenDmxOutput`` (FTDI), ``ArtNetOutput`` (UDP).

------------------------------------------------------------------------------
JAK PODPIĄĆ FIZYCZNY KONWERTER DMX (zamiast symulacji)
------------------------------------------------------------------------------
1. Ustaw ``ENABLE_PHYSICAL_DMX = True`` poniżej  (albo zmienna środowiskowa
   ``DMX_ENABLE=1`` albo flaga ``python main.py --dmx <backend>``).
2. Wybierz ``DMX_BACKEND``:

   "enttec"  – ENTTEC DMX USB PRO / PRO Mk2 i klony (DMXKing ultraDMX Pro,
               Eurolite USB-DMX512-PRO …).  Urządzenie ma własny procesor,
               dostaje ramkę protokołem "label 6" przez wirtualny COM.
               ``pip install pyserial``, ``DMX_SERIAL_PORT = "COM3"``
               (Linux: "/dev/ttyUSB0", macOS: "/dev/cu.usbserial-XXXX").

   "opendmx" – tanie kable FTDI "Open DMX" (ENTTEC Open DMX USB, klony
               FT232R + MAX485).  Brak procesora – to my generujemy BREAK +
               MAB + 513 bajtów przy 250 kbaud, 8N2.  Na Windows wymagany
               sterownik FTDI VCP (port COM).  Timing zależy od systemu –
               jeśli oprawy migoczą, użyj interfejsu "Pro" lub Art-Net.

   "artnet"  – dowolny węzeł Art-Net (ENTTEC ODE, DMXKing eDMX, QLC+ jako
               węzeł, Resolume, MA onPC …).  ``ARTNET_TARGET_IP`` = IP węzła
               (unicast) albo broadcast sieci np. "2.255.255.255" /
               "192.168.1.255".  ``ARTNET_UNIVERSE`` = 15-bit Port-Address.
               Wbudowana implementacja UDP nie wymaga bibliotek; opcjonalnie
               ``ARTNET_USE_STUPIDARTNET = True`` + ``pip install stupidArtnet``.

3. Dopasuj profil kanałów każdej oprawy do jej instrukcji (tryb DMX!):
   pole ``channels`` w config.json, np.
       ["pan","pan_fine","tilt","tilt_fine","speed","dimmer","shutter",
        "red","green","blue","white","const:0"]
   oraz wartości migawki ``shutter_open`` / ``strobe_min`` / ``strobe_max``
   (np. wiele głowic: 0-7 zamknięta, 8-15 otwarta, 16-131 strobe
   → shutter_open=10, strobe_min=16, strobe_max=131).
4. Ustaw pozycję oprawy na scenie (``pos`` [x, y, z] w metrach, ``mount``
   "hang"/"floor", ``yaw``) oraz zakres ruchu z instrukcji (``pan_deg`` np. 540,
   ``tilt_deg`` np. 270).  Aplikacja liczy Pan/Tilt odwrotną kinematyką
   (stage.py), więc światło trafia w punkt wskazany na obrazie z kamery.
   Pozycję i obrót można też wyznaczyć automatycznie kamerą (AUTO-KALIBRACJA).
------------------------------------------------------------------------------
"""

from __future__ import annotations

import colorsys
import json
import logging
import math
import os
import socket
import struct
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

import stage as stage_mod

log = logging.getLogger("dmx")

# =============================================================================
# GLOBAL CONFIGURATION
# =============================================================================
ENABLE_PHYSICAL_DMX: bool = False          # False = tylko symulacja wizualna
DMX_BACKEND: str = "artnet"                # "artnet" | "enttec" | "opendmx" | "udmx"
DMX_SERIAL_PORT: str = "COM3"              # dla "enttec" / "opendmx"
ARTNET_TARGET_IP: str = "255.255.255.255"  # IP węzła lub broadcast
ARTNET_UNIVERSE: int = 0
ARTNET_USE_STUPIDARTNET: bool = False      # True = użyj biblioteki stupidArtnet
DMX_REFRESH_HZ: float = 50.0               # częstotliwość odświeżania ramek (krótkie ramki Open DMX)
BLACKOUT_ON_EXIT: bool = True              # wyślij ramkę z dimmerami = 0 przy zamknięciu


def _env_bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v is None else v.strip().lower() in ("1", "true", "yes", "on")


# Environment overrides (handy for launch scripts); main.py CLI flags override these too.
ENABLE_PHYSICAL_DMX = _env_bool("DMX_ENABLE", ENABLE_PHYSICAL_DMX)
DMX_BACKEND = os.getenv("DMX_BACKEND", DMX_BACKEND).lower()
DMX_SERIAL_PORT = os.getenv("DMX_PORT", DMX_SERIAL_PORT)
ARTNET_TARGET_IP = os.getenv("ARTNET_IP", ARTNET_TARGET_IP)
ARTNET_UNIVERSE = int(os.getenv("ARTNET_UNIVERSE", ARTNET_UNIVERSE))

# =============================================================================
# FIXTURE MODEL
# =============================================================================
HOME_16 = 127 * 256  # "Home" = Pan 127 / Tilt 127 (coarse), fine 0
POSITION_ROLES = ("pan", "pan_fine", "tilt", "tilt_fine", "speed")      # blackout keeps where the heads point
COLOR_ROLES = ("red", "green", "blue", "white", "amber", "uv", "cyan", "magenta", "yellow")
PARAM_MAX = {
    "pan": 65535, "tilt": 65535,
    "dimmer": 255, "strobe": 255,
    "red": 255, "green": 255, "blue": 255,
    # effect fixtures (bars, derbies, lasers, smoke machines): extra motors / macros
    "speed": 255,        # motor speed (0 = fastest on most fixtures)
    "spin": 255,         # continuous rotation (bee-eye / derby head)
    "beam": 255,         # beam tilt of the individual lenses of a bar
    "laser": 255,        # laser brightness - forced to 0 unless lasers are armed
    "strip": 255,        # LED strip macro
    "strip_speed": 255,
    "macro": 255,        # built-in auto / sound programs (kept at 0 by default)
    "aux1": 255, "aux2": 255,   # extra strobes (white / golden light)
    "cwheel": 255,       # colour wheel position (spot fixtures without RGB LEDs)
    "gobo": 255,         # gobo wheel position
}
POSITION_PARAMS = ("pan", "tilt")
KNOWN_CHANNELS = (
    "pan", "pan_fine", "tilt", "tilt_fine", "dimmer", "shutter", "strobe",
    "red", "green", "blue", "white", "speed", "spin", "beam",
    "laser", "laser_r", "laser_g", "strip", "strip_speed", "macro", "aux1", "aux2",
    "cwheel", "gobo", "none",
)  # plus "const:<0-255>"


def _clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def _terms(x: float, y: float, k: int) -> list[float]:
    if k == 6:
        return [1.0, x, y, x * y, x * x, y * y]
    if k == 4:
        return [1.0, x, y, x * y]
    return [1.0, x, y]


def fit_aim(points: list) -> dict | None:
    """Person calibration: camera point (feet) → pan / tilt, fitted through the confirmed spots.

    3 spots = plane, 4-5 = bilinear, 6+ = quadratic (least squares, lightly regularised)."""
    n = len(points or [])
    if n < 3:
        return None
    k = 6 if n >= 6 else 4 if n >= 4 else 3
    P = np.asarray(points, dtype=float)
    A = np.array([_terms(px, py, k) for px, py in P[:, :2]])
    reg = 1e-4 * np.eye(k)
    reg[0, 0] = 0.0
    M = A.T @ A + reg
    cp = np.linalg.solve(M, A.T @ P[:, 2])
    ct = np.linalg.solve(M, A.T @ P[:, 3])
    x0, y0 = P[:, 0].min(), P[:, 1].min()
    x1, y1 = P[:, 0].max(), P[:, 1].max()
    mx, my = max(0.05, (x1 - x0) * 0.15), max(0.05, (y1 - y0) * 0.15)
    resid = float(np.sqrt(np.mean((A @ cp - P[:, 2]) ** 2 + (A @ ct - P[:, 3]) ** 2)))
    return {"k": k, "pan": cp.tolist(), "tilt": ct.tolist(), "box": [x0 - mx, y0 - my, x1 + mx, y1 + my],
            "err": resid}


def eval_aim(fit: dict, x: float, y: float) -> tuple[float, float]:
    b = fit["box"]                                   # do not extrapolate far outside the calibrated area
    x, y = _clamp(x, b[0], b[2]), _clamp(y, b[1], b[3])
    t = _terms(x, y, fit["k"])
    pan = sum(c * v for c, v in zip(fit["pan"], t))
    tilt = sum(c * v for c, v in zip(fit["tilt"], t))
    return _clamp(pan, 0, 65535), _clamp(tilt, 0, 65535)


def default_values() -> dict[str, float]:
    v = {"pan": HOME_16, "tilt": HOME_16, "dimmer": 0,
         "strobe": 0, "red": 255, "green": 255, "blue": 255}
    v.update({k: 0.0 for k in ("speed", "spin", "beam", "laser", "strip", "strip_speed",
                               "macro", "aux1", "aux2", "cwheel", "gobo")})
    return v


@dataclass
class Fixture:
    id: int
    name: str
    address: int = 1                      # 1-based DMX start address
    model: str = ""                       # library model (shown in the UI and the 3-D view)
    type: str = "moving_head"             # moving_head | bar | derby | par | strobe | laser | smoke
    library_key: str = ""
    pan_16bit: bool = True
    tilt_16bit: bool = True
    has_rgb: bool = True
    channels: list[str] | None = None     # custom layout; None = auto from flags
    icon_x: float = 0.5                   # selection target on the video (normalised)
    icon_y: float = 0.22
    # ---- physical placement (metres, see stage.py for axes) ----
    pos: list[float] = field(default_factory=lambda: [0.0, 5.0, -2.0])
    mount: str = "hang"                   # "hang" (truss, upside down) | "floor" (standing)
    yaw: float = 0.0                      # base rotation, 0 = display/front facing the audience
    pan_deg: float = 540.0                # total pan range from the manual
    tilt_deg: float = 270.0               # total tilt range from the manual
    invert_pan: bool = False
    invert_tilt: bool = False
    flip_x: bool = False                  # gestures: finger right -> lamp left? flip the horizontal direction
    flip_y: bool = False                  # the same for up / down
    enabled: bool = True                  # off = the device gets zeros and nothing (gesture, effect) drives it
    beam_deg: float = 14.0                # beam angle (visual only)
    aim_pan: list[float] | None = None    # calibrated pan at the left / right edge of the pointing area
    aim_tilt: list[float] | None = None   # calibrated tilt at the top / bottom edge of the pointing area
    shutter_open: int = 0                 # shutter value for "open, no strobe"
    strobe_min: int = 1                   # shutter value for slowest strobe
    strobe_max: int = 255                 # shutter value for fastest strobe
    aim_points: dict | None = None        # person calibration {"main"|"stage": [[x, y, pan, tilt], ...]}
    show_home: list[float] | None = None  # [pan16, tilt16] beam on the middle of the dance floor (shows move around it)
    wheel: list | None = None             # colour wheel slots [[dmx, [r, g, b], name], ...]
    gobos: list | None = None             # gobo wheel presets [[dmx, name], ...]
    target: dict[str, float] = field(default_factory=default_values)
    current: dict[str, float] = field(default_factory=default_values)
    overrides: dict[int, int] = field(default_factory=dict)   # desk: channel index -> fixed value
    caps: dict | None = None              # capability ranges from the profile {"offset": [[min, max, name, semantic, color]]}
    defaults: dict | None = None          # profile default value of channels the engine does not drive {"offset": value}

    # ---- profile -----------------------------------------------------------
    def layout(self) -> list[str]:
        if self.channels:
            return list(self.channels)
        ch = ["pan"] + (["pan_fine"] if self.pan_16bit else [])
        ch += ["tilt"] + (["tilt_fine"] if self.tilt_16bit else [])
        ch += ["dimmer", "shutter"]
        if self.has_rgb:
            ch += ["red", "green", "blue"]
        return ch

    @property
    def footprint(self) -> int:
        return len(self.layout())

    # ---- value setters -----------------------------------------------------
    def set(self, param: str, value: float) -> None:
        t = self.target
        if param in PARAM_MAX:
            t[param] = _clamp(float(value), 0, PARAM_MAX[param])
        elif param in ("pan_coarse", "tilt_coarse"):
            axis = param.split("_")[0]
            v = int(_clamp(value, 0, 255))
            if getattr(self, f"{axis}_16bit"):
                t[axis] = v * 256 + (int(t[axis]) & 0xFF)
            else:
                t[axis] = v * 257
        elif param in ("pan_fine", "tilt_fine"):
            axis = param.split("_")[0]
            t[axis] = (int(t[axis]) & 0xFF00) | int(_clamp(value, 0, 255))
        else:
            raise KeyError(f"unknown parameter '{param}'")

    def wheel_for(self, r: float, g: float, b: float) -> float:
        """Colour wheel value of the slot closest to an RGB colour (spot heads without LEDs)."""
        if not self.wheel:
            return colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0] * 120
        h, sat, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        best, best_d = self.wheel[0][0], 9.0
        for val, rgb, *_ in self.wheel:
            h2, s2, _v2 = colorsys.rgb_to_hsv(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
            dh = min(abs(h - h2), 1 - abs(h - h2)) * 2          # 0..1 around the hue circle
            d = (dh * min(sat, s2)) ** 2 + (sat - s2) ** 2
            if d < best_d:
                best, best_d = val, d
        return float(best)

    def aim(self, point: list[float]) -> None:
        """Aim the beam at a world point (inverse kinematics, nearest solution)."""
        self.target["pan"], self.target["tilt"] = stage_mod.ik(
            self, point, self.target["pan"], self.target["tilt"])

    def snap(self) -> None:
        self.current.update(self.target)

    def step(self, pos_alpha: float, val_alpha: float) -> None:
        """Exponential smoothing target → current (called at DMX_REFRESH_HZ)."""
        for k, tv in self.target.items():
            cv = self.current[k]
            if k == "strobe":
                self.current[k] = tv
                continue
            a = pos_alpha if k in POSITION_PARAMS else val_alpha
            nv = cv + (tv - cv) * a
            if abs(tv - nv) < (2.0 if k in POSITION_PARAMS else 0.3):
                nv = tv
            self.current[k] = nv

    # ---- DMX rendering -----------------------------------------------------
    def _channel_value(self, name: str, master: float, lasers: bool = False) -> int:
        c = self.current
        if name.startswith("const:"):
            return int(_clamp(int(name[6:] or 0), 0, 255))
        if name in ("pan", "tilt"):
            v16 = int(round(c[name]))
            return (v16 >> 8) if getattr(self, f"{name}_16bit") else int(round(v16 / 257))
        if name in ("pan_fine", "tilt_fine"):
            return int(round(c[name.split("_")[0]])) & 0xFF
        if name == "dimmer":
            return int(round(c["dimmer"] * master))
        if name in ("shutter", "strobe"):
            s = c["strobe"]
            if s <= 0.5:
                return self.shutter_open
            return int(round(self.strobe_min + (s - 1) / 254.0 * (self.strobe_max - self.strobe_min)))
        if name in ("red", "green", "blue"):
            return int(round(c[name]))
        if name in ("laser", "laser_r", "laser_g"):
            return int(round(c["laser"])) if lasers else 0          # safety gate
        if name in ("speed", "spin", "beam", "strip", "strip_speed", "macro", "aux1", "aux2",
                    "cwheel", "gobo"):
            return int(round(c[name]))
        if name == "white":
            return int(round(min(c["red"], c["green"], c["blue"])))
        return 0  # "none" / unknown

    def render(self, universe: bytearray, master: float, lasers: bool = False) -> None:
        if not self.enabled:
            return                                    # switched off: its channels stay 0
        base = self.address - 1
        layout = self.layout()
        dark = master <= 0.0                          # blackout: every light channel 0 (lamps without a dimmer too)
        nodim = "dimmer" not in layout
        color_master = master * self.current["dimmer"] / 255.0 if nodim else master
        for i, name in enumerate(layout):
            idx = base + i
            if 0 <= idx < 512 and dark and name not in POSITION_ROLES:
                universe[idx] = 0
                continue
            if 0 <= idx < 512 and nodim and name in COLOR_ROLES:
                v = self.overrides[i] if i in self.overrides else self._channel_value(name, master, lasers)
                universe[idx] = int(round(v * color_master))
                continue
            if 0 <= idx < 512:
                if i in self.overrides:
                    v = self.overrides[i]
                    if name in ("dimmer", "red", "green", "blue", "white"):
                        v = int(round(v * master)) if name == "dimmer" or master == 0 else v
                    elif name.startswith("laser") and not lasers:
                        v = 0                                         # safety gate stays
                    universe[idx] = v
                else:
                    v = self._channel_value(name, master, lasers)
                    if (v == 0 and self.defaults and str(i) in self.defaults and not name.startswith("laser")
                            and name not in ("reset", "lamp")):              # never a stored value on reset / lamp control
                        v = int(self.defaults[str(i)])
                    universe[idx] = v

    # ---- (de)serialisation ------------------------------------------------
    def to_state(self) -> dict[str, Any]:
        return {
            "id": self.id, "name": self.name, "address": self.address,
            "model": self.model, "type": self.type, "library_key": self.library_key,
            "footprint": self.footprint, "channels": self.layout(),
            "custom_channels": bool(self.channels),
            "pan_16bit": self.pan_16bit, "tilt_16bit": self.tilt_16bit, "has_rgb": self.has_rgb,
            "icon": [round(self.icon_x, 4), round(self.icon_y, 4)],
            "pos": [round(v, 3) for v in self.pos], "mount": self.mount, "yaw": round(self.yaw, 1),
            "pan_deg": self.pan_deg, "tilt_deg": self.tilt_deg,
            "invert_pan": self.invert_pan, "invert_tilt": self.invert_tilt, "beam_deg": self.beam_deg,
            "flip_x": self.flip_x, "flip_y": self.flip_y, "enabled": self.enabled,
            "shutter_open": self.shutter_open, "strobe_min": self.strobe_min, "strobe_max": self.strobe_max,
            "aim_pan": self.aim_pan, "aim_tilt": self.aim_tilt, "show_home": self.show_home,
            "wheel": self.wheel, "gobos": self.gobos,
            "aim_points": {c: len(v) for c, v in (self.aim_points or {}).items()},
            "aim_err": {c: round(fit["err"] / 65535 * self.pan_deg, 2)
                        for c, v in (self.aim_points or {}).items() if (fit := fit_aim(v))},
            "values": {k: int(round(v)) for k, v in self.current.items()},
            "overrides": {str(k): v for k, v in self.overrides.items()},
            "caps": self.caps or {},
        }

    def to_config(self) -> dict[str, Any]:
        return {
            "id": self.id, "name": self.name, "address": self.address,
            "model": self.model, "type": self.type, "library_key": self.library_key,
            "pan_16bit": self.pan_16bit, "tilt_16bit": self.tilt_16bit, "has_rgb": self.has_rgb,
            "channels": self.channels, "icon_x": self.icon_x, "icon_y": self.icon_y,
            "pos": list(self.pos), "mount": self.mount, "yaw": self.yaw,
            "pan_deg": self.pan_deg, "tilt_deg": self.tilt_deg, "invert_pan": self.invert_pan,
            "invert_tilt": self.invert_tilt, "beam_deg": self.beam_deg,
            "flip_x": self.flip_x, "flip_y": self.flip_y, "enabled": self.enabled,
            "aim_pan": self.aim_pan, "aim_tilt": self.aim_tilt,
            "shutter_open": self.shutter_open, "strobe_min": self.strobe_min,
            "strobe_max": self.strobe_max, "wheel": self.wheel, "gobos": self.gobos, "aim_points": self.aim_points,
            "show_home": self.show_home,
            "caps": self.caps, "defaults": self.defaults,
            "values": {k: int(round(v)) for k, v in self.target.items()},
        }

    @classmethod
    def from_config(cls, d: dict[str, Any]) -> "Fixture":
        allowed = {"id", "name", "address", "model", "type", "library_key",
                   "pan_16bit", "tilt_16bit", "has_rgb", "channels",
                   "icon_x", "icon_y", "shutter_open", "strobe_min", "strobe_max",
                   "pos", "mount", "yaw", "pan_deg", "tilt_deg", "invert_pan", "invert_tilt", "flip_x", "flip_y", "enabled",
                   "beam_deg", "aim_pan", "aim_tilt", "wheel", "gobos", "aim_points", "caps", "defaults", "show_home"}
        f = cls(**{k: v for k, v in d.items() if k in allowed})
        for k, v in (d.get("values") or {}).items():
            if k in PARAM_MAX:
                f.target[k] = _clamp(float(v), 0, PARAM_MAX[k])
        f.snap()
        return f


# =============================================================================
# OUTPUT BACKENDS
# =============================================================================
class DMXOutput:
    name = "simulation"
    ok = True
    status = "SIMULATION (ENABLE_PHYSICAL_DMX = False)"
    label = "VIRTUAL LOOPBACK"              # short text for the UI status stepper

    def send(self, data: bytes) -> None:  # data = 512 channel bytes (no start code)
        pass

    def close(self) -> None:
        pass


class NullOutput(DMXOutput):
    pass


class ReleasedOutput(DMXOutput):
    """The cable was given to another program (QLC+): nothing is sent until "take it back"."""
    name = "released"
    ok = False
    status = "Kabel oddany innemu programowi"
    label = "kabel oddany"


class EnttecProOutput(DMXOutput):
    """ENTTEC DMX USB Pro protocol: 0x7E, label 6, len LSB/MSB, start code + data, 0xE7."""
    name = "enttec"

    def __init__(self, port: str):
        import serial  # pyserial
        self.ser = serial.Serial(port, baudrate=57600, timeout=0.1, write_timeout=0.2)
        self.status = f"ENTTEC PRO @ {port}"
        self.label = f"ENTTEC PRO · {port}"

    def send(self, data: bytes) -> None:
        payload = b"\x00" + data
        n = len(payload)
        self.ser.write(bytes([0x7E, 0x06, n & 0xFF, (n >> 8) & 0xFF]) + payload + b"\xE7")

    def close(self) -> None:
        self.ser.close()


class OpenDmxOutput(DMXOutput):
    """FTDI 'Open DMX' – host generates BREAK/MAB and streams 250 kbaud 8N2."""
    name = "opendmx"

    def __init__(self, port: str):
        import serial
        try:
            self.ser = serial.Serial(port, baudrate=250000, bytesize=8, parity="N",
                                     stopbits=2, timeout=0.1, write_timeout=0.2)
        except PermissionError as e:
            raise RuntimeError(f"{port} jest zajęty przez inny program (QLC+?) - zamknij go albo wyjmij i włóż kabel") from e
        except OSError as e:
            raise RuntimeError(
                f"{port} nie obsługuje 250 kbaud (DMX). Wybierz port adaptera USB-DMX "
                f"(FTDI / USB Serial), nie port płyty głównej. [{e}]") from e
        self.ser.rts = False
        self._busy_until = 0.0
        self.status = f"OPEN DMX (FTDI) @ {port}"
        self.label = f"{port} · UART 250k baud"

    def send(self, data: bytes) -> None:
        wait = self._busy_until - time.perf_counter()
        if wait > 0:
            _spin_wait(wait)
        self.ser.break_condition = True      # BREAK  (>= 88 µs)
        _spin_wait(0.00012)
        self.ser.break_condition = False     # MARK AFTER BREAK (>= 8 µs)
        _spin_wait(0.00002)
        self.ser.write(b"\x00" + data)       # start code 0 + 512 slots
        self.ser.flush()
        self._busy_until = time.perf_counter() + 513 * 11 / 250000.0 + 0.0005

    def close(self) -> None:
        self.ser.close()


class UDMXOutput(DMXOutput):
    """Anyma uDMX and its clones (USB VID 16C0 / PID 05DC, often sold as a cheap "USB-DMX cable").

    Not a COM port: it is driven with USB vendor control transfers
    (request 2 = SetChannelRange).  Windows needs the WinUSB driver installed once
    with Zadig (https://zadig.akeo.ie): select "uDMX", choose WinUSB, Install Driver.
    Python side: ``pip install pyusb libusb-package``.
    """
    name = "udmx"
    VID, PID = 0x16C0, 0x05DC

    def __init__(self) -> None:
        import usb.core
        try:
            import libusb_package
            backend = libusb_package.get_libusb1_backend()
        except ImportError:
            backend = None
        self.dev = usb.core.find(idVendor=self.VID, idProduct=self.PID, backend=backend)
        if self.dev is None:
            raise RuntimeError("uDMX nie znaleziony – podłącz go i zainstaluj sterownik WinUSB przez Zadig")
        try:
            self.dev.set_configuration()
        except Exception:
            pass
        self.channels = 512
        self.status = "uDMX (Anyma) @ USB"
        self.label = "uDMX · USB"

    def send(self, data: bytes) -> None:
        n = self.channels
        # bmRequestType 0x40 = vendor | device | host→device; bRequest 2 = SetChannelRange
        self.dev.ctrl_transfer(0x40, 2, n, 0, data[:n], timeout=200)

    def close(self) -> None:
        try:
            import usb.util
            usb.util.dispose_resources(self.dev)
        except Exception:
            pass


def find_udmx() -> bool:
    try:
        import usb.core
        import libusb_package
        return usb.core.find(idVendor=0x16C0, idProduct=0x05DC,
                             backend=libusb_package.get_libusb1_backend()) is not None
    except Exception:
        return False


def _spin_wait(seconds: float) -> None:
    """Busy-wait with microsecond resolution (time.sleep is too coarse for BREAK / MAB)."""
    end = time.perf_counter() + seconds
    while time.perf_counter() < end:
        pass


class FtdiD2xxOpenDmxOutput(DMXOutput):
    """FTDI 'Open DMX' through the native D2XX driver (ftd2xx.dll) - the reference method.

    Frame: BREAK (>=110 us) -> MARK-AFTER-BREAK (>=16 us) -> start code 0 + 512 slots
    at 250 kbaud, 8 data bits, 2 stop bits, no parity.  RTS is cleared like ENTTEC's
    reference code (some adapters use it to enable the RS-485 driver).  The next frame
    never starts before the previous one has left the wire (22.6 ms for 513 slots).
    """
    name = "opendmx"
    WIRE_S = 513 * 11 / 250000.0

    def __init__(self, serial: str | None = None):
        import ftd2xx
        n = ftd2xx.createDeviceInfoList()
        if n == 0:
            raise RuntimeError("brak urządzeń FTDI (D2XX)")
        self.dev = ftd2xx.openEx(serial.encode()) if serial else ftd2xx.open(0)
        d = self.dev
        d.resetDevice()
        d.setBaudRate(250000)
        d.setDataCharacteristics(8, 2, 0)        # 8 bits, 2 stop bits, no parity
        d.setFlowControl(0, 0, 0)                # no flow control
        d.clrRts()
        d.purge(3)                               # RX + TX
        d.setLatencyTimer(2)
        d.setTimeouts(200, 200)
        info = d.getDeviceInfo()
        desc = (info.get("description") or b"").decode(errors="ignore")
        ser = (info.get("serial") or b"").decode(errors="ignore")
        self.status = f"OPEN DMX · FTDI D2XX · {desc} · {ser}"
        self.label = f"{desc or 'FTDI'} · D2XX"
        self.serial = ser
        self.desc = desc
        self._busy_until = 0.0
        self._stuck = 0

    def send(self, data: bytes) -> None:
        wait = self._busy_until - time.perf_counter()
        if wait > 0.003:
            time.sleep(wait - 0.002)             # most of the wait without burning the CPU
        wait = self._busy_until - time.perf_counter()
        if wait > 0:
            _spin_wait(wait)                     # previous frame still on the wire
        d = self.dev
        if self._stuck_check():
            raise RuntimeError("kabel nie wysyła danych (bufor USB stoi) - wyjmij i włóż kabel USB")
        d.setBreakOn()
        _spin_wait(0.00012)
        d.setBreakOff()
        _spin_wait(0.00002)
        payload = b"\x00" + bytes(data)
        n = d.write(payload)
        if n is not None and n < len(payload):
            raise RuntimeError(f"kabel przyjął {n} z {len(payload)} bajtów")
        # the chip starts sending up to 1-2 ms after write() returns: keep a margin before the next BREAK
        self._busy_until = time.perf_counter() + len(payload) * 11 / 250000.0 + 0.0015

    def tx_queue(self) -> int:
        try:
            return int(self.dev.getStatus()[1])
        except Exception:
            return -1

    def _stuck_check(self) -> bool:
        """Bytes piling up in the driver = the chip does not transmit (cable half-dead / wrong mode)."""
        q = self.tx_queue()
        self._stuck = self._stuck + 1 if q > 2048 else 0
        return self._stuck > 25

    def close(self) -> None:
        try:
            self.dev.close()
        except Exception:
            pass


def d2xx_devices() -> list[dict[str, str]]:
    """FTDI devices visible to the D2XX driver (empty when ftd2xx is not installed)."""
    try:
        import ftd2xx
    except Exception:
        return []
    out = []
    try:
        for i in range(ftd2xx.createDeviceInfoList()):
            info = ftd2xx.getDeviceInfoDetail(i)
            out.append({"index": i, "serial": info["serial"].decode(errors="ignore"),
                        "description": info["description"].decode(errors="ignore"),
                        "busy": bool(info["flags"] & 1)})
    except Exception:
        pass
    return out


class ArtNetOutput(DMXOutput):
    """Art-Net 4 ArtDmx (OpCode 0x5000) over UDP/6454."""
    name = "artnet"

    def __init__(self, ip: str, universe: int, use_lib: bool = False):
        self.ip, self.universe, self.seq = ip, universe & 0x7FFF, 0
        self._lib = None
        if use_lib:
            from stupidArtnet import StupidArtnet
            self._lib = StupidArtnet(ip, universe, 512, int(DMX_REFRESH_HZ), True,
                                     ip.endswith(".255"))
        else:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        self.status = f"ART-NET → {ip} · U{universe}" + (" (stupidArtnet)" if use_lib else "")
        self.label = f"ART-NET {ip} · U{universe}"

    def send(self, data: bytes) -> None:
        if self._lib is not None:
            self._lib.set(bytearray(data))
            self._lib.show()
            return
        self.seq = self.seq % 255 + 1
        if len(data) % 2:
            data += b"\x00"
        pkt = (b"Art-Net\x00" + struct.pack("<H", 0x5000) + struct.pack(">H", 14)
               + bytes([self.seq, 0]) + struct.pack("<H", self.universe)
               + struct.pack(">H", len(data)) + data)
        self.sock.sendto(pkt, (self.ip, 6454))

    def close(self) -> None:
        if self._lib is None:
            self.sock.close()


def create_output() -> DMXOutput:
    global DMX_SERIAL_PORT
    if not ENABLE_PHYSICAL_DMX:
        return NullOutput()
    if DMX_BACKEND in ("enttec", "opendmx"):
        # never try to talk DMX through a motherboard COM port - pick the USB adapter
        ports = list_serial_ports()
        if ports and not any(p["device"] == DMX_SERIAL_PORT and p["usb"] for p in ports):
            best = next((p for p in ports if p["recommended"]), None) or next((p for p in ports if p["usb"]), None)
            if best:
                log.info("DMX port %s -> %s (%s)", DMX_SERIAL_PORT, best["device"], best["description"])
                DMX_SERIAL_PORT = best["device"]
    try:
        if DMX_BACKEND == "enttec":
            return EnttecProOutput(DMX_SERIAL_PORT)
        if DMX_BACKEND == "opendmx":
            try:
                return FtdiD2xxOpenDmxOutput()          # native FTDI driver first
            except Exception as e:
                log.warning("D2XX unavailable (%s) - using COM port %s", e, DMX_SERIAL_PORT)
                return OpenDmxOutput(DMX_SERIAL_PORT)
        if DMX_BACKEND == "udmx":
            return UDMXOutput()
        if DMX_BACKEND == "artnet":
            return ArtNetOutput(ARTNET_TARGET_IP, ARTNET_UNIVERSE, ARTNET_USE_STUPIDARTNET)
        raise ValueError(f"unknown DMX_BACKEND '{DMX_BACKEND}'")
    except Exception as e:  # keep running in simulation, but surface the error in the UI
        log.error("Physical DMX output failed (%s) – falling back to simulation", e)
        out = NullOutput()
        out.ok = False
        out.status = f"DMX ERROR ({DMX_BACKEND}): {e}"
        out.label = f"{DMX_BACKEND.upper()} FAILED"
        return out


def list_serial_ports() -> list[dict[str, Any]]:
    """COM / tty ports for the UI picker.

    USB adapters (FTDI, CH340, Prolific …) are listed first and flagged: a
    motherboard COM port cannot do the 250 kbaud that DMX needs.
    """
    try:
        from serial.tools import list_ports
    except ImportError:
        return []
    out = []
    for p in list_ports.comports():
        hw = (p.hwid or "").upper()
        usb = bool(getattr(p, "vid", None)) or "USB" in hw
        out.append({"device": p.device, "description": p.description or "",
                    "usb": usb, "vid": getattr(p, "vid", None), "pid": getattr(p, "pid", None),
                    "serial": getattr(p, "serial_number", None) or "",
                    "recommended": usb and any(k in (p.description or "").upper() + hw
                                               for k in ("FTDI", "FT232", "USB SERIAL", "CH340", "CP210"))})
    out.sort(key=lambda d: (not d["recommended"], not d["usb"], d["device"]))
    return out


# =============================================================================
# ENGINE
# =============================================================================
Ids = Any  # None = active fixture, "all", int, or iterable of ints


class DMXEngine:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.fixtures: dict[int, Fixture] = {}
        self.active_id: int | None = None
        self.blackout: bool = False                 # lights keep their saved values; lasers stay locked
        self.lasers_enabled: bool = False           # lasers always start disarmed
        self.test_channels: dict[int, int] = {}     # manual channel test: {dmx channel (1-512): value}
        self.pre_tick: list = []                    # callbacks run each tick before smoothing (effects)
        # "direct": finger X/Y → pan/tilt around home (works without any stage calibration)
        # "stage":  finger → floor point (camera homography) → inverse kinematics
        self.aim_mode: str = "direct"
        self.aim_span = [270.0, 120.0]              # degrees covered by the full pointing zone
        self.aim_zone = 0.15                        # frame margin that still reaches the ends
        self.aim_box: list[float] | None = None     # calibrated reach of the pointing hand [x0, y0, x1, y1]
        self.selection: list[int] = []              # lamps picked in the 3-D view (effects can target "sel")
        self._unloaded: list[dict] = []             # damaged fixture entries, kept verbatim in config.json
        self.released = False                       # cable given to another program (QLC+)
        self.motor_speed: int | None = None         # P/T speed channel for every lamp (0 = fastest)
        self._hold: dict[tuple[int, str], float] = {}  # (fixture, group) → time until effects must wait
        self._fits: dict[tuple[int, str], Any] = {}      # cached person-calibration fits
        self._fades: dict[int, tuple] = {}                # look recall fades
        self.grand_master: int = 255
        self.position_smoothing: float = 0.45       # 0..1 per tick (1 = no smoothing)
        self.value_smoothing: float = 0.55
        self.short_frames: bool = False             # True = only the used channels (faster, some lamps ignore it)
        self.universe = bytearray(512)
        self.stage = stage_mod.Stage()
        self.last_target: list[float] | None = None   # last aimed world point (for the 3D view)
        self.output: DMXOutput = NullOutput()
        self._next_id = 1
        self._running = False
        self._thread: threading.Thread | None = None
        self.frames_sent = 0
        self.send_hz = 0.0
        self.reconfiguring = False
        self.probe_label = ""
        self._last_send = 0.0
        self._last_retry = 0.0

    # ---- lifecycle ------------------------------------------------------------
    def start(self) -> None:
        self.output = create_output()
        log.info("DMX output: %s", self.output.status)
        self._running = True
        self._thread = threading.Thread(target=self._loop, name="dmx-engine", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=1)
        try:
            if BLACKOUT_ON_EXIT and ENABLE_PHYSICAL_DMX:
                with self.lock:
                    self._render(force_blackout=True)
                    self.output.send(bytes(self.universe))
            self.output.close()
        except Exception:
            pass

    def _loop(self) -> None:
        period = 1.0 / DMX_REFRESH_HZ
        nxt = time.perf_counter()
        while self._running:
            with self.lock:
                if self._fades:
                    self._run_fades()
                for cb in self.pre_tick:
                    try:
                        cb()
                    except Exception:
                        log.exception("pre-tick callback failed")
                for f in self.fixtures.values():
                    f.step(self.position_smoothing, self.value_smoothing)
                self._render()
                data = bytes(self.universe)
                if self.output.name == "opendmx" and self.short_frames:   # optional: only the used channels
                    data = data[:self.frame_len()]
            try:
                self.output.send(data)
                self.frames_sent += 1
                if not self.output.ok and self.output.name not in ("simulation", "released"):
                    self.output.ok = True
            except Exception as e:
                if self.output.ok:
                    log.error("DMX send failed: %s", e)
                self.output.ok = False
                self.output.status = f"DMX SEND ERROR: {e}"
            now = time.perf_counter()
            if self._last_send:
                self.send_hz = self.send_hz * 0.9 + 0.1 / max(1e-4, now - self._last_send)
            self._last_send = now
            if (ENABLE_PHYSICAL_DMX and not self.output.ok and not self.reconfiguring and not self.released
                    and now - self._last_retry > 3.0):
                self._last_retry = now            # cable re-plugged → reconnect on its own
                try:
                    try:
                        self.output.close()
                    except Exception:
                        pass
                    new = create_output()
                    self.output = new
                    if new.ok:
                        log.info("DMX output reconnected: %s", new.status)
                except Exception:
                    pass
            nxt += period
            delay = nxt - time.perf_counter()
            if delay > 0:
                time.sleep(delay)
            else:
                nxt = time.perf_counter()

    def reconfigure_output(self, backend: str, port: str | None = None, ip: str | None = None,
                           universe: int | None = None) -> None:
        """Switch the DMX interface at runtime (blocking - call from a worker thread).

        backend: "sim" | "artnet" | "enttec" | "opendmx"
        """
        global ENABLE_PHYSICAL_DMX, DMX_BACKEND, DMX_SERIAL_PORT, ARTNET_TARGET_IP, ARTNET_UNIVERSE
        backend = backend.lower()
        if backend not in ("sim", "artnet", "enttec", "opendmx", "udmx"):
            raise ValueError(f"unknown DMX backend '{backend}'")
        if port:
            DMX_SERIAL_PORT = port
        if ip:
            ARTNET_TARGET_IP = ip
        if universe is not None and str(universe) != "":
            ARTNET_UNIVERSE = int(universe)
        was_physical = ENABLE_PHYSICAL_DMX
        self.probe_label = (f"PROBING {DMX_SERIAL_PORT}" if backend in ("enttec", "opendmx")
                            else f"BINDING {ARTNET_TARGET_IP}" if backend == "artnet"
                            else "PROBING USB" if backend == "udmx" else "LOOPBACK")
        self.reconfiguring = True
        try:
            time.sleep(0.4)                       # let the UI show the handshake state
            ENABLE_PHYSICAL_DMX = backend != "sim"
            if ENABLE_PHYSICAL_DMX:
                DMX_BACKEND = backend
            with self.lock:                        # release the port first - it is exclusive
                old, self.output = self.output, NullOutput()
            try:
                old.close()
            except Exception:
                pass
            time.sleep(0.2)
            new = create_output()
            with self.lock:
                self.output = new
            log.info("DMX output: %s", new.status)
        finally:
            self.reconfiguring = False

    def release_output(self) -> None:
        """Give the cable to another program: close the port, keep the settings (they stay in config)."""
        if self.released:
            return
        with self.lock:
            old, self.output = self.output, ReleasedOutput()
        try:
            old.close()
        except Exception:
            pass
        self.released = True
        log.info("DMX cable released for another program")

    def take_output(self) -> None:
        """Take the cable back with the settings used before."""
        self.released = False
        self.reconfigure_output(DMX_BACKEND if ENABLE_PHYSICAL_DMX else "sim", DMX_SERIAL_PORT, ARTNET_TARGET_IP, ARTNET_UNIVERSE)

    def output_state(self) -> str:
        if self.reconfiguring:
            return "connecting"
        return "online" if self.output.ok else "offline"

    def _render(self, force_blackout: bool = False) -> None:
        self.universe[:] = bytes(512)
        master = 0.0 if (self.blackout or force_blackout) else self.grand_master / 255.0
        lasers = self.lasers_enabled and not (self.blackout or force_blackout)
        for f in self.fixtures.values():
            f.render(self.universe, master, lasers)
        if not (self.blackout or force_blackout):      # channel test overrides the fixtures
            for ch, val in self.test_channels.items():
                if 1 <= ch <= 512:
                    self.universe[ch - 1] = val

    def frame_len(self) -> int:
        hi = max((f.address + f.footprint - 1 for f in self.fixtures.values()), default=0)
        if self.test_channels:
            hi = max(hi, max(self.test_channels))
        return min(512, max(128, (hi + 31) // 32 * 32))

    # ---- looks: saved states of the lamps, recalled with a smooth fade ------------------
    LOOK_PARAMS = ("pan", "tilt", "dimmer", "strobe", "red", "green", "blue", "cwheel", "gobo", "spin", "beam", "speed")

    def look_capture(self, ids: Ids = "all") -> dict[str, dict[str, float]]:
        with self.lock:
            return {str(i): {k: round(float(self.fixtures[i].target[k]), 1) for k in self.LOOK_PARAMS}
                    for i in self.lights(ids)}

    def look_recall(self, values: dict[str, dict[str, float]], fade: float = 1.0) -> None:
        with self.lock:
            now = time.monotonic()
            for sid, vals in values.items():
                i = int(sid)
                if i not in self.fixtures:
                    continue
                f = self.fixtures[i]
                start = {k: float(f.target[k]) for k in vals if k in f.target}
                if fade <= 0.05:
                    f.target.update({k: float(v) for k, v in vals.items() if k in f.target})
                else:
                    self._fades[i] = (now, max(0.05, float(fade)), start, {k: float(v) for k, v in vals.items() if k in f.target})
                for grp in ("move", "dim", "color", "strobe", "beam"):
                    self._hold[(i, grp)] = now + max(0.3, fade) + 0.3

    def _run_fades(self) -> None:
        now = time.monotonic()
        for i, (t0, dur, start, end) in list(self._fades.items()):
            f = self.fixtures.get(i)
            u = min(1.0, (now - t0) / dur)
            e = u * u * (3 - 2 * u)
            if f is not None:
                for k, v in end.items():
                    f.target[k] = start[k] + (v - start[k]) * e
            if u >= 1.0:
                del self._fades[i]

    # ---- id helpers ---------------------------------------------------------------
    NON_LIGHT = ("smoke", "laser")

    def lights(self, ids: Ids) -> list[int]:
        """Like resolve(), but "all" / "sel" / None skip smoke machines and lasers
        (effects, the spotlight and whole-rig gestures must never fire them)."""
        ids_l = self.resolve(ids)
        if isinstance(ids, (list, tuple)) or isinstance(ids, int):
            return ids_l
        return [i for i in ids_l if self.fixtures[i].type not in self.NON_LIGHT]

    def resolve(self, ids: Ids) -> list[int]:
        with self.lock:
            if ids is None:
                return [self.active_id] if self.active_id in self.fixtures else []
            if ids == "all":
                return [i for i, f in self.fixtures.items() if f.enabled]
            if ids == "sel":
                sel = [i for i in self.selection if i in self.fixtures]
                return sel or ([self.active_id] if self.active_id in self.fixtures else [])
            if isinstance(ids, int):
                return [ids] if ids in self.fixtures else []
            return [i for i in ids if i in self.fixtures]

    def flip(self, fid: int, axis: str) -> bool:
        """Gesture direction wrong? Flip it (pointing mode and the 3-D aiming both follow)."""
        with self.lock:
            f = self.fixtures[fid]
            if axis == "x":
                f.flip_x, f.invert_pan = not f.flip_x, not f.invert_pan
                return f.flip_x
            f.flip_y, f.invert_tilt = not f.flip_y, not f.invert_tilt
            return f.flip_y

    # ---- fixture management -----------------------------------------------------
    def next_free_address(self) -> int:
        with self.lock:
            end = max((f.address + f.footprint for f in self.fixtures.values()), default=1)
            return min(end, 512)

    def free_address(self, footprint: int, skip: int | None = None) -> int | None:
        """First address where `footprint` channels fit without touching another device."""
        with self.lock:
            used = set()
            for f in self.fixtures.values():
                if f.id != skip:
                    used.update(range(f.address, f.address + f.footprint))
            for a in range(1, 514 - footprint):
                if not any(c in used for c in range(a, a + footprint)):
                    return a
            return None

    def add_fixture(self, **kw: Any) -> Fixture:
        with self.lock:
            fid = int(kw.pop("id", 0) or 0) or self._next_id
            while fid in self.fixtures:
                fid += 1
            self._next_id = max(self._next_id, fid + 1)
            values = kw.pop("values", None) or {}
            kw.setdefault("name", f"MH-{fid}")
            auto_address = not kw.get("address")
            if auto_address:
                kw["address"] = 1
            kw["address"] = int(_clamp(int(kw["address"]), 1, 512))
            if "pos" not in kw:
                n = len(self.fixtures)
                kw["pos"] = [round(-4.0 + (n % 5) * 2.0, 2), self.stage.truss_height, -2.5]
            f = Fixture.from_config({"id": fid, **kw, "values": values})
            if auto_address:
                address = self.free_address(f.footprint)
                if address is None:
                    raise ValueError("Brak wolnego zakresu DMX dla tego urządzenia (512 kanałów).")
                f.address = address
            if f.address + f.footprint - 1 > 512:
                raise ValueError("Urządzenie wykracza poza zakres DMX 1–512.")
            if f.mount == "floor" and "pan" not in values:
                f.aim([0.0, 0.0, 0.0])      # a standing head at rest points at the sky; aim at centre stage
                f.snap()
            self.fixtures[fid] = f
            if "icon_x" not in kw:
                self.relayout_icons()
            if self.active_id is None:
                self.active_id = fid
            return f

    def update_fixture(self, fid: int, **kw: Any) -> None:
        with self.lock:
            f = self.fixtures[fid]
            for key in ("name", "pan_16bit", "tilt_16bit", "has_rgb", "icon_x", "icon_y",
                        "shutter_open", "strobe_min", "strobe_max", "model", "type",
                        "library_key", "mount", "yaw", "pan_deg",
                        "tilt_deg", "invert_pan", "invert_tilt", "beam_deg", "flip_x", "flip_y", "enabled"):
                if key in kw and kw[key] is not None:
                    setattr(f, key, type(getattr(f, key))(kw[key]))
            if kw.get("address"):
                f.address = int(_clamp(int(kw["address"]), 1, 512))
            if kw.get("pos"):
                f.pos = [float(v) for v in kw["pos"][:3]]
            for key in ("wheel", "gobos", "caps", "defaults"):
                if key in kw:
                    setattr(f, key, kw[key] or None)
            for key in ("aim_pan", "aim_tilt", "show_home"):
                if key in kw:
                    setattr(f, key, [float(v) for v in kw[key][:2]] if kw[key] else None)
            f.pan_deg = max(1.0, f.pan_deg)
            f.tilt_deg = max(1.0, f.tilt_deg)
            if "channels" in kw:
                ch = kw["channels"]
                if isinstance(ch, str):
                    ch = [c.strip().lower() for c in ch.split(",") if c.strip()]
                f.channels = ch or None

    def remove_fixture(self, fid: int) -> None:
        with self.lock:
            self.fixtures.pop(fid, None)
            self.selection = [i for i in self.selection if i != fid]
            if self.active_id == fid:
                self.active_id = next(iter(self.fixtures), None)
            self.relayout_icons()

    def relayout_icons(self) -> None:
        """Spread selection targets evenly along the top edge of the video frame."""
        with self.lock:
            fx = sorted(self.fixtures.values(), key=lambda f: f.id)
            n = len(fx)
            for i, f in enumerate(fx):
                f.icon_x = (i + 1) / (n + 1)
                f.icon_y = 0.22

    def address_conflicts(self) -> list[str]:
        with self.lock:
            used: dict[int, str] = {}
            out = []
            for f in self.fixtures.values():
                for ch in range(f.address, f.address + f.footprint):
                    if ch in used:
                        out.append(f"{f.name} ch{ch} overlaps {used[ch]}")
                        break
                    used[ch] = f.name
            return out

    # ---- control ---------------------------------------------------------------------
    def select(self, fid: int) -> None:
        with self.lock:
            if fid in self.fixtures:
                self.active_id = fid

    def set_param(self, ids: Ids, param: str, value: float) -> None:
        with self.lock:
            for i in self.resolve(ids):
                self.fixtures[i].set(param, value)

    def set_params(self, ids: Ids, values: dict[str, float]) -> None:
        with self.lock:
            rgb = all(c in values for c in ("red", "green", "blue"))
            for i in self.resolve(ids):
                f = self.fixtures[i]
                for k, v in values.items():
                    if k == "cwheel" and rgb and f.wheel:       # named slot instead of a raw value
                        v = f.wheel_for(values["red"], values["green"], values["blue"])
                    f.set(k, v)
                if rgb and f.wheel and "cwheel" not in values:  # colour picked anywhere → wheel follows
                    f.set("cwheel", f.wheel_for(values["red"], values["green"], values["blue"]))

    def get_values(self, ids: Ids, param: str) -> dict[int, float]:
        with self.lock:
            return {i: self.fixtures[i].target[param] for i in self.resolve(ids)}

    def aim(self, ids: Ids, point: list[float]) -> None:
        """Aim fixtures at a world point [x, y, z] (metres)."""
        with self.lock:
            self.last_target = [float(v) for v in point]
            for i in self.resolve(ids):
                self.fixtures[i].aim(point)

    # ---- live control beats effects ------------------------------------------------
    def hold(self, ids: Ids, group: str, seconds: float = 0.7) -> None:
        """A gesture / fader just set this group (move, dim, color, strobe): effects pause on it."""
        until = time.monotonic() + seconds
        for i in self.resolve(ids):
            self._hold[(i, group)] = until

    def is_held(self, fid: int, group: str) -> bool:
        return self._hold.get((fid, group), 0.0) > time.monotonic()

    def set_position_norm(self, ids: Ids, x: float, y: float, height: float = 0.0) -> None:
        """Point the light where a normalised camera-image position says.

        direct: X → pan, Y → tilt around the home position (instant, no calibration)
        stage:  floor point under (x, y) via the camera homography + inverse kinematics
        """
        if self.aim_mode == "direct":
            with self.lock:
                for i in self.resolve(ids):
                    f = self.fixtures[i]
                    f.target["pan"], f.target["tilt"] = self.direct_pt(f, x, y)
            return
        X, Z = self.stage.image_to_floor(_clamp(x, 0, 1), _clamp(y, 0, 1))
        self.aim(ids, [X, height, Z])

    def direct_pt(self, f: Fixture, x: float, y: float) -> tuple[float, float]:
        """Pan / tilt of the pointing mapping for camera point (x, y) - without moving the lamp."""
        z = self.aim_zone
        bx0, by0, bx1, by1 = self.aim_box or (z, z, 1 - z, 1 - z)
        x01 = _clamp((x - bx0) / max(0.05, bx1 - bx0), 0, 1)
        y01 = _clamp((y - by0) / max(0.05, by1 - by0), 0, 1)
        if f.flip_x:
            x01 = 1 - x01
        if f.flip_y:
            y01 = 1 - y01
        if f.aim_pan:                                  # calibrated corners: exact room coverage
            pan = f.aim_pan[0] + x01 * (f.aim_pan[1] - f.aim_pan[0])
        else:
            pan = HOME_16 + (x01 - 0.5) * self.aim_span[0] / f.pan_deg * 65535
        if f.aim_tilt:
            tilt = f.aim_tilt[0] + y01 * (f.aim_tilt[1] - f.aim_tilt[0])
        else:
            tilt = HOME_16 + (y01 - 0.5) * self.aim_span[1] / f.tilt_deg * 65535
        return _clamp(pan, 0, 65535), _clamp(tilt, 0, 65535)

    def set_axis_norm(self, ids: Ids, axis: str, u: float) -> None:
        """One axis only (pan or tilt) from 0..1 - used by "pose + motion" gestures."""
        u = _clamp(u, 0, 1)
        with self.lock:
            for i in self.resolve(ids):
                f = self.fixtures[i]
                if (f.flip_x if axis == "pan" else f.flip_y):
                    u = 1 - u
                cal = f.aim_pan if axis == "pan" else f.aim_tilt
                span = self.aim_span[0 if axis == "pan" else 1]
                rng = f.pan_deg if axis == "pan" else f.tilt_deg
                if cal:
                    f.target[axis] = _clamp(cal[0] + u * (cal[1] - cal[0]), 0, 65535)
                else:
                    f.target[axis] = _clamp(HOME_16 + (u - 0.5) * span / rng * 65535, 0, 65535)

    # ---- person calibration -------------------------------------------------------------
    def aim_point_add(self, ids: Ids, x: float, y: float, cam: str = "main") -> int:
        """The light hits the person standing at camera point (x, y): remember this pan / tilt."""
        with self.lock:
            n = 0
            for i in self.resolve(ids):
                f = self.fixtures[i]
                pts = (f.aim_points or {}).get(cam, [])
                pts = [p for p in pts if abs(p[0] - x) > 0.02 or abs(p[1] - y) > 0.02]   # same spot → replace
                pts.append([round(float(x), 4), round(float(y), 4), float(f.target["pan"]), float(f.target["tilt"])])
                f.aim_points = {**(f.aim_points or {}), cam: pts[-16:]}
                self._fits.pop((i, cam), None)
                n += 1
            return n

    def aim_point_clear(self, ids: Ids, cam: str | None = None) -> None:
        with self.lock:
            for i in self.resolve(ids):
                f = self.fixtures[i]
                if cam is None:
                    f.aim_points = None
                elif f.aim_points:
                    f.aim_points.pop(cam, None)
                for c in ("main", "stage"):
                    self._fits.pop((i, c), None)

    def aim_person(self, ids: Ids, x: float, y: float, cam: str = "main",
                   fallback: Any = None) -> None:
        """Point at a person standing at camera point (x, y) = their feet.

        Lamps with a person calibration for this camera use it (exact); the others use
        ``fallback(fixture_id)`` or the pointing mapping."""
        with self.lock:
            for i in self.resolve(ids):
                f = self.fixtures[i]
                pts = (f.aim_points or {}).get(cam)
                fit = None
                if pts and len(pts) >= 3:
                    key = (i, cam)
                    fit = self._fits.get(key)
                    if fit is None or fit.get("n") != len(pts):
                        fit = fit_aim(pts)
                        if fit:
                            fit["n"] = len(pts)
                        self._fits[key] = fit
                if fit:
                    f.target["pan"], f.target["tilt"] = eval_aim(fit, x, y)
                elif pts and fallback is None:           # 1-2 saved spots: pointing mapping + their average offset
                    dp = dt = 0.0
                    for px, py, pp, pt in pts:
                        a, b = self.direct_pt(f, px, py)
                        dp += pp - a
                        dt += pt - b
                    a, b = self.direct_pt(f, x, y)
                    f.target["pan"] = _clamp(a + dp / len(pts), 0, 65535)
                    f.target["tilt"] = _clamp(b + dt / len(pts), 0, 65535)
                elif fallback is not None:
                    fallback(i)
                else:
                    self.set_position_norm(i, x, y)

    def chan_set(self, fid: int, index: int, value: int) -> None:
        """Desk fader on one channel of a lamp (repeated roles like 4 beam motors, the white LED)."""
        with self.lock:
            f = self.fixtures.get(fid)
            if f and 0 <= index < f.footprint:
                f.overrides[index] = int(_clamp(value, 0, 255))

    def chan_auto(self, fid: int | None, index: int | None = None) -> None:
        """Give channels back to the lamp logic (effects, gestures, colours)."""
        with self.lock:
            for f in ([self.fixtures[fid]] if fid in self.fixtures else self.fixtures.values()):
                if index is None:
                    f.overrides.clear()
                else:
                    f.overrides.pop(index, None)

    def home(self, ids: Ids = "all") -> None:
        self.set_params(ids, {"pan": HOME_16, "tilt": HOME_16})

    def zero(self) -> None:
        """Reset every fixture to a safe zero state immediately (no fade)."""
        with self.lock:
            for f in self.fixtures.values():
                f.target.update({"pan": HOME_16, "tilt": HOME_16, "dimmer": 0, "strobe": 0,
                                 "red": 255, "green": 255, "blue": 255})
                f.target.update({k: 0 for k in ("speed", "spin", "beam", "laser", "strip",
                                                "strip_speed", "macro", "aux1", "aux2",
                                                "cwheel", "gobo")})
                f.overrides.clear()
                f.snap()

    def crossfade(self, pos: float, level: float = 255) -> None:
        """pos 0..1 sweeps a 'light window' across fixtures ordered left→right."""
        with self.lock:
            fx = sorted(self.fixtures.values(), key=lambda f: (f.pos[0], f.id))
            n = len(fx)
            if not n:
                return
            p = _clamp(pos, 0, 1) * (n - 1)
            for i, f in enumerate(fx):
                f.target["dimmer"] = level * max(0.0, 1.0 - abs(p - i)) if n > 1 else level

    def _spot(self, f: Fixture) -> dict[str, Any] | None:
        """Where the beam lands: floor point + its projection into the camera image."""
        hit = stage_mod.floor_hit(f, f.current["pan"], f.current["tilt"])
        if hit is None:
            return None
        X, Z, dist = hit
        r = dist * math.tan(math.radians(f.beam_deg / 2))
        img = self.stage.floor_to_image(X, Z)
        edge = self.stage.floor_to_image(X + r, Z)
        r_img = abs(edge[0] - img[0]) if (img and edge) else None
        return {"floor": [round(X, 3), round(Z, 3)], "r": round(r, 3),
                "img": [round(img[0], 4), round(img[1], 4)] if img else None,
                "r_img": round(r_img, 4) if r_img else None}

    def fixture_at(self, x: float, y: float, radius: float, aspect: float) -> int | None:
        with self.lock:
            best, best_d = None, radius
            for f in self.fixtures.values():
                d = (((x - f.icon_x) * aspect) ** 2 + (y - f.icon_y) ** 2) ** 0.5
                if d < best_d:
                    best, best_d = f.id, d
            return best

    # ---- persistence / state -----------------------------------------------------------
    def load_config(self, fixtures: list[dict] | None, engine_cfg: dict | None = None) -> None:
        with self.lock:
            self.fixtures.clear()
            self.active_id = None
            # fresh start = empty stage; the user places fixtures in the 3D view
            self._unloaded = []
            for fc in (fixtures or []):
                try:
                    self.add_fixture(**dict(fc))
                except Exception:
                    # never lose a device because one entry is damaged: keep it for the next save
                    log.exception("fixture %r could not be loaded - kept in config.json", fc.get("name"))
                    self._unloaded.append(dict(fc))
            ec = engine_cfg or {}
            if ec.get("stage"):
                st = ec["stage"]
                self.stage = stage_mod.Stage(st.get("width", 10), st.get("depth", 8),
                                             st.get("truss_height", 5), st.get("aim_height", 1.2),
                                             st.get("quad"))
            self.grand_master = int(ec.get("grand_master", self.grand_master))
            self.position_smoothing = float(ec.get("position_smoothing", self.position_smoothing))
            if ec.get("active_id") in self.fixtures:
                self.active_id = ec["active_id"]
            self.aim_mode = ec.get("aim_mode", self.aim_mode)
            self.aim_span = list(ec.get("aim_span", self.aim_span))
            self.aim_box = ec.get("aim_box") or None
            self.value_smoothing = float(ec.get("value_smoothing", self.value_smoothing))
            self.motor_speed = ec.get("motor_speed")
            self.short_frames = bool(ec.get("short_frames", False))
            self.selection = [i for i in ec.get("selection", []) if i in self.fixtures]
            if self.motor_speed is not None:
                for f in self.fixtures.values():
                    f.target["speed"] = f.current["speed"] = float(self.motor_speed)

    def to_config(self) -> dict[str, Any]:
        with self.lock:
            return {
                "engine": {"stage": self.stage.to_config(),
                           "grand_master": self.grand_master,
                           "position_smoothing": self.position_smoothing,
                           "active_id": self.active_id,
                           "aim_mode": self.aim_mode, "aim_span": self.aim_span,
                           "aim_box": self.aim_box, "value_smoothing": self.value_smoothing,
                           "motor_speed": self.motor_speed, "selection": self.selection,
                           "short_frames": self.short_frames},
                "fixtures": [f.to_config() for f in sorted(self.fixtures.values(), key=lambda f: f.id)]
                            + self._unloaded,
            }

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            end = max((f.address + f.footprint - 1 for f in self.fixtures.values()), default=0)
            n = min(512, max(32, (end + 15) // 16 * 16))
            fx_states = []
            for f in sorted(self.fixtures.values(), key=lambda f: f.id):
                s = f.to_state()
                s["spot"] = self._spot(f)
                fx_states.append(s)
            return {
                "fixtures": fx_states,
                "stage": self.stage.state(),
                "target": self.last_target,
                "active_id": self.active_id,
                "blackout": self.blackout,
                "lasers_enabled": self.lasers_enabled,
                "aim_mode": self.aim_mode, "aim_span": self.aim_span, "aim_box": self.aim_box,
                "selection": [i for i in self.selection if i in self.fixtures],
                "motor_speed": self.motor_speed, "value_smoothing": round(self.value_smoothing, 3),
                "test_channels": {str(k): v for k, v in self.test_channels.items()},
                "grand_master": self.grand_master,
                "position_smoothing": round(self.position_smoothing, 3),
                "dmx": {
                    "physical": ENABLE_PHYSICAL_DMX,
                    "backend": self.output.name,
                    "status": self.output.status,
                    "ok": self.output.ok,
                    "state": self.output_state(),
                    "label": self.probe_label if self.reconfiguring else self.output.label,
                    "send_hz": round(self.send_hz, 1),
                    "released": self.released,
                    "short_frames": self.short_frames,
                    "frame": (self.frame_len() if self.short_frames else 512) if self.output.name == "opendmx" else 512,
                    "config": {"backend": DMX_BACKEND if ENABLE_PHYSICAL_DMX else "sim",
                               "port": DMX_SERIAL_PORT, "ip": ARTNET_TARGET_IP,
                               "universe": ARTNET_UNIVERSE},
                    "refresh_hz": DMX_REFRESH_HZ,
                    "universe": list(self.universe[:n]),
                    "conflicts": self.address_conflicts(),
                },
            }


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as e:
        log.error("Cannot read %s: %s", path, e)
        return {}


def save_json(path: Path, data: dict[str, Any]) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


__all__ = ["Fixture", "DMXEngine", "HOME_16", "load_json", "save_json", "list_serial_ports",
           "d2xx_devices"]
