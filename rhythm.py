"""
rhythm.py
=========
Beat clock: the lights run on their own copy of the music's beat grid.

The browser's beat tracker (static/beatcore.js) or the timeline sends a grid
update a few times per second: tempo, time until the next beat, which beat of the
bar that is, and how sure the tracker is.  The clock turns this into a continuous
beat position (beats counted since the lock, fractional) that

* never jumps on small tempo drift - phase errors are slewed in halves,
* leads the audio by ``offset`` seconds (DMX frame + lamp reaction, user-calibrated),
* keeps running through short gaps (a missed update, a breakdown without drums)
  and lets go only after ``HOLD_BEATS`` beats without news.

The effect engine calls :meth:`tick` every DMX frame and fires its beat reactions
on each new integer, so every effect, flash and colour cut lands on one grid.
"""

from __future__ import annotations

import math
import threading
import time
from typing import Any


class RhythmClock:
    HOLD_BEATS = 16          # free-run through a gap this long (a drum-less break) before letting go
    RELOCK_AFTER = 3         # this many updates in a row far off the grid = the music changed: jump

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.offset = 0.04   # s; positive = the light comes earlier than the sound
        self.reset()

    def reset(self) -> None:
        with self.lock:
            self.period = 0.5
            self.anchor_t = 0.0
            self.anchor_b = 0.0
            self.locked = False
            self.confidence = 0.0
            self.updated = 0.0
            self.bar_offset = 0
            self.source = ""
            self._last_int: int | None = None
            self._bad = 0

    # ---- reading --------------------------------------------------------------
    @property
    def bpm(self) -> float | None:
        return 60.0 / self.period if self.locked else None

    def pos(self, now: float | None = None) -> float:
        """Continuous beat position; integers are the (offset-shifted) beats."""
        now = time.monotonic() if now is None else now
        return self.anchor_b + (now - self.anchor_t) / self.period

    def phase(self, now: float | None = None) -> float:
        return self.pos(now) % 1.0

    def in_bar(self, beat: int) -> int:
        return (beat - self.bar_offset) % 4

    def alive(self, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        return self.locked and now - self.updated < self.HOLD_BEATS * self.period

    # ---- writing --------------------------------------------------------------
    def update(self, bpm: float, next_in: float, beat_in_bar: int | None = None,
               confidence: float = 1.0, now: float | None = None, source: str = "live") -> None:
        """A grid report: ``next_in`` seconds from now the audio has a beat."""
        now = time.monotonic() if now is None else now
        if not bpm or not math.isfinite(bpm) or not math.isfinite(next_in):
            return
        period = 60.0 / max(40.0, min(240.0, float(bpm)))
        target = now + float(next_in) - self.offset          # when that beat must light up
        with self.lock:
            fresh = not self.locked or now - self.updated > self.HOLD_BEATS * self.period
            if not fresh:
                # tempo: continuous - re-anchor at "now" so the position does not jump
                b_now = self.pos(now)
                self.anchor_b, self.anchor_t = b_now, now
                self.period = self.period * 0.6 + period * 0.4 if abs(period / self.period - 1) < 0.08 else period
                err = round(self.pos(target)) - self.pos(target)      # beats, -0.5 .. 0.5
                if abs(err) > 0.3:
                    self._bad += 1
                    fresh = self._bad >= self.RELOCK_AFTER
                else:
                    self._bad = 0
                    self.anchor_b += err * 0.5                         # slew half of the error now
            if fresh:
                self._bad = 0
                self.period = period
                nxt = (self._last_int + 1) if self._last_int is not None else 0
                b_now = nxt - (target - now) / period
                if self._last_int is not None and b_now < self._last_int:
                    nxt = self._last_int + 1                           # never count backwards
                self.anchor_b, self.anchor_t = float(nxt), target
                self.locked = True
            self.confidence = max(0.0, min(1.0, float(confidence)))
            self.updated = now
            self.source = source
            if beat_in_bar is not None:
                k = round(self.pos(target))
                self.bar_offset = (k - int(beat_in_bar)) % 4

    def release(self) -> None:
        with self.lock:
            self.locked = False
            self._bad = 0

    def tick(self, now: float | None = None) -> list[tuple[int, int]]:
        """New beats since the last call: [(beat number, beat in bar 0..3)]."""
        now = time.monotonic() if now is None else now
        with self.lock:
            if not self.locked:
                return []
            if now - self.updated > self.HOLD_BEATS * self.period:
                self.locked = False
                return []
            cur = math.floor(self.pos(now))
            if self._last_int is None:                                  # first frame after the lock: count from here
                self._last_int = cur
                return []
            if cur <= self._last_int:
                return []
            first = max(self._last_int + 1, cur - 1)                    # a stall never fires a burst
            self._last_int = cur
            return [(b, self.in_bar(b)) for b in range(first, cur + 1)]

    def state(self) -> dict[str, Any]:
        now = time.monotonic()
        alive = self.alive(now)
        p = self.pos(now) if alive else 0.0
        return {"locked": alive, "bpm": round(60.0 / self.period, 1) if alive else None,
                "phase": round(p % 1.0, 3), "beat": self.in_bar(math.floor(p)) if alive else None,
                "bar": (math.floor(p) - self.bar_offset) // 4 if alive else None,
                "confidence": round(self.confidence, 2), "offset_ms": round(self.offset * 1000),
                "source": self.source if alive else ""}
