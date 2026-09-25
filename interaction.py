"""
interaction.py
==============
Maps perception results (hand gestures / tracked object) onto DMX fixture
parameters.  Called from the vision thread once per processed frame.

One hand
  point      index-finger tip = crosshair.  Dwell on a fixture icon for
             DWELL_TIME → that fixture becomes active.  Otherwise the tip
             position aims the light at that point of the stage floor.
  dimmer     open palm, palm-centre Y: top of frame = 255, bottom = 0.
  crossfade  open hand edge-on, palm-centre X sweeps a light window across
             all fixtures (ordered by stage position left → right).
  strobe     fist; tightness 0..1 → strobe speed.  Previous strobe values
             are restored when the fist opens.
  color      OK / pinch; hand roll angle → hue (HSV wheel) → RGB.
  spin       peace sign; palm X → continuous rotation speed / direction.
  full       thumbs up; snap the target fixtures to full brightness.

Two hands (combination beats the single-hand action)
  both open palms   distance between the hands → GRAND MASTER
  both fists        strobe on every fixture, tightness → speed
  both OK / pinch   colour of every fixture
  both pointing     left hand aims the leftmost light, right hand the rightmost
"""

from __future__ import annotations

import colorsys
import time
from collections import deque
from typing import Any

from custom_gestures import CustomGestures
from dmx_controller import DMXEngine

DIMMER_ZONE = (0.15, 0.85)      # palm Y (normalised): top → 100 %, bottom → 0 %
CROSSFADE_ZONE = (0.10, 0.90)   # palm X: left → first fixture, right → last
ICON_HIT_RADIUS = 0.07          # fixture icon hit radius (fraction of frame height)
DWELL_TIME = 0.6                # seconds of pointing at an icon to select it
STROBE_MIN, STROBE_MAX = 20, 255
HANDS_SPAN = (0.12, 0.62)       # distance between two palms → 0 … 100 %

# every built-in gesture can be switched off, made stronger / weaker and pointed at another function
GESTURE_DEFAULTS: dict[str, dict[str, Any]] = {
    "point": {"on": True, "gain": 1.0, "target": "aim"},
    "dimmer": {"on": True, "gain": 1.0, "target": "dimmer"},
    "crossfade": {"on": True, "gain": 1.0, "target": "crossfade"},
    "strobe": {"on": True, "gain": 1.0, "target": "strobe"},
    "color": {"on": True, "gain": 1.0, "target": "hue"},
    "spin": {"on": True, "gain": 1.0, "target": "spin"},
    "full": {"on": True, "gain": 1.0, "target": "full"},
}
EXTRA_ACTIONS = ("effect", "flash", "strobe", "smoke", "color", "blackout", "full", "dark", "home", "next_fixture",
                 "spotlight", "autopilot", "look", "stop_effects")
VALUE_TARGETS = ("dimmer", "master", "zoom", "focus", "speed", "strobe", "white", "spin", "pan", "tilt", "hue", "fx_speed", "crossfade")
# a gesture must be held this long before it changes anything (no accidental changes while the hand is re-forming)
ARM_S = {"point": 0.15, "dimmer": 0.3, "crossfade": 0.3, "strobe": 0.35, "color": 0.3, "spin": 0.3, "full": 0.5}
ROLLBACK_S = 0.25               # changes of the last moment before a gesture ends are undone
SNAP_KEYS = ("pan", "tilt", "dimmer", "red", "green", "blue", "cwheel", "spin", "speed")


def _clamp01(v: float) -> float:
    return 0.0 if v < 0 else 1.0 if v > 1 else v


class InteractionController:
    def __init__(self, engine: DMXEngine):
        self.engine = engine
        self.scope = "active"        # gestures act on "active" fixture or "all"
        self.follow_all = False      # tracker drives all fixtures instead of the active one
        self.hover_id: int | None = None
        self.hover_progress = 0.0
        self._hover_t0 = 0.0
        self._strobe_saved: dict[int, float] = {}
        self.paused = False
        self.combo: str | None = None
        self.gestures_enabled = True   # off while the hand drives the user interface
        self.custom = CustomGestures()
        self.effects = None            # EffectEngine, set by main.py
        self.spotlight = None          # Spotlight, set by main.py
        self.smoke = None              # SmokeController, set by main.py
        self.looks = None              # callable(look_id) - recall a saved look, set by main.py
        self.custom_msg: str | None = None
        self.gcfg: dict[str, dict[str, Any]] = {k: dict(v) for k, v in GESTURE_DEFAULTS.items()}
        self.relative = True           # open palm etc. change the value FROM where it is (no jump to the hand height)
        self._gs: dict[int, dict[str, Any]] = {}     # per hand: current gesture, since when, base values, history
        self.mecal = None              # "Kalibracja na mnie" - owns the hands while it runs

    # ---- helpers ---------------------------------------------------------------
    def _targets(self) -> Any:
        if self.scope == "all":                          # every light, never smoke machines / lasers
            return self.engine.lights("all")
        if self.scope == "sel":
            return [i for i in self.engine.selection if i in self.engine.fixtures
                    and self.engine.fixtures[i].enabled
                    and self.engine.fixtures[i].type not in self.engine.NON_LIGHT]
        return None

    def _clear_hover(self) -> None:
        self.hover_id, self.hover_progress = None, 0.0

    def _release_strobe(self) -> None:
        if self._strobe_saved:
            for fid, val in self._strobe_saved.items():
                self.engine.set_param(fid, "strobe", val)
            self._strobe_saved = {}

    # ---- entry point (vision thread) ----------------------------------------------
    def handle(self, perception: dict[str, Any], tracking: dict[str, Any], mode: str) -> None:
        now = time.monotonic()
        if self.paused:            # auto-calibration owns the fixtures
            return
        hands = perception.get("hands") or []
        if self.custom.recording is not None:            # recording a new pose: nothing else runs
            done = self.custom.feed_recording(hands)
            if done:
                self.custom_msg = done
            return
        if self.mecal is not None and self.mecal.active:
            self.mecal.feed(perception, tracking, now)
            return
        if mode == "gesture" and self.gestures_enabled:
            fired, claimed, motions = self.custom.update(hands)
            for tpl in fired:
                self.run_action(tpl["action"], tpl.get("params") or {})
                self.run_list(tpl.get("extra"))
            for tpl, h in motions:
                self._motion(tpl, h)
            if claimed:                                  # custom poses replace the built-in gesture
                perception = {**perception, "hands": [h for h in hands if h.get("slot", 0) not in claimed]}
            self._gesture(perception, now)
        else:
            self._release_strobe()
            self._clear_hover()
        if mode == "track" and tracking.get("active") and tracking.get("ok") and tracking.get("bbox"):
            # feet = bottom centre of the box lie on the floor; aim at torso height above them
            x, y, w, h = tracking["bbox"]
            self.engine.aim_person("all" if self.follow_all else None, x + w / 2, y + h, "main")

    def _gesture(self, p: dict[str, Any], now: float) -> None:
        self.combo = None
        """Both hands are used: each hand's gesture is applied (first hand wins on duplicates),
        e.g. right hand points (Pan/Tilt) while the left hand sets the dimmer."""
        hands = p.get("hands") or ([p] if p.get("hand") else [])
        gestures = [h.get("gesture", "none") for h in hands]
        if "strobe" not in gestures:
            self._release_strobe()
        if "point" not in gestures:
            self._clear_hover()
        if len(hands) == 2 and self._combo(hands, now):
            return
        done: set[str] = set()
        seen_slots = set()
        for h in hands:
            g = h.get("gesture", "none")
            slot = int(h.get("slot", 0))
            seen_slots.add(slot)
            st = self._track(slot, g, now)
            if g == "none" or g in done or h.get("held"):
                continue
            cfg = self.gcfg.get(g, {"on": True})
            if not cfg.get("on", True):
                continue
            if now - st["t0"] < ARM_S.get(g, 0.25):
                continue                                   # not yet: the hand may still be changing shape
            done.add(g)
            if not st.get("fired"):
                st["fired"] = True
                self._run_extras(g, st)
            if cfg.get("target") == "none":
                continue                                   # only the extra actions / effects
            st["hist"].append((now, self._snap()))
            self._apply(g, h, now, st)
        for slot in list(self._gs):                        # hand gone: undo its last moment
            if slot not in seen_slots:
                self._finish(self._gs.pop(slot), now)

    # ---- arming / rollback ---------------------------------------------------------
    def _track(self, slot: int, g: str, now: float) -> dict[str, Any]:
        st = self._gs.get(slot)
        if st is None or st["g"] != g:
            if st is not None:
                self._finish(st, now)
            st = {"g": g, "t0": now, "hist": deque(maxlen=60), "base": None}
            self._gs[slot] = st
        return st

    def _snap(self) -> dict[str, Any]:
        e = self.engine
        with e.lock:
            return {"gm": e.grand_master,
                    "fx": {i: {k: f.target[k] for k in SNAP_KEYS} for i, f in e.fixtures.items()}}

    def _finish(self, st: dict[str, Any], now: float) -> None:
        """A gesture ended: what it did in its last ROLLBACK_S (the hand was already changing) is undone."""
        if st.get("started") and self.effects is not None:     # "while I hold the gesture" effects end with it
            for eid in st["started"]:
                self.effects.stop(eid)
            st["started"] = []
        if st.get("smoke") and self.smoke is not None:
            self.smoke.hold(False)
            st["smoke"] = False
        hist = st.get("hist")
        if not hist or st["g"] in ("strobe", "full", "none"):
            return
        keep = None
        for t, snap in hist:
            if t <= now - ROLLBACK_S:
                keep = snap
        if keep is None:
            keep = hist[0][1]                   # the whole gesture was shorter than that: back to the start
        e = self.engine
        with e.lock:
            e.grand_master = keep["gm"]
            for i, vals in keep["fx"].items():
                f = e.fixtures.get(i)
                if f is not None:
                    f.target.update(vals)

    # ---- value targets ----------------------------------------------------------------
    def _get_u(self, target: str, tgt: Any) -> float:
        e = self.engine
        ids = e.resolve(tgt)
        if target == "master":
            return e.grand_master / 255
        if target == "fx_speed" and self.effects is not None:
            return _clamp01((self.effects.speed_scale - 0.25) / 2.75)
        if not ids:
            return 0.0
        f = e.fixtures[ids[0]]
        if target in ("pan", "tilt"):
            return f.target[target] / 65535
        if target in ("dimmer", "speed", "spin", "strobe"):
            return f.target[target] / 255
        if target in ("zoom", "focus", "white"):
            idx = [i for i, r in enumerate(f.layout()) if r == target]
            return (f.overrides.get(idx[0], 0) / 255) if idx else 0.0
        return 0.5

    def _set_u(self, target: str, u: float, tgt: Any) -> None:
        e, u = self.engine, _clamp01(u)
        if target == "dimmer":
            e.set_params(tgt, {"dimmer": u * 255})
        elif target == "master":
            e.grand_master = int(round(u * 255))
        elif target in ("pan", "tilt"):
            e.set_axis_norm(tgt, target, u)
        elif target == "hue":
            r, g, b = colorsys.hsv_to_rgb(u, 1.0, 1.0)
            e.set_params(tgt, {"red": r * 255, "green": g * 255, "blue": b * 255, "cwheel": u * 120})
        elif target == "strobe":
            e.set_params(tgt, {"strobe": 0 if u < 0.08 else STROBE_MIN + u * (STROBE_MAX - STROBE_MIN)})
        elif target in ("speed", "spin"):
            e.set_params(tgt, {target: u * 255})
        elif target in ("zoom", "focus", "white"):
            for fid in e.resolve(tgt):
                for i, r in enumerate(e.fixtures[fid].layout()):
                    if r == target:
                        e.chan_set(fid, i, int(u * 255))
        elif target == "crossfade":
            e.crossfade(u)
        elif target == "fx_speed" and self.effects is not None:
            self.effects.speed_scale = 0.25 + u * 2.75

    def _value(self, st: dict[str, Any], target: str, axis: str, p: dict[str, Any], absolute: float, gain: float,
               tgt: Any) -> float:
        """Relative: the value moves from where it was when the gesture started, by how far the hand moved."""
        x, y = p["palm_center"]
        if not self.relative or target == "crossfade":
            return 0.5 + (absolute - 0.5) * gain
        if st["base"] is None:
            st["base"] = {"u": self._get_u(target, tgt), "x": x, "y": y}
        b = st["base"]
        delta = (b["y"] - y) / (DIMMER_ZONE[1] - DIMMER_ZONE[0]) if axis == "y" else (x - b["x"]) / (CROSSFADE_ZONE[1] - CROSSFADE_ZONE[0])
        return b["u"] + delta * gain

    def _run_extras(self, g: str, st: dict[str, Any]) -> None:
        """Extra actions bound to a built-in gesture: several effects / actions at once."""
        c = self.gcfg.get(g) or {}
        hold = c.get("extra_mode", "hold") == "hold"
        st["started"] = []
        for i, x in enumerate(c.get("extra") or []):
            a, prm = x.get("action"), x.get("params") or {}
            fx = self.effects
            if hold and a == "effect" and fx is not None:
                eid = f"gx-{g}-{i}"
                fx.start(prm.get("kind", "rainbow"), None, "all", None, eid)
                st["started"].append(eid)
            elif hold and a == "strobe" and fx is not None:
                eid = f"gx-{g}-{i}"
                fx.start("strobe", {"speed": 225}, "all", None, eid)
                st["started"].append(eid)
            elif hold and a == "smoke" and self.smoke is not None:
                self.smoke.hold(True)
                st["smoke"] = True
            else:
                self.run_action(a, prm)

    def run_list(self, items: list[dict[str, Any]] | None) -> None:
        for x in items or []:
            self.run_action(x.get("action", ""), x.get("params") or {})

    def set_gesture(self, g: str, **kw: Any) -> None:
        if g not in self.gcfg:
            return
        c = self.gcfg[g]
        if "extra" in kw:
            c["extra"] = [{"action": x["action"], "params": dict(x.get("params") or {})}
                          for x in (kw["extra"] or []) if x.get("action") in EXTRA_ACTIONS][:8]
        if "extra_mode" in kw:
            c["extra_mode"] = "once" if kw["extra_mode"] == "once" else "hold"
        if "on" in kw:
            c["on"] = bool(kw["on"])
        if "gain" in kw:
            c["gain"] = max(0.2, min(3.0, float(kw["gain"])))
        if "target" in kw and (kw["target"] in VALUE_TARGETS or kw["target"] in ("none", GESTURE_DEFAULTS[g]["target"])):
            c["target"] = kw["target"]

    def load_cfg(self, d: dict[str, Any] | None) -> None:
        for g, c in (d or {}).items():
            self.set_gesture(g, **{k: v for k, v in c.items() if k in ("on", "gain", "target", "extra", "extra_mode")})

    def _combo(self, hands: list[dict[str, Any]], now: float) -> bool:
        """Two-hand gestures. Returns True when the combination handled this frame."""
        a, b = hands
        ga, gb = a.get("gesture", "none"), b.get("gesture", "none")
        if ga != gb:
            return False
        ax, ay = a["palm_center"]
        bx, by = b["palm_center"]
        span = ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5

        self.engine.hold("all", {"strobe": "strobe", "color": "color", "point": "move"}.get(ga, "dim"))
        if ga == "dimmer":                       # pull the hands apart = brighter rig
            lvl = _clamp01((span - HANDS_SPAN[0]) / (HANDS_SPAN[1] - HANDS_SPAN[0]))
            self.engine.grand_master = int(round(lvl * 255))
            self.combo = "master"
            return True
        if ga == "strobe":                       # both fists = strobe everything
            ids = self.engine.resolve("all")
            for fid, val in self.engine.get_values(ids, "strobe").items():
                self._strobe_saved.setdefault(fid, val)
            tight = max(float(a.get("tightness", 0)), float(b.get("tightness", 0)))
            self.engine.set_params(ids, {"strobe": STROBE_MIN + tight * (STROBE_MAX - STROBE_MIN)})
            self.combo = "strobe_all"
            return True
        if ga == "color":                        # both OK = colour everything
            hue = (float(a.get("hue", 0)) + float(b.get("hue", 0))) / 2
            r, gg, bb = colorsys.hsv_to_rgb(hue / 360.0, 1.0, 1.0)
            self.engine.set_params("all", {"red": r * 255, "green": gg * 255, "blue": bb * 255})
            self.combo = "color_all"
            return True
        if ga == "point":                        # one light per hand
            ids = self.engine.resolve("all")
            if len(ids) >= 2:
                order = sorted(ids, key=lambda i: self.engine.fixtures[i].pos[0])
                left, right = (a, b) if ax <= bx else (b, a)
                self.engine.set_position_norm(order[0], *left["index_tip"])
                self.engine.set_position_norm(order[-1], *right["index_tip"])
                self.combo = "aim_two"
                return True
        return False

    def run_action(self, action: str, params: dict[str, Any]) -> None:
        """Action bound to a custom gesture."""
        e, fx = self.engine, self.effects
        if action == "blackout":
            e.blackout = not e.blackout
        elif action == "full":
            e.blackout = False
            e.set_params(e.lights("all"), {"dimmer": 255, "strobe": 0}); e.hold("all", "dim", 1.0)
        elif action == "dark":
            e.set_params(e.lights("all"), {"dimmer": 0}); e.hold("all", "dim", 1.0)
        elif action == "smoke" and self.smoke is not None:
            self.smoke.burst(float(params.get("seconds", 3)))
        elif action == "look" and self.looks is not None:
            self.looks(params.get("id"))
        elif action == "flash" and fx:
            fx.start("flash", {"decay": 0.35}, duration=0.9, eid="g-flash")
        elif action == "strobe" and fx:
            fx.start("strobe", {"speed": 225}, duration=2.0, eid="g-strobe")
        elif action == "home":
            e.home("all"); e.hold("all", "move", 1.0)
        elif action == "next_fixture":
            ids = sorted(e.fixtures)
            if ids:
                i = ids.index(e.active_id) + 1 if e.active_id in ids else 0
                e.select(ids[i % len(ids)])
        elif action == "color":
            r, g, b = (params.get("rgb") or [255, 255, 255])[:3]
            hue = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0]
            e.set_params(self._targets(), {"red": r, "green": g, "blue": b, "cwheel": hue * 120})
            e.hold(self._targets(), "color", 1.0)
        elif action == "effect" and fx:
            kind = params.get("kind", "circle")
            eid = "g-" + kind
            if any(a["id"] == eid for a in fx.state()["active"]):
                fx.stop(eid)
            else:
                fx.start(kind, None, "all", None, eid)
        elif action == "stop_effects" and fx:
            fx.stop_all()
        elif action == "spotlight" and self.spotlight is not None:
            self.spotlight.set(not self.spotlight.on)
        elif action == "autopilot" and fx:
            mood = params.get("mood")
            fx.set_autopilot(on=not fx.autopilot["on"] or bool(mood and mood != fx.autopilot["mood"]), mood=mood)

    def _motion(self, tpl: dict[str, Any], h: dict[str, Any]) -> None:
        """Pose held + hand moving: left/right and up/down drive the chosen parameters."""
        x, y = h.get("palm_center", [0.5, 0.5])
        u = {"x": _clamp01((x - 0.15) / 0.7), "y": _clamp01((0.85 - y) / 0.7)}      # right / up = more
        tgt, e = self._targets(), self.engine
        for axis, prm in (tpl.get("map") or {}).items():
            v = u.get(axis, 0.5)
            if prm == "dimmer":
                e.set_params(tgt, {"dimmer": v * 255}); e.hold(tgt, "dim", 0.6)
            elif prm in ("pan", "tilt"):
                e.set_axis_norm(tgt, prm, v if prm == "pan" else 1 - v); e.hold(tgt, "move", 0.6)
            elif prm == "hue":
                r, g, b = colorsys.hsv_to_rgb(v, 1.0, 1.0)
                e.set_params(tgt, {"red": r * 255, "green": g * 255, "blue": b * 255}); e.hold(tgt, "color", 0.6)
            elif prm == "strobe":
                e.set_params(tgt, {"strobe": 0 if v < 0.08 else STROBE_MIN + v * (STROBE_MAX - STROBE_MIN)})
                e.hold(tgt, "strobe", 0.6)
            elif prm == "master":
                e.grand_master = int(round(v * 255))
            elif prm == "fx_speed" and self.effects is not None:
                self.effects.speed_scale = 0.25 + v * 2.75

    def _apply(self, g: str, p: dict[str, Any], now: float, st: dict[str, Any] | None = None) -> None:
        tgt = self._targets()
        st = st or {"base": None}
        cfg = self.gcfg.get(g, {})
        gain, target = float(cfg.get("gain", 1.0)), cfg.get("target")
        group = {"point": "move", "dimmer": "dim", "full": "dim", "color": "color", "strobe": "strobe",
                 "crossfade": "dim"}.get(g)
        if group:                     # live gesture wins over any running effect
            self.engine.hold("all" if g == "crossfade" else tgt, group)

        if g == "point":
            x, y = p["index_tip"]
            hit = self.engine.fixture_at(x, y, ICON_HIT_RADIUS, p.get("aspect", 16 / 9))
            if hit is not None:
                if hit != self.engine.active_id:
                    if self.hover_id != hit:
                        self.hover_id, self._hover_t0 = hit, now
                    self.hover_progress = min(1.0, (now - self._hover_t0) / DWELL_TIME)
                    if self.hover_progress >= 1.0:
                        self.engine.select(hit)
                        self._clear_hover()
                return  # aiming at an icon never moves the lights
            self._clear_hover()
            self.engine.set_position_norm(tgt, x, y)

        elif g == "dimmer":
            y = p["palm_center"][1]
            lvl = _clamp01((DIMMER_ZONE[1] - y) / (DIMMER_ZONE[1] - DIMMER_ZONE[0]))
            self._set_u(target or "dimmer", self._value(st, target or "dimmer", "y", p, lvl, gain, tgt), tgt)

        elif g == "crossfade":
            x = p["palm_center"][0]
            u = _clamp01((x - CROSSFADE_ZONE[0]) / (CROSSFADE_ZONE[1] - CROSSFADE_ZONE[0]))
            self._set_u(target or "crossfade", self._value(st, target or "crossfade", "x", p, u, gain, tgt),
                        "all" if (target or "crossfade") == "crossfade" else tgt)

        elif g == "strobe":
            ids = self.engine.resolve(tgt)
            for fid, val in self.engine.get_values(ids, "strobe").items():
                self._strobe_saved.setdefault(fid, val)
            tight = _clamp01(float(p.get("tightness", 0)) * gain)
            speed = STROBE_MIN + tight * (STROBE_MAX - STROBE_MIN)
            self.engine.set_params(ids, {"strobe": speed})

        elif g == "color":
            hue = float(p.get("hue", 0))
            if target and target != "hue":                 # hand roll drives another function
                self._set_u(target, 0.5 + (hue / 360.0 - 0.5) * gain, tgt)
            else:
                r, gg, b = colorsys.hsv_to_rgb(hue / 360.0, 1.0, 1.0)
                # colour-wheel fixtures: the discrete colour slots sit in the lower half of the channel
                self.engine.set_params(tgt, {"red": r * 255, "green": gg * 255, "blue": b * 255,
                                             "cwheel": hue / 360.0 * 120})

        elif g == "spin":          # peace sign: palm X → rotation speed and direction
            x = _clamp01((p["palm_center"][0] - 0.1) / 0.8)
            if target and target != "spin":
                self._set_u(target, self._value(st, target, "x", p, x, gain, tgt), tgt)
            else:
                self.engine.set_params(tgt, {"spin": 128 + (x - 0.5) * 2 * 120 * min(1.0, gain)})

        elif g == "full":          # thumbs up: snap to full brightness
            self.engine.set_params(tgt, {"dimmer": 255, "strobe": 0})

    def ui_state(self) -> dict[str, Any]:
        return {"scope": self.scope, "follow_all": self.follow_all, "combo": self.combo,
                "gestures_enabled": self.gestures_enabled,
                "gcfg": self.gcfg, "relative": self.relative, "targets": VALUE_TARGETS, "extra_actions": EXTRA_ACTIONS,
                "mecal": self.mecal.state() if self.mecal is not None else None,
                "custom": self.custom.ui_state(),
                "hover_id": self.hover_id, "hover_progress": round(self.hover_progress, 3),
                "icon_radius": ICON_HIT_RADIUS,
                "zones": {"dimmer": DIMMER_ZONE, "crossfade": CROSSFADE_ZONE}}
