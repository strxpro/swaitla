"""
spotlight.py
============
Automatic follow spot ("Reflektor na osobę").

While it is on, every lamp points at one person, white light, gobo open (sharp
round spot), full brightness, no strobe - effects keep running on everything else.
The person comes from the stage camera when it is connected (the most prominent
person, or the one already marked), otherwise the main camera switches to
tracking and picks a person by itself; a lost person is searched for again.

``moment(seconds)`` = a short spotlight (the autopilot uses it in quiet parts).
"""

from __future__ import annotations

import threading
import time
from typing import Any


class Spotlight:
    def __init__(self, engine: Any, vision: Any, stagecam: Any, interaction: Any) -> None:
        self.engine, self.vision, self.stagecam, self.interaction = engine, vision, stagecam, interaction
        self.on = False
        self.until = 0.0
        self.source = ""                 # "stage" | "main" | ""
        self.person: int | None = None
        self._saved: dict[str, Any] | None = None
        self._last_auto = 0.0
        self._lost_since = 0.0            # nobody found since … (searching gets calmer)
        self.manual: tuple[float, float] | None = None   # "the person stands here" (clicked on the picture) - no camera tracking
        self._running = True
        threading.Thread(target=self._loop, name="spotlight", daemon=True).start()

    # ---- control -----------------------------------------------------------------
    @property
    def active(self) -> bool:
        return self.on or time.monotonic() < self.until

    def set(self, on: bool) -> None:
        self.on = bool(on)
        if not self.on:
            self.until = 0.0
            self._restore()

    def moment(self, seconds: float) -> None:
        if not self.on:
            self.until = time.monotonic() + max(2.0, seconds)

    def place(self, point: list[float] | None) -> None:
        """Manual spot: every lamp on this camera point (feet of the person). None = back to automatic."""
        self.manual = (float(point[0]), float(point[1])) if point else None
        if self.manual and self._saved is not None:
            self._restore()                       # no tracking needed any more

    def stop(self) -> None:
        self._running = False

    # ---- DMX tick (engine lock held): white, open, full on every lamp --------------------
    def tick(self) -> None:
        if not self.active:
            return
        eng = self.engine
        if self.manual:
            lamps = [i for i, f in eng.fixtures.items() if f.enabled and f.type not in eng.NON_LIGHT]
            eng.aim_person(lamps, self.manual[0], self.manual[1], "main")
            eng.hold("all", "move", 0.3)
            self.source = "manual"
        if not self.source:
            return
        for f in eng.fixtures.values():
            if f.type in eng.NON_LIGHT:
                continue
            t = f.target
            t.update(dimmer=255.0, strobe=0.0, red=255.0, green=255.0, blue=255.0)
            if f.wheel:
                t["cwheel"] = f.wheel_for(255, 255, 255)
            t["gobo"] = 0.0
        for grp in ("color", "dim", "strobe", "beam"):
            eng.hold("all", grp, 0.3)

    # ---- finding the person ----------------------------------------------------------
    def _loop(self) -> None:
        while self._running:
            try:
                if self.active:
                    self._seek()
                elif self._saved is not None:
                    self._restore()
            except Exception:
                pass
            time.sleep(0.25)

    def _seek(self) -> None:
        if self.manual:
            self.source = "manual"
            return
        sc = self.stagecam
        now = time.monotonic()
        if sc.source is not None and sc.video is not None and sc.video.connected:
            if self._saved is None:
                self._saved = {"stage_follow": sc.follow_id, "stage_target": sc.follow_target}
            tracks = [t for t in sc.state()["tracks"] if t["kind"] == "person" and t["ok"]]
            if not any(t["id"] == sc.follow_id for t in tracks) and tracks:
                def score(t: dict) -> float:
                    x, y, w, h = t["box"]
                    return w * h * (1.3 - abs(x + w / 2 - 0.5)) * (1.5 if t["name"] else 1.0)
                best = max(tracks, key=score)
                sc.follow(best["id"], "all")
            elif sc.follow_target != "all" and sc.follow_id is not None:
                sc.follow(sc.follow_id, "all")
            self.source, self.person = "stage", sc.follow_id
            return
        # main camera: tracking mode + follow with every lamp
        v, it = self.vision, self.interaction
        if self._saved is None:
            self._saved = {"mode": v.mode, "follow_all": it.follow_all}
        if v.mode != "track":
            v.set_mode("track")
        it.follow_all = True
        tr = v.tracker
        st = tr.state()
        lost_long = st.get("status") == "searching" and st.get("lost_s", 0) > 4
        if not st.get("active") or lost_long:
            if not self._lost_since:
                self._lost_since = now
            # look for a person every second at first, then every 3 s so an empty stage does not load the computer
            every = 1.0 if now - self._lost_since < 8 else 3.0
            if now - self._last_auto > every:
                self._last_auto = now
                tr.request_auto()
        else:
            self._lost_since = 0.0
        self.source, self.person = "main", None

    def _restore(self) -> None:
        s, self._saved = self._saved, None
        self.source, self.person = "", None
        if not s:
            return
        if "stage_follow" in s:
            self.stagecam.follow(s["stage_follow"], s["stage_target"])
        if "mode" in s:
            self.vision.tracker.clear()
            self.vision.set_mode(s["mode"])
            self.interaction.follow_all = s["follow_all"]

    def state(self) -> dict[str, Any]:
        return {"on": self.on, "active": self.active, "source": self.source, "person": self.person,
                "manual": list(self.manual) if self.manual else None,
                "moment": max(0.0, round(self.until - time.monotonic(), 1)) if not self.on else 0}
