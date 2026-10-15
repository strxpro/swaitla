"""
effects.py
==========
Effect generator (movement / colour / intensity / gobo) and beat reactions.

Effects run inside the DMX engine tick (40 Hz), so they are sample-accurate to
the DMX output and never fight the UI thread.  Every effect remembers the
fixture values it touched and restores them when it stops.

Categories and kinds
  move   circle, figure8, sweep, tilt_wave, random, square, triangle, spiral,
         bounce, fan, position, path (user-drawn shape),
         ballyhoo, crossfire, searchlight, fly_out, mirror, rise, shape_morph (concert / film looks)
  color  rainbow, two_color, static_color, chase, fire, ocean, gradient, sequence,
         color_morph, split, sunrise, aurora, police, candle, noir, desaturate
  dim    pulse, flash, strobe, fade_in, fade_out, breathe, blink, sparkle, saw,
         heartbeat, pattern (16-step user pattern), dark,
         hit (one hit that fades to black by the end), kicks (a hit on every kick, dark in between),
         lightning, riser, stack, chase_beat, stutter, twinkle, blinder

Keyframe envelope (every effect): ``fade_in`` / ``fade_out`` seconds + ``ease``
(linear | smooth | in | out) blend from the lamp's previous look into the effect
and back - e.g. two "position" keyframes with fade_in = an eased move.
``t_offset`` starts an effect part-way (playing a show from the middle of a keyframe).

Morph: ``morph`` (seconds) or ``morph_beats`` on a new effect that replaces another
one of the same kind of layer keeps the old effect running and cross-fades its live
output into the new one - a circle melts into a figure eight, a colour wash into
the next, without a jump.  Colours morph through OKLab (no muddy grey in between).

Beat grid: with a locked :class:`rhythm.RhythmClock` every effect that has ``beats``
takes its phase from the clock, so all of them start their cycles on the same bar
line, and beat reactions fire on the predicted beats (ahead of the sound by the
calibrated light latency) instead of on late detections.

Autopilot: moods calm | dynamic | dance | rave pick movement / colour / intensity
layers every phrase from the user's palette, react to every beat and to drops.
  beam   gobo, gobo_shake, gobo_spin (fixtures with a gobo wheel)

Tempo: every effect with a "speed" (cycles per second) can instead get
``beats`` = cycle length in beats; it then follows the current BPM (live input
or the song on the timeline).

User effects ("presets"): a named stack of layers, e.g. a drawn movement path +
a colour sequence + a 16-step dimmer pattern.  Started as ``preset:<name>``.

Beat reactions (live input or timeline beats)
  flash       short full-brightness flash on every beat
  color_step  next palette colour on every beat
  move_step   jump to a new position on every beat
  strobe_drop strobe burst when a drop is detected
"""

from __future__ import annotations

import colorsys
import json
import math
import random
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from rhythm import RhythmClock

CATEGORY = {
    "circle": "move", "figure8": "move", "sweep": "move", "tilt_wave": "move", "random": "move",
    "square": "move", "triangle": "move", "spiral": "move", "bounce": "move", "fan": "move",
    "position": "move", "path": "move",
    "ballyhoo": "move", "crossfire": "move", "searchlight": "move", "fly_out": "move",
    "mirror": "move", "rise": "move", "shape_morph": "move",
    "rainbow": "color", "two_color": "color", "static_color": "color", "chase": "color",
    "fire": "color", "ocean": "color", "gradient": "color", "sequence": "color",
    "color_morph": "color", "split": "color", "sunrise": "color", "aurora": "color",
    "police": "color", "candle": "color", "noir": "color", "desaturate": "color",
    "pulse": "dim", "flash": "dim", "strobe": "dim", "fade_in": "dim", "fade_out": "dim",
    "breathe": "dim", "blink": "dim", "sparkle": "dim", "saw": "dim", "heartbeat": "dim",
    "pattern": "dim", "dark": "dim", "hit": "dim", "kicks": "dim", "wave": "dim",
    "lightning": "dim", "riser": "dim", "stack": "dim", "chase_beat": "dim", "stutter": "dim",
    "twinkle": "dim", "blinder": "dim", "glow": "dim",
    "gobo": "beam", "gobo_shake": "beam", "gobo_spin": "beam",
    "beat": "dim",                     # flash on every beat (BPM), dark in between
    "laser_hit": "laser", "laser_on": "laser",
}
DEFAULTS: dict[str, dict[str, Any]] = {
    "circle": {"speed": 0.35, "size": 35, "spread": 0.25},
    "figure8": {"speed": 0.3, "size": 35, "spread": 0.25},
    "sweep": {"speed": 0.25, "size": 70, "spread": 0.25},
    "tilt_wave": {"speed": 0.4, "size": 30, "spread": 0.25},
    "random": {"speed": 1.0, "size": 45},
    "square": {"speed": 0.25, "size": 35, "spread": 0.25},
    "triangle": {"speed": 0.3, "size": 35, "spread": 0.33},
    "spiral": {"speed": 0.4, "size": 40, "spread": 0.2},
    "bounce": {"speed": 0.5, "size": 35, "spread": 0.25},
    "fan": {"speed": 0.2, "size": 60},
    "position": {"pan": 0.5, "tilt": 0.5},
    "path": {"speed": 0.25, "size": 45, "spread": 0.0, "points": [[-1, 0], [0, -1], [1, 0], [0, 1]]},
    "rainbow": {"speed": 0.15, "spread": 0.2},
    "two_color": {"speed": 1.0, "color_a": [255, 0, 60], "color_b": [0, 120, 255]},
    "static_color": {"color_a": [0, 140, 255]},
    "chase": {"speed": 2.0, "spread": 0.34},
    "fire": {"speed": 1.0},
    "ocean": {"speed": 0.2, "spread": 0.3},
    "gradient": {"speed": 0.25, "color_a": [255, 0, 90], "color_b": [0, 170, 255], "spread": 0.2},
    "sequence": {"speed": 1.0, "colors": [[255, 0, 0], [0, 255, 0], [0, 0, 255]], "fade": False, "spread": 0.0},
    "pulse": {"speed": 1.0, "min": 0.15, "max": 1.0},
    "flash": {"decay": 0.35},
    "strobe": {"speed": 210},
    "fade_in": {"time": 2.0},
    "fade_out": {"time": 2.0},
    "breathe": {"speed": 0.25, "min": 0.05, "max": 1.0, "spread": 0.0},
    "blink": {"speed": 2.0, "duty": 0.5, "spread": 0.0},
    "sparkle": {"speed": 8.0, "min": 0.0, "max": 1.0},
    "saw": {"speed": 1.0, "spread": 0.0},
    "heartbeat": {"speed": 1.0},
    "pattern": {"speed": 4.0, "steps": [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], "spread": 0.0},
    "dark": {},
    "hit": {"strength": 1.0, "curve": 2.0},
    "wave": {"speed": 1.0, "width": 0.35},
    "kicks": {"hits": [], "floor": 0.0, "curve": 2.2, "max_len": 0.6},
    "beat": {"floor": 0.0, "curve": 2.4, "beats": 1},
    "laser_hit": {"duty": 0.4, "beats": 1, "hits": []},
    "laser_on": {},
    "gobo": {"value": 12},
    "gobo_shake": {"value": 96},
    "gobo_spin": {"value": 192},
    # concert / film movements (size and lift in degrees)
    "ballyhoo": {"speed": 0.25, "size": 50},
    "crossfire": {"speed": 0.3, "size": 45},
    "searchlight": {"speed": 0.1, "size": 40, "lift": 25},
    "fly_out": {"speed": 0.25, "lift": 30, "spread": 0.2},
    "mirror": {"speed": 0.3, "size": 50},
    "rise": {"beats": 16, "speed": 0.06, "lift": 30},
    "shape_morph": {"speed": 0.3, "size": 35, "hold": 2.0, "spread": 0.2},
    "color_morph": {"speed": 0.25, "hold": 0.35, "spread": 0.0},
    "split": {"speed": 0.25, "hold": 0.7},
    "sunrise": {"speed": 0.03, "spread": 0.08},
    "aurora": {"speed": 0.08, "spread": 0.2},
    "police": {"speed": 1.0},
    "candle": {"speed": 1.0},
    "noir": {"speed": 0.06, "spread": 0.15},
    "desaturate": {"beats": 16, "speed": 0.06},
    "lightning": {"speed": 0.4, "floor": 0.08},
    "riser": {"beats": 16, "floor": 0.15},
    "stack": {"beats": 4, "floor": 0.0},
    "chase_beat": {"floor": 0.12, "rate": 1.0, "mirror": False},
    "stutter": {"div": 4, "duty": 0.5, "floor": 0.0},
    "twinkle": {"speed": 3.0, "floor": 0.35, "decay": 0.35},
    "blinder": {"decay": 0.9},
    "glow": {"level": 1.0},
}
AP_IDS = ("ap-move", "ap-color", "ap-dim", "ap-hit", "ap-drop", "ap-laser", "ap-beam", "ap-acc")
KIND_TOUCHES = {"strobe": ("strobe",), "blinder": ("dimmer", "red", "green", "blue")}
SHAPES = ("circle", "figure8", "square", "triangle", "sweep", "tilt_wave")
FAST_COLOR = {"two_color", "police", "chase"}   # hard colour cuts on the beat: no smoothing lag
# film / warm looks with fixed colours (the palette is not used)
SUNRISE = [(110, 6, 0), (255, 45, 0), (255, 120, 15), (255, 185, 80), (255, 225, 170)]
AURORA = [(0, 255, 170), (30, 255, 70), (0, 140, 255), (150, 40, 255)]
NOIR = [(25, 70, 255), (120, 170, 255), (215, 230, 255)]
PALETTE = [(255, 40, 40), (255, 140, 0), (255, 230, 0), (40, 255, 90), (0, 200, 255),
           (40, 90, 255), (170, 60, 255), (255, 50, 190), (255, 255, 255)]
TOUCHES = {"move": ("pan", "tilt"), "color": ("red", "green", "blue", "cwheel"),
           "dim": ("dimmer",), "strobe": ("strobe",), "beam": ("gobo",), "laser": ("laser",)}
PRESETS_PATH = Path(__file__).resolve().parent / "presets.json"
FAST_DIM = {"hit", "kicks", "flash", "blink", "pattern", "sparkle", "beat", "blinder", "lightning",
            "riser", "stack", "chase_beat", "stutter", "twinkle"}   # written straight to the output (no smoothing lag)
EASES = {
    "linear": lambda e: e,
    "smooth": lambda e: e * e * (3 - 2 * e),
    "in": lambda e: e * e,
    "out": lambda e: 1 - (1 - e) * (1 - e),
}
# autopilot: what each mood may play (kind, params); colours come from the palette
MOODS: dict[str, dict[str, Any]] = {
    "calm": {"phrase": 16, "hit": None, "drop": None,
             "move": [("tilt_wave", {"beats": 16, "size": 14}), ("sweep", {"beats": 16, "size": 30}),
                      ("fan", {"beats": 16, "size": 40}), ("figure8", {"beats": 32, "size": 20})],
             "color": [("gradient", {"beats": 16}), ("sequence", {"beats": 8, "fade": True})],
             "dim": [("breathe", {"beats": 8, "min": 0.3}), ("breathe", {"beats": 16, "min": 0.5})]},
    "dynamic": {"phrase": 16, "hit": None, "drop": ("strobe", {"speed": 225}, 2),
                "move": [("figure8", {"beats": 8, "size": 40}), ("square", {"beats": 8, "size": 35}),
                         ("sweep", {"beats": 4, "size": 60}), ("circle", {"beats": 8, "size": 40})],
                "color": [("sequence", {"beats": 2}), ("chase", {"beats": 1}), ("gradient", {"beats": 8})],
                "dim": [("pulse", {"beats": 1, "min": 0.45}), ("breathe", {"beats": 4, "min": 0.4})]},
    "dance": {"phrase": 8, "hit": 0.35, "drop": ("strobe", {"speed": 235}, 2),
              "move": [("bounce", {"beats": 2, "size": 35}), ("circle", {"beats": 4, "size": 45}),
                       ("triangle", {"beats": 4, "size": 40}), ("figure8", {"beats": 4, "size": 45})],
              "color": [("sequence", {"beats": 1}), ("chase", {"beats": 1})],
              "dim": []},
    "hits": {"phrase": 8, "hit": 0.0, "drop": ("strobe", {"speed": 245}, 2),
             "move": [], "color": [("static_color", {})], "dim": []},
    "auto": {"phrase": 8, "hit": None, "drop": None, "move": [], "color": [], "dim": []},   # picks one of the others
    "ai": {"phrase": 8, "hit": None, "drop": None, "move": [], "color": [], "dim": []},     # director.py decides
    "rave": {"phrase": 8, "hit": 0.0, "drop": ("strobe", {"speed": 250}, 4),
             "move": [("random", {"beats": 1, "size": 60}), ("spiral", {"beats": 4, "size": 55}),
                      ("bounce", {"beats": 1, "size": 45}), ("sweep", {"beats": 1, "size": 70})],
             "color": [("chase", {"beats": 0.5}), ("sequence", {"beats": 0.5})],
             "dim": []},
}


def _lerp(a: float, b: float, k: float) -> float:
    return a + (b - a) * k


def _mix(ca: list, cb: list, k: float) -> tuple[float, float, float]:
    return tuple(_lerp(float(x), float(y), k) for x, y in zip(ca, cb))  # type: ignore[return-value]


def _smooth(e: float) -> float:
    e = min(1.0, max(0.0, e))
    return e * e * (3 - 2 * e)


def _lin(c: float) -> float:
    c = max(0.0, c) / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c: float) -> float:
    c = min(1.0, max(0.0, c))
    return 255.0 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)


def _oklab(c: Any) -> tuple[float, float, float]:
    r, g, b = (_lin(float(v)) for v in c[:3])
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def _rgb(lab: tuple[float, float, float]) -> tuple[float, float, float]:
    L, a, b = lab
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return (_gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
            _gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
            _gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s))


def mix_ok(ca: Any, cb: Any, k: float) -> tuple[float, float, float]:
    """Perceptual colour morph (OKLab): red → blue passes through magenta, not through grey."""
    if k <= 0.0:
        return float(ca[0]), float(ca[1]), float(ca[2])
    if k >= 1.0:
        return float(cb[0]), float(cb[1]), float(cb[2])
    a, b = _oklab(ca), _oklab(cb)
    return _rgb(tuple(x + (y - x) * k for x, y in zip(a, b)))  # type: ignore[arg-type]


def _ramp(cols: list, u: float) -> tuple[float, float, float]:
    """Point u (0..1) on a gradient through several colours."""
    u = min(1.0, max(0.0, u)) * (len(cols) - 1)
    i = min(len(cols) - 2, int(u))
    return mix_ok(cols[i], cols[i + 1], u - i)


def shape_xy(kind: str, cyc: float) -> tuple[float, float]:
    """Unit outline of a movement shape at cycle position ``cyc`` (x = pan, y = tilt)."""
    w = 2 * math.pi * cyc
    if kind == "circle":
        return math.cos(w), 0.6 * math.sin(w)
    if kind == "figure8":
        return math.sin(w), 0.5 * math.sin(2 * w)
    if kind == "sweep":
        return math.sin(w), 0.0
    if kind == "tilt_wave":
        return 0.0, math.sin(w)
    pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]] if kind == "square" else [[0, -1], [1, 1], [-1, 1]]
    u = (cyc % 1.0) * len(pts)
    i0 = int(u) % len(pts)
    a, b = pts[i0], pts[(i0 + 1) % len(pts)]
    fr = u - int(u)
    return _lerp(a[0], b[0], fr), 0.6 * _lerp(a[1], b[1], fr)


@dataclass
class Effect:
    id: str
    kind: str
    targets: Any = "all"
    params: dict[str, Any] = field(default_factory=dict)
    duration: float | None = None
    t0: float = field(default_factory=lambda: time.monotonic())
    base: dict[int, dict[str, float]] = field(default_factory=dict)
    state: dict[str, Any] = field(default_factory=dict)

    @property
    def category(self) -> str:
        return CATEGORY[self.kind]

    def touched(self) -> tuple[str, ...]:
        return KIND_TOUCHES.get(self.kind) or TOUCHES[self.category]


class EffectEngine:
    def __init__(self, engine: Any):
        self.engine = engine
        self.effects: dict[str, Effect] = {}
        self.groups: dict[str, dict[str, Any]] = {}      # preset instances: id → {name, layers: [ids]}
        self.presets: dict[str, dict[str, Any]] = {}
        self.lock = threading.RLock()
        self.reactions = {"flash": False, "color_step": False, "move_step": False, "strobe_drop": False}
        self.clock = RhythmClock()               # beat grid from the live tracker / the timeline
        self._bpm: float | None = None           # tempo set by hand / by a loaded song (no grid)
        self._bpos: float | None = None          # clock beat position for this tick (None = no grid)
        self._pending_strength = 0.0             # loudest onset since the last grid beat
        self._pending_drop = False
        self.section = {"name": "", "energy": 0.0, "since": 0.0}
        self.last_beat = 0.0
        self.audio_seen = False
        self.audio_at = 0.0
        self.audio_level = 0.0
        self.audio_gain = 1.0
        self._audio_tick = time.monotonic()
        self._palette_i = 0
        self._seq = 0
        self.palette: list[list[int]] = [list(c) for c in PALETTE[:6]]
        self.autopilot = {"on": False, "mood": "auto", "spot": False, "white": False, "lasers": True}
        self._en_fast = self._en_slow = 0.0          # "auto": short and long average of the beat strength
        self._auto_mood = "calm"
        self._auto_since = 0
        self._recent: list[str] = []                 # what played lately - never the same thing over and over
        self.speed_scale = 1.0                   # global tempo (gesture "pose + motion" → effect tempo)
        self.on_spot = None                      # callback(seconds) - short spotlight on a person
        self._ap_beats = 0
        self._ap_last: dict[str, str] = {}
        self._out_seq = 0
        from director import Director           # late import: director builds on this module
        self.director = Director(self)
        self.load_presets()

    @property
    def bpm(self) -> float | None:
        """The music's tempo: the locked beat grid first, else the tempo set by hand / by the song."""
        return self.clock.bpm if self.clock.alive() else self._bpm

    @bpm.setter
    def bpm(self, value: float | None) -> None:
        self._bpm = float(value) if value else None

    # ---- user effects (presets) -----------------------------------------------------
    def load_presets(self) -> None:
        try:
            self.presets = json.loads(PRESETS_PATH.read_text(encoding="utf-8"))
        except Exception:
            self.presets = {}

    def save_presets(self) -> None:
        tmp = PRESETS_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.presets, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(PRESETS_PATH)

    def set_preset(self, name: str, data: dict[str, Any]) -> None:
        layers = [ly for ly in data.get("layers", []) if ly.get("kind") in CATEGORY]
        if not layers:
            raise ValueError("pusty efekt")
        with self.lock:
            self.presets[name] = {"layers": layers, "color": data.get("color", "#2b8cff")}
            self.save_presets()

    def delete_preset(self, name: str) -> None:
        with self.lock:
            self.presets.pop(name, None)
            self.save_presets()

    # ---- control -------------------------------------------------------------------
    def start(self, kind: str, params: dict | None = None, targets: Any = "all",
              duration: float | None = None, eid: str | None = None) -> str:
        if kind.startswith("preset:"):
            return self._start_preset(kind[7:], params or {}, targets, duration, eid)
        if kind not in CATEGORY:
            raise ValueError(f"nieznany efekt {kind!r}")
        with self.engine.lock, self.lock:
            prm = {**DEFAULTS[kind], **(params or {})}
            morph = float(prm.get("morph") or 0.0)
            if morph <= 0 and prm.get("morph_beats") and self.bpm:
                morph = float(prm["morph_beats"]) * 60.0 / self.bpm
            prm["morph"] = max(0.0, morph)
            transition = {i: dict(self.engine.fixtures[i].target) for i in self.engine.lights(targets)}
            if eid is None:
                self._seq += 1
                eid = f"fx{self._seq}"
            if eid in self.groups:
                self.stop(eid)
            elif eid in self.effects and not (morph > 0 and self.effects[eid].category == CATEGORY[kind]):
                self.stop(eid)
            if CATEGORY[kind] == "laser" and not isinstance(targets, (list, tuple, int)):
                targets = self.laser_ids()                     # laser effects only ever drive lasers
            ids = self.engine.lights(targets)
            eff = Effect(eid, kind, targets, prm, duration)
            eff.state["_blend"] = transition
            if eff.params.get("t_offset"):
                eff.t0 -= max(0.0, float(eff.params["t_offset"]))
            for i in ids:
                eff.base[i] = {k: self.engine.fixtures[i].target[k] for k in eff.touched()}
            # one effect per layer and fixture: a new movement replaces the old one (or morphs out of it)
            sources = []
            for other in list(self.effects.values()):
                if other.state.get("_retire"):
                    continue
                if other.category == eff.category and other.kind != "flash" and kind != "flash" \
                        and other.touched() == eff.touched() \
                        and set(self.engine.resolve(other.targets)) & set(ids):
                    if other.kind != "position":
                        # keep the look from before the old effect, not one frame of it (no drift)
                        for i in ids:
                            if i in other.base:
                                eff.base[i] = dict(other.base[i])
                    if morph > 0:
                        sources.append(self._retire(other.id, morph))
                    else:
                        self._stop_one(other.id)
            if prm.get("home") and eff.category == "move":
                for i in ids:                             # the show moves around the calibrated show position
                    home = getattr(self.engine.fixtures[i], "show_home", None)
                    if home:
                        eff.base[i]["pan"], eff.base[i]["tilt"] = float(home[0]), float(home[1])
            eff.state["_from"] = sources
            if eid in self.effects:                       # same id, other lamps: the old one goes
                self._stop_one(eid)
            self.effects[eid] = eff
            return eid

    def _retire(self, eid: str, seconds: float) -> str:
        """Keep an effect playing under its successor while the successor morphs in."""
        eff = self.effects.pop(eid)
        self._out_seq += 1
        eff.id = f"{eid}~{self._out_seq}"
        eff.state["_retire"] = time.monotonic() + seconds + 0.05
        self.effects[eff.id] = eff                    # re-inserted: renders before the new one
        return eff.id

    def _start_preset(self, name: str, params: dict, targets: Any, duration: float | None,
                      eid: str | None) -> str:
        preset = self.presets.get(name)
        if preset is None:
            raise ValueError(f"nie ma efektu {name!r}")
        with self.engine.lock, self.lock:
            if eid is None:
                self._seq += 1
                eid = f"fx{self._seq}"
            if eid in self.groups or eid in self.effects:
                self.stop(eid)
            layer_ids = []
            for n, ly in enumerate(preset["layers"]):
                lp = {**(ly.get("params") or {})}
                if params.get("beats_scale"):                 # timeline can stretch the tempo
                    if "beats" in lp:
                        lp["beats"] = lp["beats"] * float(params["beats_scale"])
                layer_ids.append(self.start(ly["kind"], lp, targets, duration, f"{eid}/{n}"))
            self.groups[eid] = {"name": name, "layers": layer_ids, "t0": time.monotonic(), "duration": duration}
            return eid

    def _stop_one(self, eid: str) -> None:
        eff = self.effects.pop(eid, None)
        if eff is None:
            return
        # restore what the effect overrode
        for i, vals in eff.base.items():
            if i in self.engine.fixtures:
                self.engine.fixtures[i].target.update(vals)

    def stop(self, eid: str) -> None:
        with self.engine.lock, self.lock:
            grp = self.groups.pop(eid, None)
            if grp:
                for lid in grp["layers"]:
                    self._stop_one(lid)
                return
            self._stop_one(eid)

    def stop_all(self) -> None:
        with self.engine.lock, self.lock:
            self.groups.clear()
            for eid in list(self.effects):
                self._stop_one(eid)

    # ---- beats -------------------------------------------------------------------
    def audio(self, level: float) -> None:
        """Continuous input, including silence; missing input fades out after 1 s."""
        level = float(level)
        if not math.isfinite(level):
            return
        with self.lock:
            self.audio_seen = True
            self.audio_at = time.monotonic()
            self.audio_level = max(0.0, min(1.0, level))

    def beat(self, strength: float = 1.0, drop: bool = False, bpm: float | None = None) -> None:
        with self.engine.lock, self.lock:
            if self.clock.alive():
                # the grid fires the beats on time; a detection only says how hard the next one is
                self._pending_strength = max(self._pending_strength, float(strength))
                self._pending_drop = self._pending_drop or bool(drop)
                return
            self._beat(strength, drop, bpm)

    def grid(self, bpm: float, next_in: float, beat_in_bar: int | None = None,
             confidence: float = 1.0, source: str = "live") -> None:
        """Beat grid from the tracker / the timeline (see rhythm.RhythmClock.update)."""
        self.clock.update(bpm, next_in, beat_in_bar, confidence, source=source)

    def onset(self, strength: float) -> None:
        with self.lock:
            self._pending_strength = max(self._pending_strength, max(0.0, min(1.0, float(strength))))

    def set_section(self, name: str, energy: float | None = None) -> None:
        """Part of the song from the tracker: intro, verse, chorus, build, drop, breakdown, outro, quiet."""
        with self.engine.lock, self.lock:
            prev = self.section["name"]
            now = time.monotonic()
            self.section = {"name": str(name), "energy": round(float(energy or 0.0), 3),
                            "since": now if name != prev else self.section["since"]}
            if name != prev:
                if self.autopilot["on"] and self.autopilot["mood"] == "ai":
                    self.director.on_section(prev, str(name))      # a drop hits right now, on this kick
                elif name == "drop":
                    self._pending_drop = True

    def _clock_beat(self, beat: int, in_bar: int) -> None:
        s = self._pending_strength or (self.audio_level if self.audio_seen else 0.8)
        drop = self._pending_drop
        self._pending_strength, self._pending_drop = 0.0, False
        self._beat(min(1.0, s), drop, None, in_bar)

    def _beat(self, strength: float, drop: bool, bpm: float | None, in_bar: int | None = None) -> None:
        now = time.monotonic()
        if bpm:
            self.bpm = float(bpm)
        self.last_beat = now
        r = self.reactions
        if r["flash"]:
            self.start("flash", {"decay": 0.18 + 0.2 * min(1.0, strength)}, duration=0.6, eid="beat-flash")
        if r["color_step"]:
            pal = [[255, 255, 255]] if self.autopilot.get("white") else (self.palette or [list(c) for c in PALETTE])
            self._palette_i = (self._palette_i + 1) % len(pal)
            self.start("static_color", {"color_a": list(pal[self._palette_i])}, eid="beat-color")
        if r["move_step"]:
            self.start("random", {"speed": 0.0, "size": 45, "jump": True}, eid="beat-move")
        if r["strobe_drop"] and drop:
            self.start("strobe", {"speed": 235}, duration=2.0, eid="beat-drop")
        if self.autopilot["on"]:
            self._ap_beat(strength, drop, in_bar)

    # ---- tick (called by the DMX engine under its lock, 40 Hz) -----------------------
    def laser_ids(self) -> list[int]:
        return [i for i, f in self.engine.fixtures.items() if f.enabled and (f.type == "laser" or any(r.startswith("laser") for r in f.layout()))]

    def apply(self) -> None:
        now = time.monotonic()
        with self.lock:
            dt = min(0.25, max(0.0, now - self._audio_tick))
            self._audio_tick = now
            live_level = self.audio_level if now - self.audio_at < 1.0 else 0.0
            gain = min(1.0, live_level * 1.5) if self.audio_seen else 1.0
            tau = 0.18 if gain > self.audio_gain else 0.7
            self.audio_gain += (gain - self.audio_gain) * (1 - math.exp(-dt / tau))
            self._bpos = self.clock.pos(now) if self.clock.alive(now) else None
            for beat, in_bar in self.clock.tick(now):            # beats of the grid, ahead of the sound
                self._clock_beat(beat, in_bar)
            if (self.autopilot["on"] and self.autopilot["mood"] == "auto"
                    and self.audio_seen and self.audio_gain < 0.18 and self._auto_mood != "calm"):
                self._auto_mood = "calm"
                self._en_fast = self._en_slow = 0.0
                self._ap_phrase()
            for eff in list(self.effects.values()):
                if self.effects.get(eff.id) is not eff:            # replaced by a beat reaction this tick
                    continue
                t = max(0.0, now - eff.t0)
                if (eff.duration is not None and t >= eff.duration) or now >= eff.state.get("_retire", now + 1):
                    self._stop_one(eff.id)
                    continue
                live_ids = self.engine.lights(eff.targets)
                # Newly added lights join an ongoing show without restarting it.
                for fid in live_ids:
                    if fid not in eff.base:
                        eff.base[fid] = {k: self.engine.fixtures[fid].target[k] for k in eff.touched()}
                ids = self._ordered(eff, live_ids)
                for n, fid in enumerate(ids):
                    self._render(eff, fid, n, len(ids), t)
            for gid, g in list(self.groups.items()):
                if not any(lid in self.effects for lid in g["layers"]):
                    del self.groups[gid]

    SYMMETRIC = {"crossfire", "mirror", "split", "fan"}

    def _ordered(self, eff: Effect, ids: list[int]) -> list[int]:
        """Order of the lamps for spread / chase effects: left→right, right→left, centre-out, random."""
        order = "left" if eff.kind in self.SYMMETRIC else eff.params.get("order", "left")
        fx = self.engine.fixtures
        if order == "random":
            rnd = eff.state.setdefault("_rnd", {})
            for i in ids:
                rnd.setdefault(i, random.random())
            return sorted(ids, key=lambda i: rnd[i])
        ids = sorted(ids, key=lambda i: (fx[i].pos[0], i))
        if order == "right":
            ids.reverse()
        elif order == "center":
            mid = (len(ids) - 1) / 2
            ranks = {fid: n for n, fid in enumerate(ids)}
            ids = sorted(ids, key=lambda i: abs(ranks[i] - mid))
        return ids

    def _speed(self, p: dict[str, Any]) -> float:
        """Cycles per second: fixed, or 'beats' per cycle following the current BPM."""
        bpm = self.bpm
        if p.get("beats") and bpm:
            return bpm / 60.0 / max(0.125, float(p["beats"])) * self.speed_scale
        return float(p.get("speed", 1.0)) * self.speed_scale

    def _beatpos(self, t: float) -> float:
        """Beats on the music's grid (absolute, bar-aligned) or, without a grid, beats since the start."""
        if self._bpos is not None:
            return self._bpos
        return t * (self.bpm or 120.0) / 60.0

    def _rel_beats(self, eff: Effect, t: float) -> float:
        """Beats since the effect started (build-ups, one-shot ramps)."""
        if self._bpos is not None:
            b0 = eff.state.setdefault("_b0", self._bpos)
            return self._bpos - b0
        return t * (self.bpm or 120.0) / 60.0

    def _envelope(self, eff: Effect, t: float) -> float:
        p = eff.params
        fi, fo = float(p.get("fade_in", 0) or 0), float(p.get("fade_out", 0) or 0)
        mo = float(p.get("morph", 0) or 0)
        if fi <= 0 and fo <= 0 and mo <= 0:
            return 1.0
        e = 1.0
        if fi > 0:
            e = min(e, t / fi)
        if mo > 0:
            e = min(e, t / mo)
        if fo > 0 and eff.duration:
            e = min(e, (eff.duration - t) / fo)
        e = min(1.0, max(0.0, e))
        return EASES.get(p.get("ease", "smooth"), EASES["smooth"])(e)

    @staticmethod
    def _up(f: Any, base_tilt: float) -> float:
        """DMX tilt direction that lifts the beam (away from the floor, towards the audience / the sky)."""
        inv = -1.0 if f.invert_tilt else 1.0
        te = (base_tilt / 65535.0 - 0.5) * f.tilt_deg * inv
        s = 1.0 if te >= 0 else -1.0
        return (-s if f.mount == "floor" else s) * inv

    def _render(self, eff: Effect, fid: int, n: int, count: int, t: float) -> None:
        group = "strobe" if eff.kind == "strobe" else eff.category
        if self.engine.is_held(fid, group):          # a gesture / fader is driving this right now
            return
        f = self.engine.fixtures[fid]
        env = self._envelope(eff, t)
        if env < 1.0:                                 # keyframe fade / morph: blend previous look → effect
            saved = {k: f.target[k] for k in eff.touched()}
            self._render_raw(eff, f, fid, n, count, t)
            live = any(o in self.effects for o in eff.state.get("_from", ()))
            # morph: out of what the old effect shows right now; fade: out of the look at the start
            base = saved if live else eff.state.get("_blend", {}).get(fid, eff.base[fid])
            touched = eff.touched()
            if "red" in touched:
                a = [base.get(k, saved[k]) for k in ("red", "green", "blue")]
                b = [f.target[k] for k in ("red", "green", "blue")]
                f.target["red"], f.target["green"], f.target["blue"] = mix_ok(a, b, env)
            for k in touched:
                if k in ("red", "green", "blue"):
                    continue
                if k == "cwheel":                     # colour wheel cannot blend: switch half-way
                    if env < 0.5:
                        f.target[k] = base.get(k, saved[k])
                    continue
                b = base.get(k, saved[k])
                f.target[k] = b + (f.target[k] - b) * env
        else:
            self._render_raw(eff, f, fid, n, count, t)
            if eff.kind in FAST_COLOR or (eff.kind == "sequence" and not eff.params.get("fade")):
                for k in ("red", "green", "blue", "cwheel"):
                    f.current[k] = f.target[k]        # a cut on the beat is a cut, not a slide
        if eff.id.startswith("ap-") and self.audio_seen:
            if "dimmer" in eff.touched():
                f.target["dimmer"] *= self.audio_gain
            if "strobe" in eff.touched() and self.audio_gain < 0.15:
                f.target["strobe"] = 0
            if eff.category == "laser" and self.audio_gain < 0.15:
                f.target["laser"] = f.current["laser"] = 0
        if eff.id == "ap-hit" and count > 1:
            pattern = (self._ap_beats // 8) % 3
            selected = (n % 2 == self._ap_beats % 2 if pattern == 0 else
                        n == self._ap_beats % count if pattern == 1 else
                        n in (self._ap_beats % count, count - 1 - self._ap_beats % count))
            if not selected:
                f.target["dimmer"] *= 0.12
        if eff.kind in FAST_DIM:
            f.current["dimmer"] = f.target["dimmer"]

    def _render_raw(self, eff: Effect, f: Any, fid: int, n: int, count: int, t: float) -> None:
        p, base, tgt = eff.params, eff.base[fid], f.target
        phase = n * p.get("spread", 0.0)
        k = eff.kind
        sp = self._speed(p)
        if p.get("beats") and self._bpos is not None:
            # locked to the music: every effect with the same cycle length turns on the same bar line
            cyc0 = self._bpos * self.speed_scale / max(0.125, float(p["beats"]))
        elif eff.id == "ap-move":
            # Integrate live movement phase: changing BPM must not teleport the beam.
            last_t, cycles = eff.state.get("_phase", (0.0, 0.0))
            sp *= 0.2 + 0.8 * self.audio_gain if self.audio_seen else 1.0
            cycles += max(0.0, t - last_t) * sp
            eff.state["_phase"] = (t, cycles)
            cyc0 = cycles
        else:
            cyc0 = sp * t
        cyc = cyc0 + phase
        rank = (n / (count - 1) * 2 - 1) if count > 1 else 0.0         # -1 left .. +1 right
        if eff.category == "laser":
            on = 1.0
            if k == "laser_hit":
                duty = float(p.get("duty", 0.4))
                hits = p.get("hits") or []
                if hits:                                          # exact hit times (timeline)
                    i = self._last_hit(hits, t)
                    gap = (hits[i + 1][0] - hits[i][0]) if 0 <= i < len(hits) - 1 else 0.5
                    on = 1.0 if i >= 0 and t - hits[i][0] < gap * duty else 0.0
                elif self._bpos is not None:
                    on = 1.0 if (self._bpos / float(p.get("beats", 1))) % 1.0 < duty else 0.0
                else:
                    period = 60.0 / self.bpm * float(p.get("beats", 1)) if self.bpm else 0.5
                    on = 1.0 if (t % period) / period < duty else 0.0
            tgt["laser"] = 255.0 * on
            f.current["laser"] = tgt["laser"]                     # on / off at once, exactly on the beat
            return
        if eff.category == "move":
            size = float(p.get("size", 35))
            if k == "position":
                if "pan" in p:
                    tgt["pan"] = min(65535.0, max(0.0, float(p["pan"]) * 65535))
                if "tilt" in p:
                    tgt["tilt"] = min(65535.0, max(0.0, float(p["tilt"]) * 65535))
                return
            w = 2 * math.pi * cyc
            if k == "random":
                st = eff.state.setdefault(fid, {"next": 0.0, "dx": 0.0, "dy": 0.0})
                if p.get("jump"):                              # beat-driven: one jump per start
                    if not st.get("done"):
                        st.update(dx=random.uniform(-1, 1), dy=random.uniform(-1, 1), done=True)
                elif t >= st["next"]:
                    st.update(dx=random.uniform(-1, 1), dy=random.uniform(-1, 1),
                              next=t + 1.0 / max(0.05, sp))
                dx, dy = st["dx"] * size, st["dy"] * size * 0.6
            elif k in SHAPES:
                ux, uy = shape_xy(k, cyc)
                dx, dy = size * ux, size * uy
            elif k == "path":
                pts = p.get("points") or [[0, 0]]
                u = (cyc % 1.0) * len(pts)
                i0 = int(u) % len(pts)
                a, b = pts[i0], pts[(i0 + 1) % len(pts)]
                fr = u - int(u)                                 # a drawn path keeps the proportions it was drawn with
                dx, dy = size * _lerp(a[0], b[0], fr), size * _lerp(a[1], b[1], fr)
            elif k == "spiral":
                r = 0.2 + 0.8 * (0.5 - 0.5 * math.cos(w / 4))
                dx, dy = size * r * math.cos(w), size * 0.6 * r * math.sin(w)
            elif k == "bounce":
                dx, dy = size * math.sin(w / 2), -size * 0.6 * abs(math.sin(w)) + size * 0.3
            elif k == "fan":                                    # lamps open like a fan
                spread = rank if count > 1 else 1.0
                dx, dy = size * spread * (0.5 + 0.5 * math.sin(w)), 0.0
            else:
                up = self._up(f, base["tilt"])
                lift = float(p.get("lift", 25))
                if k == "ballyhoo":                             # big concert sweeps, neighbours mirrored
                    side = -1.0 if n % 2 else 1.0
                    dx = side * size * math.sin(w)
                    dy = up * size * 0.45 * (0.5 - 0.5 * math.cos(2 * w))
                elif k == "crossfire":                          # left lamps aim right, right lamps left: beams cross
                    dx = -rank * size * (0.5 + 0.5 * math.sin(w))
                    dy = up * size * 0.15 * (0.5 - 0.5 * math.cos(2 * w))
                elif k == "searchlight":                        # film premiere: slow wide arcs high up
                    dx = size * math.sin(w + n * math.pi * 0.6)
                    dy = up * (lift + size * 0.2 * math.sin(2 * w + n))
                elif k == "fly_out":                            # beams lift towards the audience and back
                    dx, dy = 0.0, up * lift * (0.5 - 0.5 * math.cos(w))
                elif k == "mirror":                             # symmetric fan opening and closing
                    op = 0.5 - 0.5 * math.cos(w)
                    dx, dy = rank * size * op, up * size * 0.25 * op
                elif k == "rise":                               # build-up: the beams climb until the drop
                    u = min(1.0, self._rel_beats(eff, t) / max(1.0, float(p.get("beats", 16))))
                    dx, dy = 0.0, up * lift * _smooth(u)
                else:                                           # shape_morph: one shape melts into the next
                    hold = max(0.25, float(p.get("hold", 2.0)))
                    seg = cyc0 / hold
                    i = int(seg) % len(SHAPES)
                    m = _smooth((seg - int(seg) - 0.55) / 0.45)
                    xa, ya = shape_xy(SHAPES[i], cyc)
                    xb, yb = shape_xy(SHAPES[(i + 1) % len(SHAPES)], cyc)
                    dx, dy = size * _lerp(xa, xb, m), size * _lerp(ya, yb, m)
            tgt["pan"] = min(65535.0, max(0.0, base["pan"] + dx / f.pan_deg * 65535))
            tgt["tilt"] = min(65535.0, max(0.0, base["tilt"] + dy / f.tilt_deg * 65535))
        elif eff.category == "color":
            pal = p.get("colors") or self.palette or [list(c) for c in PALETTE]
            if k == "rainbow":
                r, g, b = (c * 255 for c in colorsys.hsv_to_rgb(cyc % 1.0, 1.0, 1.0))
            elif k == "two_color":
                on_a = int(cyc0 * 2 + n) % 2 == 0
                r, g, b = p["color_a"] if on_a else p["color_b"]
            elif k in ("chase", "sequence"):
                cols = pal
                u = (cyc0 + (n * p.get("spread", 0.0) * len(cols))) % len(cols)
                i0 = int(u)
                if p.get("fade"):
                    r, g, b = mix_ok(cols[i0], cols[(i0 + 1) % len(cols)], u - i0)
                else:
                    r, g, b = cols[i0]
            elif k == "fire":
                fl = 0.5 + 0.25 * math.sin(t * 13.1 * sp + n * 1.7) + 0.25 * math.sin(t * 7.3 * sp + n * 0.9)
                r, g, b = 255.0, 40 + 120 * fl, 0.0
            elif k == "ocean":
                hue = 0.5 + 0.12 * (0.5 + 0.5 * math.sin(2 * math.pi * cyc))
                r, g, b = (c * 255 for c in colorsys.hsv_to_rgb(hue, 1.0, 1.0))
            elif k == "gradient":
                cols = p.get("colors")
                if cols and len(cols) > 1:            # palette gradient: fade through every colour
                    u = (cyc % 1.0) * len(cols)
                    i0 = int(u)
                    r, g, b = mix_ok(cols[i0], cols[(i0 + 1) % len(cols)], 0.5 - 0.5 * math.cos(math.pi * (u - i0)))
                else:
                    r, g, b = mix_ok(p["color_a"], p["color_b"], 0.5 - 0.5 * math.cos(2 * math.pi * cyc))
            elif k == "color_morph":                  # hold a colour, then melt into the next one
                hold = min(0.9, max(0.0, float(p.get("hold", 0.35))))
                u = (cyc0 + n * p.get("spread", 0.0) * len(pal)) % len(pal)
                i0 = int(u)
                r, g, b = mix_ok(pal[i0], pal[(i0 + 1) % len(pal)], _smooth((u - i0 - hold) / max(0.05, 1 - hold)))
            elif k == "split":                        # stage left / stage right in two colours, swapping
                cols = pal if len(pal) > 1 else [pal[0], [255, 255, 255]]
                hold = min(0.9, max(0.0, float(p.get("hold", 0.7))))
                half = 0 if n < count / 2 else 1
                step = int(cyc0)
                r, g, b = mix_ok(cols[(step + half) % len(cols)], cols[(step + 1 + half) % len(cols)],
                                 _smooth((cyc0 - step - hold) / max(0.05, 1 - hold)))
            elif k == "sunrise":
                r, g, b = _ramp(SUNRISE, 0.5 - 0.5 * math.cos(2 * math.pi * cyc))
            elif k == "aurora":
                u = 0.5 + 0.3 * math.sin(2 * math.pi * (cyc0 + n * 0.17)) + 0.2 * math.sin(2 * math.pi * (1.7 * cyc0 + n * 0.31))
                r, g, b = _ramp(AURORA, u)
            elif k == "noir":
                r, g, b = _ramp(NOIR, 0.5 - 0.5 * math.cos(2 * math.pi * cyc))
            elif k == "police":
                sub, half = (cyc0 * 2) % 1.0, int(cyc0 * 2) % 2
                on = sub < 0.18 or 0.3 <= sub < 0.48
                col = (255, 0, 0) if n % 2 == half else (0, 40, 255)
                r, g, b = col if on else (0, 0, 0)
            elif k == "candle":
                s = sp * t
                fl = 0.72 + 0.14 * math.sin(s * 6.3 + n * 1.3) + 0.09 * math.sin(s * 11.9 + n * 0.7) + 0.05 * math.sin(s * 23.3 + n * 2.1)
                r, g, b = 255 * fl, 118 * fl, 22 * fl
            elif k == "desaturate":                   # build-up: colours wash out to white
                u = self._rel_beats(eff, t) / max(1.0, float(p.get("beats", 16)))
                r, g, b = mix_ok(pal[n % len(pal)], (255, 255, 255), _smooth(u))
            else:
                r, g, b = p["color_a"]
            hue = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0]
            tgt.update(red=r, green=g, blue=b, cwheel=f.wheel_for(r, g, b) if f.wheel else hue * 120)
        elif k == "strobe":
            tgt["strobe"] = p["speed"]
        elif eff.category == "beam":
            if k == "gobo_spin" and "speed" in p:
                tgt["gobo"] = 128 + min(127.0, max(0.0, float(p["speed"])))
            else:
                tgt["gobo"] = float(p.get("value", 0))
        else:                                                   # dimmer effects
            lo, hi = float(p.get("min", 0.0)), float(p.get("max", 1.0))
            floor = float(p.get("floor", 0.0))
            if k == "pulse":
                lvl = lo + (hi - lo) * (0.5 + 0.5 * math.sin(2 * math.pi * cyc))
            elif k == "breathe":
                lvl = lo + (hi - lo) * (0.5 - 0.5 * math.cos(2 * math.pi * cyc)) ** 2
            elif k == "blink":
                lvl = 1.0 if (cyc % 1.0) < float(p.get("duty", 0.5)) else 0.0
            elif k == "sparkle":
                st = eff.state.setdefault(fid, {"next": 0.0, "lvl": 1.0})
                if t >= st["next"]:
                    st.update(lvl=random.uniform(lo, hi), next=t + 1.0 / max(0.5, sp))
                lvl = st["lvl"]
            elif k == "saw":
                lvl = cyc % 1.0
            elif k == "heartbeat":
                u = cyc % 1.0
                lvl = 0.12 + 0.88 * max(math.exp(-u / 0.06), 0.7 * math.exp(-max(0.0, u - 0.22) / 0.07) if u >= 0.22 else 0)
            elif k == "pattern":
                steps = p.get("steps") or [1]
                if p.get("beats") and self._bpos is not None:
                    pos = self._bpos / max(0.25, float(p["beats"])) * len(steps)
                elif p.get("beats") and self.bpm:
                    pos = t * self.bpm / 60.0 * len(steps) / max(0.25, float(p["beats"]))
                else:
                    pos = t * float(p.get("speed", 4.0))
                lvl = float(steps[int(pos + n * p.get("spread", 0.0) * len(steps)) % len(steps)])
            elif k == "dark":
                lvl = 0.0
            elif k == "glow":                                 # a steady level (looks without a dimmer pattern)
                lvl = float(p.get("level", 1.0))
            elif k == "wave":                                 # a light running across the lamps
                width = max(0.05, float(p.get("width", 0.35)))
                u = (sp * t - n / max(1, count)) % 1.0
                dist = min(u, 1 - u)
                lvl = max(0.0, 1.0 - dist / width) ** 2
            elif k == "hit":                                  # instant full, fades to black by the end
                length = eff.duration or float(p.get("decay", 0.5)) * 3
                u = min(1.0, max(0.0, t / max(0.02, length)))
                lvl = float(p.get("strength", 1.0)) * (1.0 - u) ** float(p.get("curve", 2.0))
            elif k == "beat":                                 # flash on every beat of the current BPM, dark in between
                if self._bpos is not None:
                    u = (self._bpos / float(p.get("beats", 1))) % 1.0
                else:
                    period = 60.0 / self.bpm * float(p.get("beats", 1)) if self.bpm else 0.5
                    u = (t % period) / period
                lvl = floor + (1.0 - floor) * (1.0 - u) ** float(p.get("curve", 2.4))
            elif k == "kicks":                                # every kick flashes, dark before the next one
                hits = p.get("hits") or []
                lvl = floor
                i = self._last_hit(hits, t)
                if i >= 0:
                    ht, hs = hits[i][0], (hits[i][1] if len(hits[i]) > 1 else 1.0)
                    gap = (hits[i + 1][0] - ht) if i + 1 < len(hits) else float(p.get("max_len", 0.6))
                    length = max(0.04, min(gap * 0.9, float(p.get("max_len", 0.6))))
                    u = (t - ht) / length
                    if u < 1.0:
                        peak = 0.35 + 0.65 * max(0.0, min(1.0, float(hs)))
                        lvl = floor + (peak - floor) * (1.0 - u) ** float(p.get("curve", 2.2))
            elif k == "lightning":                            # a storm: random double strikes
                key = fid if p.get("each") else "all"
                st = eff.state.setdefault(("lt", key), {"next": 0.0, "t": -9.0, "double": False})
                if t >= st["next"]:
                    st.update(t=t, double=random.random() < 0.6,
                              next=t + min(8.0, random.expovariate(max(0.05, sp))))
                d = t - st["t"]
                strike = math.exp(-d / 0.05)
                if st["double"] and d >= 0.11:
                    strike = max(strike, 0.85 * math.exp(-(d - 0.11) / 0.07))
                lvl = floor + (1 - floor) * strike
            elif k == "riser":                                # build-up: faster and faster flashes, brighter and brighter
                u = min(1.0, self._rel_beats(eff, t) / max(1.0, float(p.get("beats", 16))))
                div = 1 if u < 0.5 else 2 if u < 0.75 else 4 if u < 0.9 else 8
                x = (self._beatpos(t) * div) % 1.0
                fl = floor + (0.85 - floor) * u
                lvl = fl + (1.0 - fl) * (1.0 - x) ** 3
            elif k == "stack":                                # lamps join one by one, the bar line clears them
                length = max(1.0, float(p.get("beats", 4)))
                lit = int(((self._beatpos(t) % length) / length) * count) + 1
                lvl = 1.0 if n < lit else floor
            elif k == "chase_beat":                           # one lamp per beat, locked to the grid
                b = self._beatpos(t) * float(p.get("rate", 1.0))
                cur = int(b) % max(1, count)
                hit = n == cur or (p.get("mirror") and n == count - 1 - cur)
                lvl = floor + (1 - floor) * (1.0 - (b % 1.0)) ** 1.5 if hit else floor
            elif k == "stutter":                              # gate on 1/8 or 1/16 notes
                x = (self._beatpos(t) * float(p.get("div", 4))) % 1.0
                lvl = 1.0 if x < float(p.get("duty", 0.5)) else floor
            elif k == "twinkle":                              # elegant random glints
                st = eff.state.setdefault(fid, {"next": random.uniform(0, 1.0), "t": -9.0})
                if t >= st["next"]:
                    st.update(t=t, next=t + random.expovariate(max(0.05, sp) / max(1, count)))
                lvl = floor + (1 - floor) * math.exp(-(t - st["t"]) / max(0.05, float(p.get("decay", 0.35))))
            elif k == "blinder":                              # audience blinder: white burst, slow decay
                e = math.exp(-t / max(0.1, float(p.get("decay", 0.9))))
                tgt["dimmer"] = max(tgt["dimmer"], 255 * e)
                tgt["red"], tgt["green"], tgt["blue"] = mix_ok((tgt["red"], tgt["green"], tgt["blue"]), (255, 255, 255), e)
                return
            elif k == "flash":
                tgt["dimmer"] = max(base["dimmer"], 255 * math.exp(-t / max(0.05, p["decay"])))
                return
            elif k == "fade_in":
                lvl = min(1.0, t / max(0.1, p["time"]))
            elif k == "fade_out":
                tgt["dimmer"] = base["dimmer"] * max(0.0, 1 - t / max(0.1, p["time"]))
                return
            else:
                lvl = 1.0
            tgt["dimmer"] = 255 * min(1.0, max(0.0, lvl))

    @staticmethod
    def _last_hit(hits: list, t: float) -> int:
        lo, hi = 0, len(hits) - 1
        ans = -1
        while lo <= hi:                                 # binary search: last hit at or before t
            mid = (lo + hi) // 2
            if hits[mid][0] <= t:
                ans, lo = mid, mid + 1
            else:
                hi = mid - 1
        return ans

    # ---- autopilot: the lights follow the music on their own ----------------------------
    def set_autopilot(self, on: bool | None = None, mood: str | None = None, spot: bool | None = None,
                      white: bool | None = None, lasers: bool | None = None) -> None:
        with self.engine.lock, self.lock:
            if white is not None:
                self.autopilot["white"] = bool(white)
                if self.autopilot["on"]:
                    self._ap_phrase()
            if lasers is not None:
                self.autopilot["lasers"] = bool(lasers)
                if not lasers:
                    self.stop("ap-laser")
            if mood in MOODS:
                changed = mood != self.autopilot["mood"]
                self.autopilot["mood"] = mood
            else:
                changed = False
            if spot is not None:
                self.autopilot["spot"] = bool(spot)
            if on is not None:
                self.autopilot["on"] = bool(on)
            if not self.autopilot["on"]:
                for eid in AP_IDS:
                    self.stop(eid)
            elif changed or on:
                self._ap_beats = 0
                self._ap_phrase()

    def _cur_mood(self) -> str:
        m = self.autopilot["mood"]
        return self._auto_mood if m == "auto" else m

    def _ap_pick(self, layer: str, options: list) -> tuple[str, dict] | None:
        if not options:
            return None
        keys = [f"{o[0]}{o[1]}" for o in options]
        pool = [o for o, k in zip(options, keys) if k != self._ap_last.get(layer) and k not in self._recent[-6:]]
        pool = pool or [o for o, k in zip(options, keys) if k != self._ap_last.get(layer)] or options
        kind, params = random.choice(pool)
        self._ap_last[layer] = f"{kind}{params}"
        self._recent = (self._recent + [f"{kind}{params}"])[-12:]
        return kind, dict(params)

    def _ap_phrase(self) -> None:
        if self.autopilot["mood"] == "ai":
            self.director.phrase(force=True)
            return
        for eid in ("ap-beam", "ap-acc"):                 # only the director plays these
            self.stop(eid)
        mood_name = self._cur_mood()
        mood = MOODS[mood_name]
        pal = [[255, 255, 255]] if self.autopilot.get("white") else (self.palette or [list(c) for c in PALETTE])
        calm = mood_name == "calm"
        if calm:
            for eid in ("ap-hit", "ap-drop", "ap-laser"):
                self.stop(eid)
        order = random.choice(["left", "right", "center"])
        mv = self._ap_pick("move", mood["move"])
        if mv:
            # a new movement blends in (slowly when it is calm) instead of jumping
            self.start(mv[0], {**mv[1], "fade_in": 60.0 / self.bpm * (4 if calm else 1) if self.bpm else 1.0,
                               "ease": "smooth", "order": order}, "all", None, "ap-move")
        elif "ap-move" in self.effects:
            self.stop("ap-move")
        co = ("static_color", {}) if self.autopilot.get("white") else self._ap_pick("color", mood["color"])
        if co:
            prm = co[1]
            prm["colors"] = pal
            prm["color_a"], prm["color_b"] = pal[0], pal[min(1, len(pal) - 1)]
            self.start(co[0], prm, "all", None, "ap-color")
        di = self._ap_pick("dim", mood["dim"])
        if di:
            self.start(di[0], {**di[1], "order": order}, "all", None, "ap-dim")
        elif "ap-dim" in self.effects:
            self.stop("ap-dim")

    def _auto_follow(self, strength: float, drop: bool) -> None:
        """The music gets quieter / louder / faster: the style follows (calm -> dynamic -> dance -> hits / rave)."""
        s = self.audio_level if self.audio_seen else max(0.0, min(1.0, strength))
        self._en_fast = self._en_fast * 0.8 + s * 0.2 if self._en_fast else s
        self._en_slow = self._en_slow * 0.97 + s * 0.03 if self._en_slow else s
        e, bpm = self._en_fast, self.bpm or 110
        if e < 0.35:
            want = "calm"
        elif e < 0.6:
            want = "dynamic"
        elif bpm >= 138 and e > 0.8:
            want = "rave" if self._ap_beats % 64 < 32 else "hits"        # very fast + loud: alternate so it never repeats
        else:
            want = "dance"
        if drop:
            want = "hits" if self._auto_mood != "hits" else "rave"
        self._auto_since += 1
        # change on a phrase boundary, not more often than every 8 beats (a drop changes at once)
        if want != self._auto_mood and (drop or (self._auto_since >= 8 and self._ap_beats % 4 == 0)):
            self._auto_mood, self._auto_since = want, 0
            self._ap_phrase()

    def _ap_beat(self, strength: float, drop: bool, in_bar: int | None = None) -> None:
        if self.autopilot["mood"] == "ai":
            self._ap_beats += 1
            self.director.beat(strength, drop, in_bar)
            return
        if self.autopilot["mood"] == "auto":
            self._auto_follow(strength, drop)
        mood_name = self._cur_mood()
        mood = MOODS[mood_name]
        self._ap_beats += 1
        if self._ap_beats % mood["phrase"] == 0:
            self._ap_phrase()
        if mood["hit"] is not None and self.bpm:        # every beat flashes and falls back
            length = 60.0 / self.bpm * 0.9
            self.start("kicks", {"hits": [[0.0, 0.6 + 0.4 * min(1.0, strength)]], "floor": mood["hit"],
                                 "max_len": length}, "all", None, "ap-hit")
        if drop and mood["drop"] and self.bpm:
            kind, prm, beats = mood["drop"]
            self.start(kind, prm, "all", beats * 60.0 / self.bpm, "ap-drop")
        # fast / loud parts: the lasers pulse on the beat (only when the user armed them)
        fast = bool(self.bpm) and (self.bpm >= 135 or drop or strength >= 0.9)
        if (self.autopilot.get("lasers") and fast and self.engine.lasers_enabled and self.laser_ids()
                and "ap-laser" not in self.effects):
            self.start("laser_hit", {"duty": 0.4, "beats": 1 if self.bpm < 150 else 0.5}, None, 4 * 60.0 / self.bpm, "ap-laser")
        if (self.autopilot["spot"] and self.on_spot and mood_name in ("calm", "dynamic")
                and self._ap_beats % 64 == 32 and self.bpm):
            self.on_spot(16 * 60.0 / self.bpm)         # a short spotlight moment on a person

    # ---- state for the UI -------------------------------------------------------------
    def state(self) -> dict[str, Any]:
        with self.lock:
            ap_state = {**self.autopilot, "now": self._cur_mood(),
                        "audio_level": round(self.audio_level, 2),
                        "signal": self.audio_seen and time.monotonic() - self.audio_at < 1.0,
                        "intensity": round(self.audio_gain, 2)}
            active = [{"id": e.id, "kind": e.kind, "category": e.category, "ids": list(e.base)}
                      for e in self.effects.values() if "/" not in e.id and "~" not in e.id]
            active += [{"id": gid, "kind": f"preset:{g['name']}", "category": "preset",
                        "ids": sorted({i for lid in g["layers"] if lid in self.effects for i in self.effects[lid].base})}
                       for gid, g in self.groups.items()]
            return {"active": active, "palette": self.palette, "autopilot": ap_state,
                    "reactions": dict(self.reactions), "bpm": self.bpm,
                    "beat_age": round(time.monotonic() - self.last_beat, 2) if self.last_beat else None,
                    "presets": sorted(self.presets), "speed_scale": round(self.speed_scale, 3),
                    "clock": self.clock.state(), "section": dict(self.section, since=None),
                    "director": self.director.state()}
