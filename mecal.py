"""
mecal.py - "Kalibracja na mnie": the lights find you by themselves.

You stand still in front of the camera. For every moving light in turn (lasers and smoke never -
a laser is never aimed at a person):
  1. base    the lamp is dark for a moment: how bright is your silhouette without it?
  2. search  the lamp sweeps a grid around where it thinks you are; after every step the
             camera measures the brightness of your torso. The brightest spot wins
  3. refine  a finer grid around the winner
  4. found   your silhouette clearly lit up -> the spot is saved, next lamp
If no position lights you up clearly, the lamp falls back to "confirm": thumbs up 3 s = it is
on me, thumbs down 1.5 s = point with a finger to correct (relative), thumbs up saves.

Quick = only the middle (one spot per lamp, the pointing mapping is shifted by it).
Exact = middle, left, right (three spots -> a full fit, spotlight and tracking hit you anywhere).
Order: all lamps at one spot, then you move to the next spot - you walk only three times.
"""

from __future__ import annotations

import time
from typing import Any

HOLD_YES, HOLD_NO = 3.0, 1.5
FIND_STEADY = 0.8
NUDGE = 0.30                     # finger across the whole picture = 30 % of the lamp's range
BASE_S = 0.7                     # dark lamp: measure the silhouette
SETTLE_S, SAMPLE_S = 0.42, 0.16  # after every move: let the head arrive, then measure
PAN_STEP_DEG, TILT_STEP_DEG = 9.0, 7.0
FOUND_DELTA = 14.0               # silhouette brighter by this many grey levels (0-255) = the light is on you
FOUND_SHOW_S = 1.0


def _spiral(nx: int, ny: int) -> list[tuple[int, int]]:
    pts = [(i, j) for i in range(-nx, nx + 1) for j in range(-ny, ny + 1)]
    return sorted(pts, key=lambda p: (abs(p[0]) + abs(p[1]) * 1.3, abs(p[0]), p))


class MeCalibrator:
    def __init__(self, engine: Any, vision: Any, on_done: Any = None) -> None:
        self.engine, self.vision, self.on_done = engine, vision, on_done
        self.active = False
        self.lamps: list[int] = []
        self.spots: tuple[str, ...] = ("center",)
        self.li = self.si = 0
        self.phase = "idle"
        self.saved = self.skipped = 0
        self.msg = ""
        self._reset_step()
        self._restore: dict[int, float] = {}
        self._people_before = False
        self._feet: tuple[float, float] | None = None
        self._lum: dict[str, float] | None = None

    def _reset_step(self) -> None:
        self._seen_since: float | None = None
        self._hold_kind: str | None = None
        self._hold_t0 = 0.0
        self._point_base: tuple[float, float, float, float] | None = None
        self._t0 = 0.0
        self._samples: list[float] = []
        self._base = 0.0
        self._grid: list[tuple[float, float]] = []
        self._gi = 0
        self._best: tuple[float, float, float] | None = None       # score, pan, tilt
        self._center: tuple[float, float] = (0.0, 0.0)
        self.score = 0.0
        self.tried = self.total = 0

    # ------------------------------------------------------------------ control
    def candidates(self) -> list[int]:
        e = self.engine
        return [i for i, f in sorted(e.fixtures.items(), key=lambda kv: (kv[1].pos[0], kv[0]))
                if f.enabled and f.type not in ("laser", "smoke") and "pan" in f.layout() and "tilt" in f.layout()]

    def start(self, ids: list[int] | None = None, spots: int = 1) -> str | None:
        lamps = [i for i in (ids or self.candidates()) if i in self.candidates()]
        if not lamps:
            return "nolamps"
        self.lamps, self.li, self.si, self.saved, self.skipped = lamps, 0, 0, 0, 0
        self.spots = ("center", "left", "right") if spots >= 3 else ("center",)
        self._people_before = bool(getattr(self.vision, "people_on", False))
        self.vision.people_on = True
        e = self.engine
        with e.lock:
            self._restore = {i: f.target["dimmer"] for i, f in e.fixtures.items()}
            for i in lamps:                                   # clear old spots for this camera: a fresh calibration
                if e.fixtures[i].aim_points:
                    e.aim_point_clear(i, "main")
        self.active = True
        self._lamp_on(dark=True)
        self.phase = "find"
        return None

    def stop(self, finished: bool = False) -> None:
        if not self.active:
            return
        self.active = False
        self.phase = "done" if finished else "idle"
        e = self.engine
        with e.lock:
            for i, v in self._restore.items():
                if i in e.fixtures:
                    e.fixtures[i].target["dimmer"] = v
        e.hold("all", "move", 0)
        e.hold("all", "dim", 0)
        self.vision.people_on = self._people_before
        if self.on_done:
            self.on_done()

    @property
    def lamp(self) -> int | None:
        return self.lamps[self.li] if self.active and self.li < len(self.lamps) else None

    def _lamp_on(self, dark: bool = False) -> None:
        """Only the lamp being taught may light (white, open) - so the camera sees only its light."""
        e, cur = self.engine, self.lamp
        with e.lock:
            for i, f in e.fixtures.items():
                if f.type in ("laser", "smoke"):
                    continue
                if i == cur:
                    f.target.update({"dimmer": 0 if dark else 255, "strobe": 0, "red": 255, "green": 255, "blue": 255})
                    if "speed" in f.target:
                        f.target["speed"] = 0                  # fastest motors while searching
                else:
                    f.target["dimmer"] = 0
        if cur is not None:
            e.select(cur)
        e.hold("all", "move", 3600)
        e.hold("all", "dim", 3600)

    def _next(self, saved: bool) -> None:
        if saved:
            self.saved += 1
        else:
            self.skipped += 1
        self.li += 1
        if self.li >= len(self.lamps):                         # every lamp done at this spot -> next spot
            self.li = 0
            self.si += 1
            if self.si >= len(self.spots):
                self.stop(finished=True)
                return
            self._reset_step()
            self._lamp_on(dark=True)
            self.phase = "find"
            return
        self._reset_step()
        self._lamp_on(dark=True)
        self.phase = "base" if self._feet is not None else "find"
        self._t0 = time.monotonic()

    # ------------------------------------------------------------------ buttons (helper at the computer)
    def yes(self) -> None:
        if self.active and self.phase in ("confirm", "adjust", "search", "refine", "found"):
            self._save()

    def no(self) -> None:
        if not self.active:
            return
        if self.phase == "adjust":
            self._next(False)
        else:
            self._to_manual(adjust=True)

    def skip(self) -> None:
        if self.active:
            self._next(False)

    def nudge(self, dx: float, dy: float) -> None:
        cur = self.lamp
        if cur is None:
            return
        e = self.engine
        with e.lock:
            f = e.fixtures[cur]
            f.target["dimmer"] = 255
            sx, sy = (-1 if f.flip_x else 1), (-1 if f.flip_y else 1)
            f.target["pan"] = max(0.0, min(65535.0, f.target["pan"] + dx * sx * 0.02 * 65535))
            f.target["tilt"] = max(0.0, min(65535.0, f.target["tilt"] + dy * sy * 0.02 * 65535))
        if self.phase != "adjust":
            self.phase = "adjust"

    def _to_manual(self, adjust: bool = False) -> None:
        cur = self.lamp
        if cur is not None:
            with self.engine.lock:
                self.engine.fixtures[cur].target["dimmer"] = 255
        self.phase = "adjust" if adjust else "confirm"
        self._point_base = None
        self._hold_kind = None

    def _save(self) -> None:
        cur = self.lamp
        if cur is None:
            return
        if self._feet is None:
            self.msg = "noperson"
            return
        self.engine.aim_point_add(cur, self._feet[0], self._feet[1], "main")
        self._next(True)

    # ------------------------------------------------------------------ automatic search
    def _sample(self) -> float | None:
        if not self._lum:
            return None
        return self._lum["person"]

    def _plan(self, cur: int, fine: bool) -> None:
        e = self.engine
        f = e.fixtures[cur]
        if fine and self._best:
            cp, ct = self._best[1], self._best[2]
            sp, st, nx, ny = PAN_STEP_DEG / 2, TILT_STEP_DEG / 2, 1, 1
        else:
            e.aim_person(cur, self._feet[0], self._feet[1], "main")          # best guess first
            cp, ct = f.target["pan"], f.target["tilt"]
            sp, st, nx, ny = PAN_STEP_DEG, TILT_STEP_DEG, 3, 2
        dp = sp / max(1.0, f.pan_deg) * 65535
        dt = st / max(1.0, f.tilt_deg) * 65535
        self._center = (cp, ct)
        self._grid = [(max(0.0, min(65535.0, cp + i * dp)), max(0.0, min(65535.0, ct + j * dt))) for i, j in _spiral(nx, ny)]
        if fine:
            self._grid = self._grid[1:]                      # the centre is the winner already measured
        self._gi = 0
        self.tried, self.total = 0, len(self._grid)
        self._go_point(time.monotonic())

    def _go_point(self, now: float) -> None:
        cur = self.lamp
        pan, tilt = self._grid[self._gi]
        with self.engine.lock:
            f = self.engine.fixtures[cur]
            f.target["pan"], f.target["tilt"] = pan, tilt
            f.target["dimmer"] = 255
        self._t0 = now
        self._samples = []

    def _search_step(self, now: float) -> None:
        if now - self._t0 < SETTLE_S:
            return
        v = self._sample()
        if v is not None:
            self._samples.append(v)
        if now - self._t0 < SETTLE_S + SAMPLE_S:
            return
        score = (sum(self._samples) / len(self._samples) - self._base) if self._samples else -1.0
        pan, tilt = self._grid[self._gi]
        if self._best is None or score > self._best[0]:
            self._best = (score, pan, tilt)
        self.score = max(self.score, score)
        self.tried = self._gi + 1
        self._gi += 1
        if self._gi < len(self._grid):
            self._go_point(now)
            return
        # grid done
        if self.phase == "search":
            if self._best and self._best[0] >= FOUND_DELTA * 0.6:
                self.phase = "refine"
                self._plan(self.lamp, fine=True)
            else:
                self._to_manual()                            # could not see the light on you: thumbs decide
            return
        # refine done: aim at the brightest and save
        with self.engine.lock:
            f = self.engine.fixtures[self.lamp]
            f.target["pan"], f.target["tilt"] = self._best[1], self._best[2]
        if self._best[0] >= FOUND_DELTA:
            self.phase, self._t0 = "found", now
        else:
            self._to_manual()

    # ------------------------------------------------------------------ vision frames
    def feed(self, perception: dict[str, Any], tracking: dict[str, Any], now: float) -> None:
        if not self.active or self.lamp is None:
            return
        people = tracking.get("people") or []
        person = max(people, key=lambda p: p["box"][2] * p["box"][3]) if people else None
        if person:
            x, y, w, h = person["box"]
            self._feet = (x + w / 2, min(1.0, y + h))
        self._lum = tracking.get("lum") if person else None
        hands = perception.get("hands") or []
        gests = [h.get("gesture") for h in hands if not h.get("held")]
        cur, e = self.lamp, self.engine

        # thumbs work in every phase: up = "it is on me", down = "no, I correct it"
        kind = "yes" if "full" in gests else "no" if "thumbdown" in gests else None
        if kind != self._hold_kind:
            self._hold_kind, self._hold_t0 = kind, now
        if kind == "yes" and now - self._hold_t0 >= HOLD_YES and self.phase not in ("find", "base"):
            self._hold_kind = None
            self._save()
            return
        if kind == "no" and now - self._hold_t0 >= HOLD_NO and self.phase not in ("find", "base"):
            self._hold_kind = None
            if self.phase == "adjust":
                self._next(False)
            else:
                self._to_manual(adjust=True)
            return

        if self.phase == "find":
            if person is None:
                self._seen_since = None
                return
            self._seen_since = self._seen_since or now
            if now - self._seen_since >= FIND_STEADY:
                self._lamp_on(dark=True)
                self.phase, self._t0, self._samples = "base", now, []
            return
        if self.phase == "base":
            v = self._sample()
            if v is not None and now - self._t0 > 0.25:
                self._samples.append(v)
            if now - self._t0 >= BASE_S:
                if not self._samples or person is None:
                    self._to_manual()                        # no brightness reading (no detector): by hand
                    return
                self._base = sum(self._samples) / len(self._samples)
                self._best, self.score = None, 0.0
                self.phase = "search"
                self._plan(cur, fine=False)
            return
        if self.phase in ("search", "refine"):
            if person is None:
                return                                         # wait until you are back in the picture
            self._search_step(now)
            return
        if self.phase == "found":
            if now - self._t0 >= FOUND_SHOW_S:
                self._save()
            return
        if self.phase == "confirm" and person is not None and "full" not in gests and "thumbdown" not in gests \
                and self._best is None:
            e.aim_person(cur, self._feet[0], self._feet[1], "main")
        if self.phase == "adjust":
            pt = next((h for h in hands if h.get("gesture") == "point" and not h.get("held")), None)
            if pt:
                tx, ty = pt["index_tip"]
                with e.lock:
                    f = e.fixtures[cur]
                    if self._point_base is None:
                        self._point_base = (tx, ty, f.target["pan"], f.target["tilt"])
                    bx, by, bp, bt = self._point_base
                    sx, sy = (-1 if f.flip_x else 1), (-1 if f.flip_y else 1)
                    f.target["pan"] = max(0.0, min(65535.0, bp + (tx - bx) * sx * NUDGE * 65535))
                    f.target["tilt"] = max(0.0, min(65535.0, bt + (ty - by) * sy * NUDGE * 65535))
            else:
                self._point_base = None

    def state(self) -> dict[str, Any]:
        cur = self.lamp
        f = self.engine.fixtures.get(cur) if cur is not None else None
        hold = 0.0
        if self._hold_kind:
            hold = min(1.0, (time.monotonic() - self._hold_t0) / (HOLD_YES if self._hold_kind == "yes" else HOLD_NO))
        bright = 0.0
        if self._lum and self.phase in ("search", "refine", "found"):
            bright = max(0.0, min(1.0, (self._lum["person"] - self._base) / FOUND_DELTA))
        return {"active": self.active, "phase": self.phase, "lamp": {"id": cur, "name": f.name} if f else None,
                "lamp_i": self.li, "lamps_n": len(self.lamps), "spot": self.spots[self.si] if self.si < len(self.spots) else None,
                "spot_i": self.si, "spots_n": len(self.spots), "person": self._feet is not None,
                "hold": round(hold, 3), "hold_kind": self._hold_kind, "saved": self.saved, "skipped": self.skipped,
                "tried": self.tried, "total": self.total, "bright": round(bright, 3), "msg": self.msg}
