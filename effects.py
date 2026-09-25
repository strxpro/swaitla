"""
effects.py
==========
Effect generator (movement / colour / intensity / gobo) and beat reactions.

Effects run inside the DMX engine tick (40 Hz), so they are sample-accurate to
the DMX output and never fight the UI thread.  Every effect remembers the
fixture values it touched and restores them when it stops.

Categories and kinds
  move   circle, figure8, sweep, tilt_wave, random, square, triangle, spiral,
         bounce, fan, position, path (user-drawn shape)
  color  rainbow, two_color, static_color, chase, fire, ocean, gradient, sequence
  dim    pulse, flash, strobe, fade_in, fade_out, breathe, blink, sparkle, saw,
         heartbeat, pattern (16-step user pattern), dark,
         hit (one hit that fades to black by the end), kicks (a hit on every kick, dark in between)

Keyframe envelope (every effect): ``fade_in`` / ``fade_out`` seconds + ``ease``
(linear | smooth | in | out) blend from the lamp's previous look into the effect
and back - e.g. two "position" keyframes with fade_in = an eased move.
``t_offset`` starts an effect part-way (playing a show from the middle of a keyframe).

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

CATEGORY = {
    "circle": "move", "figure8": "move", "sweep": "move", "tilt_wave": "move", "random": "move",
    "square": "move", "triangle": "move", "spiral": "move", "bounce": "move", "fan": "move",
    "position": "move", "path": "move",
    "rainbow": "color", "two_color": "color", "static_color": "color", "chase": "color",
    "fire": "color", "ocean": "color", "gradient": "color", "sequence": "color",
    "pulse": "dim", "flash": "dim", "strobe": "dim", "fade_in": "dim", "fade_out": "dim",
    "breathe": "dim", "blink": "dim", "sparkle": "dim", "saw": "dim", "heartbeat": "dim",
    "pattern": "dim", "dark": "dim", "hit": "dim", "kicks": "dim", "wave": "dim",
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
}
PALETTE = [(255, 40, 40), (255, 140, 0), (255, 230, 0), (40, 255, 90), (0, 200, 255),
           (40, 90, 255), (170, 60, 255), (255, 50, 190), (255, 255, 255)]
TOUCHES = {"move": ("pan", "tilt"), "color": ("red", "green", "blue", "cwheel"),
           "dim": ("dimmer",), "strobe": ("strobe",), "beam": ("gobo",), "laser": ("laser",)}
PRESETS_PATH = Path(__file__).resolve().parent / "presets.json"
FAST_DIM = {"hit", "kicks", "flash", "blink", "pattern", "sparkle", "beat"}   # written straight to the output (no smoothing lag)
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


@dataclass
class Effect:
    id: str
    kind: str
    targets: Any = "all"
    params: dict[str, Any] = field(default_factory=dict)
    duration: float | None = None
    t0: float = field(default_factory=time.monotonic)
    base: dict[int, dict[str, float]] = field(default_factory=dict)
    state: dict[str, Any] = field(default_factory=dict)

    @property
    def category(self) -> str:
        return CATEGORY[self.kind]

    def touched(self) -> tuple[str, ...]:
        return TOUCHES["strobe"] if self.kind == "strobe" else TOUCHES[self.category]


class EffectEngine:
    def __init__(self, engine: Any):
        self.engine = engine
        self.effects: dict[str, Effect] = {}
        self.groups: dict[str, dict[str, Any]] = {}      # preset instances: id → {name, layers: [ids]}
        self.presets: dict[str, dict[str, Any]] = {}
        self.lock = threading.RLock()
        self.reactions = {"flash": False, "color_step": False, "move_step": False, "strobe_drop": False}
        self.bpm: float | None = None
        self.last_beat = 0.0
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
        self.load_presets()

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
            if eid is None:
                self._seq += 1
                eid = f"fx{self._seq}"
            if eid in self.effects or eid in self.groups:
                self.stop(eid)
            if CATEGORY[kind] == "laser" and not isinstance(targets, (list, tuple, int)):
                targets = self.laser_ids()                     # laser effects only ever drive lasers
            ids = self.engine.lights(targets)
            eff = Effect(eid, kind, targets, {**DEFAULTS[kind], **(params or {})}, duration)
            if eff.params.get("t_offset"):
                eff.t0 -= max(0.0, float(eff.params["t_offset"]))
            for i in ids:
                eff.base[i] = {k: self.engine.fixtures[i].target[k] for k in eff.touched()}
            # one effect per category and fixture: a new movement replaces the old one
            for other in list(self.effects.values()):
                if other.category == eff.category and other.kind != "flash" and kind != "flash" \
                        and other.touched() == eff.touched() \
                        and set(self.engine.resolve(other.targets)) & set(ids):
                    self._stop_one(other.id)
            self.effects[eid] = eff
            return eid

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
    def beat(self, strength: float = 1.0, drop: bool = False, bpm: float | None = None) -> None:
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
            self._ap_beat(strength, drop)

    # ---- tick (called by the DMX engine under its lock, 40 Hz) -----------------------
    def laser_ids(self) -> list[int]:
        return [i for i, f in self.engine.fixtures.items() if f.enabled and (f.type == "laser" or any(r.startswith("laser") for r in f.layout()))]

    def apply(self) -> None:
        now = time.monotonic()
        with self.lock:
            for eff in list(self.effects.values()):
                t = now - eff.t0
                if eff.duration is not None and t >= eff.duration:
                    self._stop_one(eff.id)
                    continue
                ids = self._ordered(eff, [i for i in self.engine.lights(eff.targets) if i in eff.base])
                for n, fid in enumerate(ids):
                    self._render(eff, fid, n, len(ids), t)
            for gid, g in list(self.groups.items()):
                if not any(lid in self.effects for lid in g["layers"]):
                    del self.groups[gid]

    def _ordered(self, eff: Effect, ids: list[int]) -> list[int]:
        """Order of the lamps for spread / chase effects: left→right, right→left, centre-out, random."""
        order = eff.params.get("order", "left")
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
            ids = sorted(ids, key=lambda i: abs(ids.index(i) - mid))
        return ids

    def _speed(self, p: dict[str, Any]) -> float:
        """Cycles per second: fixed, or 'beats' per cycle following the current BPM."""
        if p.get("beats") and self.bpm:
            return self.bpm / 60.0 / max(0.125, float(p["beats"])) * self.speed_scale
        return float(p.get("speed", 1.0)) * self.speed_scale

    def _envelope(self, eff: Effect, t: float) -> float:
        p = eff.params
        fi, fo = float(p.get("fade_in", 0) or 0), float(p.get("fade_out", 0) or 0)
        if fi <= 0 and fo <= 0:
            return 1.0
        e = 1.0
        if fi > 0:
            e = min(e, t / fi)
        if fo > 0 and eff.duration:
            e = min(e, (eff.duration - t) / fo)
        e = min(1.0, max(0.0, e))
        return EASES.get(p.get("ease", "smooth"), EASES["smooth"])(e)

    def _render(self, eff: Effect, fid: int, n: int, count: int, t: float) -> None:
        group = "strobe" if eff.kind == "strobe" else eff.category
        if self.engine.is_held(fid, group):          # a gesture / fader is driving this right now
            return
        f = self.engine.fixtures[fid]
        env = self._envelope(eff, t)
        if env < 1.0:                                 # keyframe fade: blend previous look → effect
            saved = {k: f.target[k] for k in eff.touched()}
            self._render_raw(eff, f, fid, n, count, t)
            base = eff.base[fid]
            for k in eff.touched():
                if k == "cwheel":                     # colour wheel cannot blend: switch half-way
                    if env < 0.5:
                        f.target[k] = base.get(k, saved[k])
                    continue
                b = base.get(k, saved[k])
                f.target[k] = b + (f.target[k] - b) * env
        else:
            self._render_raw(eff, f, fid, n, count, t)
        if eff.kind in FAST_DIM:
            f.current["dimmer"] = f.target["dimmer"]

    def _render_raw(self, eff: Effect, f: Any, fid: int, n: int, count: int, t: float) -> None:
        p, base, tgt = eff.params, eff.base[fid], f.target
        phase = n * p.get("spread", 0.0)
        k = eff.kind
        sp = self._speed(p)
        cyc = sp * t + phase                                      # cycles done (+ per-fixture offset)
        if eff.category == "laser":
            on = 1.0
            if k == "laser_hit":
                duty = float(p.get("duty", 0.4))
                hits = p.get("hits") or []
                if hits:                                          # exact hit times (timeline)
                    i = self._last_hit(hits, t)
                    gap = (hits[i + 1][0] - hits[i][0]) if 0 <= i < len(hits) - 1 else 0.5
                    on = 1.0 if i >= 0 and t - hits[i][0] < gap * duty else 0.0
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
            if k == "random":
                st = eff.state.setdefault(fid, {"next": 0.0, "dx": 0.0, "dy": 0.0})
                if p.get("jump"):                              # beat-driven: one jump per start
                    if not st.get("done"):
                        st.update(dx=random.uniform(-1, 1), dy=random.uniform(-1, 1), done=True)
                elif t >= st["next"]:
                    st.update(dx=random.uniform(-1, 1), dy=random.uniform(-1, 1),
                              next=t + 1.0 / max(0.05, sp))
                dx, dy = st["dx"] * size, st["dy"] * size * 0.6
            else:
                w = 2 * math.pi * cyc
                if k == "circle":
                    dx, dy = size * math.cos(w), size * 0.6 * math.sin(w)
                elif k == "figure8":
                    dx, dy = size * math.sin(w), size * 0.5 * math.sin(2 * w)
                elif k == "sweep":
                    dx, dy = size * math.sin(w), 0.0
                elif k == "tilt_wave":
                    dx, dy = 0.0, size * math.sin(w)
                elif k in ("square", "triangle", "path"):
                    pts = {"square": [[-1, -1], [1, -1], [1, 1], [-1, 1]],
                           "triangle": [[0, -1], [1, 1], [-1, 1]]}.get(k) or p.get("points") or [[0, 0]]
                    u = (cyc % 1.0) * len(pts)
                    i0 = int(u) % len(pts)
                    a, b = pts[i0], pts[(i0 + 1) % len(pts)]
                    fr = u - int(u)
                    ky = 1.0 if k == "path" else 0.6            # a drawn path keeps the proportions it was drawn with
                    dx, dy = size * _lerp(a[0], b[0], fr), size * ky * _lerp(a[1], b[1], fr)
                elif k == "spiral":
                    r = 0.2 + 0.8 * (0.5 - 0.5 * math.cos(w / 4))
                    dx, dy = size * r * math.cos(w), size * 0.6 * r * math.sin(w)
                elif k == "bounce":
                    dx, dy = size * math.sin(w / 2), -size * 0.6 * abs(math.sin(w)) + size * 0.3
                else:                                                   # fan: lamps open like a fan
                    spread = (n / (count - 1) * 2 - 1) if count > 1 else 1.0
                    dx, dy = size * spread * (0.5 + 0.5 * math.sin(w)), 0.0
            tgt["pan"] = min(65535.0, max(0.0, base["pan"] + dx / f.pan_deg * 65535))
            tgt["tilt"] = min(65535.0, max(0.0, base["tilt"] + dy / f.tilt_deg * 65535))
        elif eff.category == "color":
            if k == "rainbow":
                r, g, b = (c * 255 for c in colorsys.hsv_to_rgb(cyc % 1.0, 1.0, 1.0))
            elif k == "two_color":
                on_a = int(t * sp * 2 + n) % 2 == 0
                r, g, b = p["color_a"] if on_a else p["color_b"]
            elif k in ("chase", "sequence"):
                cols = p.get("colors") or self.palette or [list(c) for c in PALETTE]
                u = (sp * t + (n * p.get("spread", 0.0) * len(cols))) % len(cols)
                i0 = int(u)
                if p.get("fade"):
                    r, g, b = _mix(cols[i0], cols[(i0 + 1) % len(cols)], u - i0)
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
                    r, g, b = _mix(cols[i0], cols[(i0 + 1) % len(cols)], 0.5 - 0.5 * math.cos(math.pi * (u - i0)))
                else:
                    r, g, b = _mix(p["color_a"], p["color_b"], 0.5 - 0.5 * math.cos(2 * math.pi * cyc))
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
                if p.get("beats") and self.bpm:
                    rate = self.bpm / 60.0 * len(steps) / max(0.25, float(p["beats"]))
                else:
                    rate = float(p.get("speed", 4.0))
                lvl = float(steps[int(t * rate + n * p.get("spread", 0.0) * len(steps)) % len(steps)])
            elif k == "dark":
                lvl = 0.0
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
                period = 60.0 / self.bpm * float(p.get("beats", 1)) if self.bpm else 0.5
                u = (t % period) / period
                floor = float(p.get("floor", 0.0))
                lvl = floor + (1.0 - floor) * (1.0 - u) ** float(p.get("curve", 2.4))
            elif k == "kicks":                                # every kick flashes, dark before the next one
                hits = p.get("hits") or []
                floor = float(p.get("floor", 0.0))
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
                for eid in ("ap-move", "ap-color", "ap-dim", "ap-hit", "ap-drop", "ap-laser"):
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
        mood_name = self._cur_mood()
        mood = MOODS[mood_name]
        pal = [[255, 255, 255]] if self.autopilot.get("white") else (self.palette or [list(c) for c in PALETTE])
        calm = mood_name == "calm"
        mv = self._ap_pick("move", mood["move"])
        if mv:
            # a new movement blends in (slowly when it is calm) instead of jumping
            self.start(mv[0], {**mv[1], "fade_in": 60.0 / self.bpm * (4 if calm else 1) if self.bpm else 1.0,
                               "ease": "smooth"}, "all", None, "ap-move")
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
            self.start(di[0], di[1], "all", None, "ap-dim")
        elif "ap-dim" in self.effects:
            self.stop("ap-dim")

    def _auto_follow(self, strength: float, drop: bool) -> None:
        """The music gets quieter / louder / faster: the style follows (calm -> dynamic -> dance -> hits / rave)."""
        s = max(0.0, min(1.0, strength))
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

    def _ap_beat(self, strength: float, drop: bool) -> None:
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
            ap_state = {**self.autopilot, "now": self._cur_mood()}
            active = [{"id": e.id, "kind": e.kind, "category": e.category, "ids": list(e.base)}
                      for e in self.effects.values() if "/" not in e.id]
            active += [{"id": gid, "kind": f"preset:{g['name']}", "category": "preset",
                        "ids": sorted({i for lid in g["layers"] if lid in self.effects for i in self.effects[lid].base})}
                       for gid, g in self.groups.items()]
            return {"active": active, "palette": self.palette, "autopilot": ap_state,
                    "reactions": dict(self.reactions), "bpm": self.bpm,
                    "beat_age": round(time.monotonic() - self.last_beat, 2) if self.last_beat else None,
                    "presets": sorted(self.presets), "speed_scale": round(self.speed_scale, 3)}
