"""
smoke.py
========
Smoke machine control ("Dym").

* burst(seconds)   - smoke now for a moment (button, key, MIDI pad)
* hold(on)         - smoke while a button is held
* auto             - a short burst every N minutes (keeps the haze during a show)

Smoke machines use their "dimmer" channel as the smoke output. Effects, the
autopilot, the spotlight and "all lamps" gestures never touch them - only this
controller (and the mixer fader of that device) does.
"""

from __future__ import annotations

import time
from typing import Any


class SmokeController:
    def __init__(self, engine: Any) -> None:
        self.engine = engine
        self.level = 255
        self.until = 0.0
        self.holding = False
        self.auto = {"on": False, "every": 180.0, "dur": 4.0}
        self._next_auto = 0.0
        self._was_on = False

    def machines(self) -> list[Any]:
        return [f for f in self.engine.fixtures.values() if f.type == "smoke"]

    def burst(self, seconds: float = 3.0, level: int | None = None) -> None:
        if level is not None:
            self.level = int(max(0, min(255, level)))
        self.until = max(self.until, time.monotonic() + max(0.3, min(30.0, float(seconds))))

    def hold(self, on: bool) -> None:
        self.holding = bool(on)

    def set_auto(self, on: bool | None = None, every: float | None = None, dur: float | None = None) -> None:
        if on is not None:
            self.auto["on"] = bool(on)
        if every:
            self.auto["every"] = max(20.0, float(every))
        if dur:
            self.auto["dur"] = max(0.5, min(20.0, float(dur)))
        self._next_auto = time.monotonic() + (5.0 if self.auto["on"] else 0.0)

    @property
    def active(self) -> bool:
        return self.holding or time.monotonic() < self.until

    def tick(self) -> None:                    # DMX pre-tick (engine lock held)
        now = time.monotonic()
        if self.auto["on"] and now >= self._next_auto:
            self._next_auto = now + self.auto["every"]
            self.until = max(self.until, now + self.auto["dur"])
        on = self.active
        if on or self._was_on:
            for f in self.machines():
                v = float(self.level) if on else 0.0
                f.target["dimmer"] = f.current["dimmer"] = v
        self._was_on = on

    def to_config(self) -> dict[str, Any]:
        return {"level": self.level, "auto": dict(self.auto)}

    def load_config(self, cfg: dict | None) -> None:
        cfg = cfg or {}
        self.level = int(cfg.get("level", self.level))
        self.auto.update(cfg.get("auto") or {})
        self.set_auto(self.auto["on"])

    def state(self) -> dict[str, Any]:
        now = time.monotonic()
        return {"active": self.active, "left": round(max(0.0, self.until - now), 1), "level": self.level,
                "auto": dict(self.auto), "next": round(max(0.0, self._next_auto - now), 0) if self.auto["on"] else None,
                "machines": len(self.machines())}
