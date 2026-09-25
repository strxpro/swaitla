"""
custom_gestures.py
==================
User-recorded hand poses ("własne gesty") mapped to actions.

Three kinds, recorded the same way (countdown, then hold the pose still for 5 s):
  pose    one hand, one pose              → fires an action once (blackout, colour, effect …)
  motion  one hand, pose + moving the hand → while the pose is held, the hand position
          drives parameters continuously (left/right and up/down each → dimmer, pan, tilt,
          colour, strobe, master, effect tempo)
  two     both hands, each its own pose, together → fires an action once

A pose is stored as the mean of the recorded frames of normalised hand landmarks:
  * wrist moved to the origin, scaled by the palm length (wrist → middle knuckle)
  * rotated so the palm points up, left hands mirrored (one recording works for both hands)
Matching = RMS distance between the live pose and the template (palm units); the
threshold comes from how steady the pose was while recording.

Recording happens first, the action is chosen afterwards: the pose waits in
``pending`` until ``save_pending()`` stores it with a name and an action.
"""

from __future__ import annotations

import math
import time
import uuid
from typing import Any

import numpy as np

ACTIONS = ("blackout", "full", "dark", "flash", "strobe", "home", "next_fixture",
           "color", "effect", "stop_effects", "spotlight", "autopilot", "motion", "smoke", "look")
MOTION_PARAMS = ("none", "dimmer", "pan", "tilt", "hue", "strobe", "master", "fx_speed")
HOLD_FRAMES = 4          # consecutive matching frames before an action fires
RELEASE_S = 0.45         # pose must be gone this long before it can fire again
COUNTDOWN_S = 3.0        # "get ready"
HOLD_S = 5.0             # hold the pose still this long
MOTION_LOST_S = 0.35     # a motion control stays grabbed through short detection gaps


def normalise(landmarks: list, handedness: str, aspect: float) -> np.ndarray:
    P = np.asarray(landmarks, dtype=float)[:, :3].copy()
    P[:, 0] *= aspect
    P[:, 2] *= aspect * 0.5                      # depth is noisy - half weight
    P -= P[0]
    v = P[9, :2]
    scale = float(np.linalg.norm(v)) or 1e-6
    P /= scale
    ang = math.atan2(v[0], -v[1])                # rotate the knuckle direction to "up"
    c, s = math.cos(-ang), math.sin(-ang)
    x, y = P[:, 0].copy(), P[:, 1].copy()
    P[:, 0], P[:, 1] = c * x - s * y, s * x + c * y
    if handedness == "Left":
        P[:, 0] *= -1
    return P


def distance(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.sum((a - b) ** 2, axis=1))))


def _norm(h: dict) -> np.ndarray:
    return normalise(h["landmarks"], h.get("handedness", ""), h.get("aspect", 16 / 9))


def _by_screen(hands: list[dict]) -> list[dict]:
    return sorted(hands, key=lambda h: h.get("palm_center", [0.5, 0.5])[0])


class CustomGestures:
    def __init__(self) -> None:
        self.templates: list[dict[str, Any]] = []
        self.recording: dict[str, Any] | None = None
        self.pending: dict[str, Any] | None = None      # recorded, waiting for a name + action
        self.last_fired: dict[str, Any] | None = None
        self.motion: dict[str, Any] | None = None       # active continuous control
        self._streak: dict[Any, tuple[str | None, int, bool]] = {}
        self._armed: dict[str, float] = {}              # template id → last time the pose was seen

    # ---- persistence -------------------------------------------------------------
    def load(self, items: list[dict] | None) -> None:
        self.templates = []
        for it in items or []:
            try:
                it = dict(it)
                it.setdefault("kind", "pose")
                it["vec"] = np.asarray(it["vec"], dtype=float).reshape(21, 3)
                if it.get("vec2") is not None:
                    it["vec2"] = np.asarray(it["vec2"], dtype=float).reshape(21, 3)
                self.templates.append(it)
            except Exception:
                continue

    def dump(self) -> list[dict[str, Any]]:
        out = []
        for t in self.templates:
            d = {k: v for k, v in t.items() if k not in ("vec", "vec2")}
            d["vec"] = np.round(t["vec"], 4).tolist()
            if t.get("vec2") is not None:
                d["vec2"] = np.round(t["vec2"], 4).tolist()
            out.append(d)
        return out

    # ---- recording ---------------------------------------------------------------
    def start_recording(self, kind: str = "pose", name: str = "", action: str | None = None,
                        params: dict | None = None) -> None:
        """Countdown, then hold the pose for HOLD_S.  Old API (name + action) saves directly."""
        kind = kind if kind in ("pose", "motion", "two") else "pose"
        now = time.monotonic()
        self.pending = None
        self.recording = {"kind": kind, "name": name, "action": action, "params": params or {},
                          "start": now + COUNTDOWN_S, "end": now + COUNTDOWN_S + HOLD_S,
                          "frames": [], "frames2": [], "seen": 0, "need": 2 if kind == "two" else 1,
                          "hint": ""}

    def cancel_recording(self) -> None:
        self.recording = None
        self.pending = None

    def feed_recording(self, hands: list[dict]) -> str | None:
        """Collect frames; returns "ok" / "fail" / "pending" when the recording finishes."""
        rec = self.recording
        if rec is None:
            return None
        now = time.monotonic()
        rec["hint"] = "" if len(hands) >= rec["need"] else ("need2" if rec["need"] == 2 else "need1")
        if now < rec["start"]:
            return None
        if len(hands) >= rec["need"]:
            hs = _by_screen(hands)[:2] if rec["need"] == 2 else [hands[0]]
            rec["frames"].append(_norm(hs[0]))
            if rec["need"] == 2:
                rec["frames2"].append(_norm(hs[1]))
            rec["seen"] += 1
        if now < rec["end"]:
            return None
        self.recording = None
        if len(rec["frames"]) < 20:
            return "fail"
        frames = np.stack(rec["frames"])
        mean = np.median(frames, axis=0)                 # median: a short twitch does not spoil the pose
        spread = float(np.percentile([distance(f, mean) for f in frames], 80))
        tpl = {"kind": rec["kind"], "vec": mean, "thr": float(min(0.36, max(0.18, 2.6 * spread))),
               "quality": round(max(0.0, 1.0 - spread / 0.2), 2)}
        if rec["kind"] == "two":
            f2 = np.stack(rec["frames2"])
            m2 = np.median(f2, axis=0)
            s2 = float(np.percentile([distance(f, m2) for f in f2], 80))
            tpl.update(vec2=m2, thr2=float(min(0.36, max(0.18, 2.6 * s2))))
        if rec.get("action"):                            # legacy one-step flow
            tpl.update(id=uuid.uuid4().hex[:8], name=(rec["name"] or "gest")[:30], action=rec["action"],
                       params=rec["params"])
            self.templates.append(tpl)
            return "ok"
        self.pending = tpl
        return "pending"

    def save_pending(self, name: str, action: str, params: dict | None = None,
                     mapping: dict | None = None) -> dict:
        if self.pending is None:
            raise ValueError("najpierw nagraj gest")
        if action not in ACTIONS:
            raise ValueError(f"nieznana akcja {action!r}")
        tpl = dict(self.pending)
        tpl.update(id=uuid.uuid4().hex[:8], name=(name or "gest").strip()[:30], action=action,
                   params=params or {})
        if tpl["kind"] == "motion":
            m = mapping or {}
            tpl["action"] = "motion"
            tpl["map"] = {"x": m.get("x") if m.get("x") in MOTION_PARAMS else "none",
                          "y": m.get("y") if m.get("y") in MOTION_PARAMS else "dimmer"}
        self.templates.append(tpl)
        self.pending = None
        return tpl

    def delete(self, tid: str) -> None:
        self.templates = [t for t in self.templates if t["id"] != tid]
        if self.motion and self.motion["id"] == tid:
            self.motion = None

    # ---- matching ----------------------------------------------------------------
    def _match_one(self, v: np.ndarray, kinds: tuple[str, ...]) -> dict | None:
        best, best_d = None, 9.0
        for t in self.templates:
            if t.get("kind", "pose") not in kinds:
                continue
            d = distance(v, t["vec"])
            if d < t["thr"] and d < best_d:
                best, best_d = t, d
        return best

    def match(self, h: dict) -> dict | None:
        if not self.templates or "landmarks" not in h:
            return None
        return self._match_one(_norm(h), ("pose", "motion"))

    def _fire(self, key: Any, t: dict, now: float, fired: list) -> None:
        prev, n, gap_ok = self._streak.get(key, (None, 0, True))
        if prev == t["id"]:
            n += 1
        else:                                   # a new streak: was the pose released long enough?
            n, gap_ok = 1, now - self._armed.get(t["id"], 0.0) > RELEASE_S
        self._streak[key] = (t["id"], n, gap_ok)
        if n == HOLD_FRAMES and gap_ok:
            fired.append(t)
            self.last_fired = {"name": t["name"], "action": t["action"], "t": time.time()}
        self._armed[t["id"]] = now

    def update(self, hands: list[dict]) -> tuple[list[dict], set[int], list[tuple[dict, dict]]]:
        """Returns (templates that fire now, slots of hands showing a custom pose,
        active motion controls [(template, hand)])."""
        now = time.monotonic()
        fired: list[dict] = []
        claimed: set[int] = set()
        motions: list[tuple[dict, dict]] = []
        present = {h.get("slot", 0) for h in hands}
        for key in list(self._streak):          # hand left the frame → its streak ends
            if key not in present and key != "two":
                self._streak[key] = (None, 0, True)
        # both hands together
        twos = [t for t in self.templates if t.get("kind") == "two"]
        if twos and len(hands) >= 2:
            a, b = _by_screen(hands)[:2]
            va, vb = _norm(a), _norm(b)
            best, best_d = None, 9.0
            for t in twos:
                da, db = distance(va, t["vec"]), distance(vb, t["vec2"])
                if da < t["thr"] and db < t.get("thr2", t["thr"]) and da + db < best_d:
                    best, best_d = t, da + db
            if best is not None:
                claimed |= {a.get("slot", 0), b.get("slot", 0)}
                self._fire("two", best, now, fired)
            else:
                self._streak["two"] = (None, 0, True)
        elif twos:
            self._streak["two"] = (None, 0, True)
        # one hand
        for h in hands:
            slot = h.get("slot", 0)
            if slot in claimed:
                continue
            m = self.motion
            if m and m["slot"] == slot:                 # grabbed control: keep it while the pose is roughly held
                t = next((x for x in self.templates if x["id"] == m["id"]), None)
                if t is not None and distance(_norm(h), t["vec"]) < t["thr"] * 1.35:
                    m["seen"] = now
                    claimed.add(slot)
                    motions.append((t, h))
                    continue
            t = self.match(h)
            if t is None:
                self._streak[slot] = (None, 0, True)
                continue
            claimed.add(slot)
            if t.get("kind") == "motion":
                prev, n, _ = self._streak.get(slot, (None, 0, True))
                n = n + 1 if prev == t["id"] else 1
                self._streak[slot] = (t["id"], n, True)
                if n >= HOLD_FRAMES:                    # grab after a short hold (no accidental jumps)
                    self.motion = {"id": t["id"], "slot": slot, "seen": now, "start": list(h.get("palm_center", [0.5, 0.5]))}
                    self.last_fired = {"name": t["name"], "action": "motion", "t": time.time()}
                    motions.append((t, h))
                continue
            self._fire(slot, t, now, fired)
        if self.motion and now - self.motion["seen"] > MOTION_LOST_S:
            self.motion = None
        return fired, claimed, motions

    def ui_state(self) -> dict[str, Any]:
        rec = self.recording
        now = time.monotonic()
        pend = self.pending
        return {
            "list": [{k: v for k, v in t.items() if k not in ("vec", "vec2")} for t in self.templates],
            "recording": None if rec is None else {
                "kind": rec["kind"], "name": rec["name"],
                "phase": "wait" if now < rec["start"] else "rec",
                "left": round(max(0.0, (rec["start"] if now < rec["start"] else rec["end"]) - now), 1),
                "progress": round(min(1.0, max(0.0, (now - rec["start"]) / HOLD_S)), 3),
                "seen": rec["seen"], "hint": rec["hint"]},
            "pending": None if pend is None else {"kind": pend["kind"], "quality": pend.get("quality")},
            "motion": None if self.motion is None else {"id": self.motion["id"]},
            "last": self.last_fired,
        }
