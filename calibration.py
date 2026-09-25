"""
calibration.py
==============
AUTO-CALIBRATION of a fixture's stage position with the camera.

Procedure (runs in a background thread, ~15-20 s per fixture):
  1. all other fixtures dark, this one white @ 100 %, strobe open
  2. capture a reference frame with this fixture dark
  3. move through a 3×3 grid of Pan/Tilt offsets around the current aim,
     capture each frame, locate the light spot as the brightest blob of the
     difference image (frame − reference)
  4. convert each spot to floor coordinates (camera homography from stage.py)
  5. solve fixture position [x, y, z] + yaw (Levenberg-Marquardt, stage.solve_pose)
  6. restore every fixture value

Requirements: physical DMX output, the camera sees the floor where the beam
lands, the floor corners are calibrated (KALIBRUJ PODŁOGĘ) and mount type /
pan & tilt degrees / inversion flags match the real fixture.
"""

from __future__ import annotations

import copy
import logging
import threading
import time
from typing import Any

import cv2
import numpy as np

import dmx_controller
import stage as stage_mod

log = logging.getLogger("calibration")

SETTLE_S = 1.4            # moving-head travel + camera latency per sample
MIN_SPOT_DIFF = 35        # min. brightness gain (0-255) to accept a spot
PAN_STEP_DEG = 14.0
TILT_STEP_DEG = 10.0
MAX_RMS_M = 0.6


def find_spot(frame: np.ndarray, ref: np.ndarray) -> tuple[float, float, float] | None:
    """Brightest blob of (frame − ref) → (x_norm, y_norm, peak) or None."""
    g = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (15, 15), 0)
    diff = cv2.subtract(g, ref)
    _, peak, _, _ = cv2.minMaxLoc(diff)
    if peak < MIN_SPOT_DIFF:
        return None
    _, mask = cv2.threshold(diff, peak * 0.6, 255, cv2.THRESH_BINARY)
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask)
    if n < 2:
        return None
    i = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    h, w = diff.shape
    return float(cents[i][0] / w), float(cents[i][1] / h), float(peak)


class AutoCalibrator:
    def __init__(self, engine: Any, video: Any, interaction: Any, on_success: Any = None):
        self.engine, self.video, self.interaction = engine, video, interaction
        self.on_success = on_success
        self.state: dict[str, Any] = {"running": False, "fid": None, "step": 0, "total": 0,
                                      "message": "", "ok": None, "samples": []}
        self._stop = False

    def start(self, fid: int) -> str | None:
        if self.state["running"]:
            return "kalibracja już trwa"
        if fid not in self.engine.fixtures:
            return "brak oprawy"
        if not dmx_controller.ENABLE_PHYSICAL_DMX:
            return "auto-kalibracja wymaga prawdziwej lampy (DMX INTERFACE ≠ VIRTUAL)"
        if not self.video.connected:
            return "brak obrazu z kamery"
        self._stop = False
        threading.Thread(target=self._run, args=(fid,), daemon=True, name="autocal").start()
        return None

    def cancel(self) -> None:
        self._stop = True

    def _grab(self, n: int = 3) -> np.ndarray:
        """Average of n fresh frames (reduces sensor noise)."""
        acc, last = None, -1
        for _ in range(n):
            frame, fid = self.video.wait_frame(last, timeout=1.0)
            last = fid
            g = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (15, 15), 0).astype(np.float32)
            acc = g if acc is None else acc + g
        return (acc / n).astype(np.uint8), frame

    def _set(self, msg: str, **kw: Any) -> None:
        self.state.update(message=msg, **kw)
        log.info("autocal: %s", msg)

    def _run(self, fid: int) -> None:
        eng = self.engine
        with eng.lock:
            saved = {i: copy.deepcopy(f.target) for i, f in eng.fixtures.items()}
            saved_bo = eng.blackout
            f = eng.fixtures[fid]
            center = (f.target["pan"], f.target["tilt"])
        self.interaction.paused = True
        grid = [(dp, dt) for dt in (-1, 0, 1) for dp in (-1, 0, 1)]
        self.state.update(running=True, fid=fid, step=0, total=len(grid), ok=None, samples=[])
        samples: list[tuple[float, float, float, float]] = []
        try:
            with eng.lock:
                eng.blackout = False
                for i, o in eng.fixtures.items():
                    o.target["dimmer"] = 0
                f.target.update(red=255, green=255, blue=255, strobe=0, dimmer=0)
            self._set("pomiar tła (lampa zgaszona)…")
            time.sleep(SETTLE_S)
            ref, _ = self._grab()
            pan_step = PAN_STEP_DEG / f.pan_deg * 65535
            tilt_step = TILT_STEP_DEG / f.tilt_deg * 65535
            for k, (dp, dt) in enumerate(grid, 1):
                if self._stop:
                    raise RuntimeError("przerwano")
                pan = min(65535, max(0, center[0] + dp * pan_step))
                tilt = min(65535, max(0, center[1] + dt * tilt_step))
                with eng.lock:
                    f.target.update(pan=pan, tilt=tilt, dimmer=255)
                self._set(f"punkt {k}/{len(grid)} – szukam plamy światła…", step=k)
                time.sleep(SETTLE_S)
                _, frame = self._grab(1)
                spot = find_spot(frame, ref)
                if spot is None:
                    continue
                X, Z = eng.stage.image_to_floor(spot[0], spot[1])
                samples.append((pan, tilt, X, Z))
                self.state["samples"].append([round(spot[0], 4), round(spot[1], 4)])
            if len(samples) < 4:
                raise RuntimeError(f"znaleziono tylko {len(samples)} plam – skieruj światło na podłogę "
                                   "widoczną w kamerze i przyciemnij salę")
            self._set("obliczam pozycję…")
            pos, yaw, rms = stage_mod.solve_pose(f, samples, eng.stage.truss_height)
            if rms > MAX_RMS_M:
                raise RuntimeError(f"słabe dopasowanie (błąd {rms:.2f} m) – sprawdź montaż, zakres "
                                   "pan/tilt, odwrócenie osi i kalibrację podłogi")
            with eng.lock:
                f.pos, f.yaw = pos, yaw
            self._set(f"OK: pozycja {pos} m, obrót {yaw}°, błąd {rms:.2f} m", ok=True)
        except Exception as e:
            self._set(f"BŁĄD: {e}", ok=False)
        finally:
            with eng.lock:
                for i, t in saved.items():
                    if i in eng.fixtures:
                        eng.fixtures[i].target.update(t)
                eng.blackout = saved_bo
            self.interaction.paused = False
            self.state["running"] = False
            if self.state.get("ok") and self.on_success:   # save after the rig state is restored
                self.on_success()
