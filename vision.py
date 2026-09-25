"""
vision.py
=========
Video Input Manager + Computer Vision pipeline.

* ``VideoSource``        – capture thread; USB/virtual camera index (0, 1, 2 …
                           e.g. Iriun / DroidCam) or IP/RTSP/HTTP URL
                           ("http://192.168.1.X:8080/video").  Source can be
                           switched at runtime; on failure a "NO SIGNAL" test
                           frame is produced and the source is retried.
* ``HandDetector``       – MediaPipe Hand Landmarker (Tasks API, 21 points);
                           falls back to legacy ``mp.solutions.hands``.
* ``GestureInterpreter`` – rotation-invariant finger-state analysis →
                           point / dimmer / crossfade / strobe / color.
* ``ObjectTracker``      – OpenCV CSRT → KCF → MIL bounding-box tracker.
* ``VisionProcessor``    – processing thread: detection / tracking on a
                           downscaled frame, JPEG encoding for the browser,
                           and callback into the interaction layer.
"""

from __future__ import annotations

import logging
import math
import platform
import threading
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable

import cv2
import numpy as np

log = logging.getLogger("vision")

try:
    import mediapipe as mp
    _MP_ERROR = ""
except Exception as e:  # pragma: no cover - depends on local install
    mp = None
    _MP_ERROR = str(e)

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
             "hand_landmarker/float16/latest/hand_landmarker.task")
MODEL_PATH = Path(__file__).resolve().parent / "models" / "hand_landmarker.task"

PROC_WIDTH = 512        # CV runs on this width (lower = lower latency)
STREAM_WIDTH = 960      # JPEG sent to the browser
JPEG_QUALITY = 72
IS_WINDOWS = platform.system() == "Windows"

try:  # silence OpenCV's own probe warnings (we report status in the UI instead)
    cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_SILENT)
except Exception:
    pass


def parse_source(src: Any) -> int | str:
    if isinstance(src, int):
        return src
    s = str(src).strip()
    return int(s) if s.lstrip("-").isdigit() else s


# =============================================================================
# VIDEO INPUT MANAGER
# =============================================================================
class VideoSource:
    def __init__(self, source: int | str = 0, mirror: bool = True,
                 width: int = 1280, height: int = 720):
        self.source: int | str = parse_source(source)
        self.mirror = mirror
        self.req_w, self.req_h = width, height
        self._cond = threading.Condition()
        self._frame: np.ndarray | None = None
        self._frame_id = 0
        self._pending: int | str | None = None
        self._running = False
        self._thread: threading.Thread | None = None
        self.connected = False
        self.status = "starting"
        self.fps = 0.0
        self.width = self.height = 0
        self._ns_base: np.ndarray | None = None
        self._retry_delay = 2.0
        self._wake = False                    # set when Windows reports a new camera: retry now
        self._opening = False
        self._switch_t = time.time()

    @property
    def state(self) -> str:
        """online | connecting | offline  (for the UI status stepper)."""
        if self.connected:
            return "online"
        if self._opening or self._pending is not None or time.time() - self._switch_t < 6:
            return "connecting"
        return "offline"

    # ---- public API ------------------------------------------------------------
    def start(self) -> None:
        self._running = True
        self._thread = threading.Thread(target=self._run, name="video-capture", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)

    def set_source(self, source: int | str) -> None:
        """Switch camera at runtime (thread-safe; applied by the capture thread)."""
        self._pending = parse_source(source)
        self._switch_t = time.time()

    def wake(self) -> None:
        """A camera was plugged in: if this source is not connected, retry right away."""
        if not self.connected:
            self._wake = True

    def wait_frame(self, last_id: int, timeout: float = 0.5) -> tuple[np.ndarray | None, int]:
        with self._cond:
            if self._frame_id == last_id:
                self._cond.wait(timeout)
            return self._frame, self._frame_id

    def info(self) -> dict[str, Any]:
        return {"source": self.source, "connected": self.connected, "status": self.status,
                "state": self.state,
                "fps": round(self.fps, 1), "width": self.width, "height": self.height,
                "mirror": self.mirror}

    # ---- internals -------------------------------------------------------------
    def _open(self, src: int | str) -> cv2.VideoCapture | None:
        self._opening = True
        try:
            return self._open_inner(src)
        finally:
            self._opening = False

    def _open_inner(self, src: int | str) -> cv2.VideoCapture | None:
        self.status = f"connecting to {src}"
        log.log(logging.INFO if self._retry_delay <= 2.0 else logging.DEBUG, "Opening video source %r", src)
        if isinstance(src, int):
            cap = cv2.VideoCapture(src, cv2.CAP_DSHOW) if IS_WINDOWS else cv2.VideoCapture(src)
            if not cap.isOpened() and self._retry_delay <= 2.0:
                cap = cv2.VideoCapture(src)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.req_w)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.req_h)
                cap.set(cv2.CAP_PROP_FPS, 30)
        else:
            try:  # bounded timeouts so a dead phone/IP camera does not hang the probe
                cap = cv2.VideoCapture(src, cv2.CAP_FFMPEG, [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000,
                                                             cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000])
            except Exception:
                cap = cv2.VideoCapture(src, cv2.CAP_FFMPEG)
            # no CAP_ANY fallback for URLs: other backends add ~12 s of dead waiting
        if not cap.isOpened():
            cap.release()
            self.status = f"cannot open source {src!r} - retrying every {self._retry_delay:.0f} s"
            if self._retry_delay <= 2.0:
                log.warning(self.status)
            # back-off: a camera that is not plugged in is probed at most every 30 s (each probe
            # of a missing DirectShow device can stall the other camera); plugging it in wakes us
            self._retry_delay = min(30.0 if isinstance(src, int) else 10.0, self._retry_delay * 1.6)
            return None
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self._retry_delay = 2.0
        self.status = "live"
        return cap

    def _publish(self, frame: np.ndarray) -> None:
        with self._cond:
            self._frame = frame
            self._frame_id += 1
            self._cond.notify_all()
        self.height, self.width = frame.shape[:2]

    def _no_signal_frame(self) -> np.ndarray:
        """Calm placeholder while the camera is missing: camera icon, "Brak obrazu", the source."""
        w, h = 960, 540
        if self._ns_base is None:
            img = np.zeros((h, w, 3), np.uint8)
            img[:] = (29, 22, 22)                                    # #16161d
            cx, cy = w // 2, h // 2 - 40
            cv2.rectangle(img, (cx - 46, cy - 30), (cx + 22, cy + 30), (242, 63, 123), -1, cv2.LINE_AA)   # violet camera
            cv2.fillPoly(img, [np.array([[cx + 26, cy], [cx + 52, cy - 22], [cx + 52, cy + 22]], np.int32)], (242, 63, 123), cv2.LINE_AA)
            cv2.circle(img, (cx - 12, cy), 13, (255, 255, 255), 3, cv2.LINE_AA)
            self._ns_base = img
        img = self._ns_base.copy()
        font = cv2.FONT_HERSHEY_DUPLEX

        def center(text, y, scale, col, th):
            (tw, _), _ = cv2.getTextSize(text, font, scale, th)
            cv2.putText(img, text, ((w - tw) // 2, y), font, scale, col, th, cv2.LINE_AA)
        center("Brak obrazu", h // 2 + 40, 1.1, (255, 255, 255), 2)
        src = f"CAM {self.source}" if isinstance(self.source, int) else str(self.source)[:48]
        center(src, h // 2 + 78, 0.65, (150, 137, 133), 1)
        k = (time.time() * 1.5) % 3                                 # three dots = still trying
        for i in range(3):
            cv2.circle(img, (w // 2 - 16 + i * 16, h // 2 + 104), 4, (242, 63, 123) if int(k) == i else (80, 70, 70), -1, cv2.LINE_AA)
        return img

    @staticmethod
    def _is_file(src: int | str) -> bool:
        return isinstance(src, str) and "://" not in src and Path(src).is_file()

    def _run(self) -> None:
        cap = self._open(self.source)
        fails, next_retry = 0, time.time() + 3
        t_last = time.perf_counter()
        t_next = 0.0
        while self._running:
            if self._pending is not None:
                src, self._pending = self._pending, None
                self._retry_delay = 2.0
                if cap is not None:
                    cap.release()
                self.source, self.connected = src, False
                cap = self._open(src)
                next_retry = time.time() + self._retry_delay
            if cap is None:
                self.connected = False
                if self._wake:
                    self._wake, self._retry_delay, next_retry = False, 2.0, 0.0
                if time.time() >= next_retry:
                    cap = self._open(self.source)
                    next_retry = time.time() + self._retry_delay
                    if cap is not None:
                        continue
                self._publish(self._no_signal_frame())
                time.sleep(1 / 15)
                continue
            is_file = self._is_file(self.source)
            if is_file:                        # recorded video: real-time pace, endless loop
                period = 1.0 / max(5.0, min(60.0, cap.get(cv2.CAP_PROP_FPS) or 30.0))
                delay = t_next - time.perf_counter()
                if delay > 0:
                    time.sleep(delay)
                t_next = max(t_next + period, time.perf_counter() - period)
            ok, frame = cap.read()
            if (not ok or frame is None) and is_file:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ok, frame = cap.read()
            if not ok or frame is None:
                fails += 1
                if fails > 25:
                    log.warning("Video source %r lost – reconnecting", self.source)
                    cap.release()
                    cap, fails, self.connected = None, 0, False
                    self.status = "signal lost - retrying"
                    next_retry = time.time() + 2
                time.sleep(0.01)
                continue
            fails, self.connected = 0, True
            if self.mirror:
                frame = cv2.flip(frame, 1)
            self._publish(frame)
            now = time.perf_counter()
            dt, t_last = now - t_last, now
            if dt > 0:
                self.fps = self.fps * 0.9 + (1.0 / dt) * 0.1
        if cap is not None:
            cap.release()


def scan_cameras(max_index: int = 5, skip: int | None = None) -> list[dict[str, Any]]:
    """Probe camera indices (the currently open one is skipped and reported as in use)."""
    found = []
    for i in range(max_index + 1):
        if i == skip:
            found.append({"index": i, "ok": True, "in_use": True})
            continue
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW) if IS_WINDOWS else cv2.VideoCapture(i)
        ok = cap.isOpened() and cap.read()[0]
        info = {"index": i, "ok": bool(ok)}
        if ok:
            info.update(width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                        height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
        cap.release()
        found.append(info)
    return found


# =============================================================================
# HAND DETECTION (MediaPipe)
# =============================================================================
class HandDetector:
    def __init__(self, num_hands: int = 2):
        self.num_hands = num_hands
        self.backend: str | None = None
        self.status = "initialising"
        self.failed = False
        self._impl: Any = None
        self._ts = 0

    @property
    def ready(self) -> bool:
        return self._impl is not None

    def _model_bytes(self) -> bytes:
        if not MODEL_PATH.exists():
            self.status = "downloading hand_landmarker.task …"
            log.info("Downloading MediaPipe model → %s", MODEL_PATH)
            MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
            with urllib.request.urlopen(MODEL_URL, timeout=30) as r:
                data = r.read()
            MODEL_PATH.write_bytes(data)
        return MODEL_PATH.read_bytes()

    def init(self) -> None:
        if mp is None:
            self.status = f"mediapipe not installed ({_MP_ERROR})"
            self.failed = True
            log.error(self.status)
            return
        errors = []
        try:  # --- MediaPipe Tasks API (mediapipe >= 0.10) ---
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import vision as mp_vision
            opts = mp_vision.HandLandmarkerOptions(
                base_options=mp_python.BaseOptions(model_asset_buffer=self._model_bytes()),
                running_mode=mp_vision.RunningMode.VIDEO,
                num_hands=self.num_hands,
                min_hand_detection_confidence=0.6,
                min_hand_presence_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            self._impl = mp_vision.HandLandmarker.create_from_options(opts)
            self.backend, self.status = "tasks", "MediaPipe HandLandmarker ready"
            log.info(self.status)
            return
        except Exception as e:
            errors.append(f"tasks: {e}")
        try:  # --- legacy solutions API (mediapipe < 0.10.30) ---
            self._impl = mp.solutions.hands.Hands(
                static_image_mode=False, max_num_hands=self.num_hands, model_complexity=1,
                min_detection_confidence=0.6, min_tracking_confidence=0.5)
            self.backend, self.status = "solutions", "MediaPipe Hands (legacy) ready"
            log.info(self.status)
        except Exception as e:
            errors.append(f"solutions: {e}")
            self.failed = True
            self.status = "hand detector unavailable - " + " | ".join(errors)
            log.error(self.status)

    def detect(self, rgb: np.ndarray) -> list[tuple[np.ndarray, str, float]]:
        """Returns [(landmarks[21,3] normalised, handedness, score, world[21,3]|None), …]."""
        out: list[tuple[np.ndarray, str, float]] = []
        if self.backend == "tasks":
            self._ts = max(self._ts + 1, int(time.monotonic() * 1000))
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
            res = self._impl.detect_for_video(image, self._ts)
            for i, lms in enumerate(res.hand_landmarks):
                arr = np.array([[p.x, p.y, p.z] for p in lms], dtype=np.float32)
                cat = res.handedness[i][0] if i < len(res.handedness) and res.handedness[i] else None
                world = None
                if getattr(res, "hand_world_landmarks", None) and i < len(res.hand_world_landmarks):
                    world = np.array([[p.x, p.y, p.z] for p in res.hand_world_landmarks[i]], dtype=np.float32)
                out.append((arr, cat.category_name if cat else "?", float(cat.score) if cat else 0.0, world))
        elif self.backend == "solutions":
            res = self._impl.process(rgb)
            for i, hl in enumerate(res.multi_hand_landmarks or []):
                arr = np.array([[p.x, p.y, p.z] for p in hl.landmark], dtype=np.float32)
                c = res.multi_handedness[i].classification[0] if res.multi_handedness else None
                world = None
                if getattr(res, "multi_hand_world_landmarks", None):
                    world = np.array([[p.x, p.y, p.z] for p in res.multi_hand_world_landmarks[i].landmark], dtype=np.float32)
                out.append((arr, c.label if c else "?", float(c.score) if c else 0.0, world))
        return out


# =============================================================================
# GESTURE INTERPRETER
# =============================================================================
HAND_FILTER = {"mincutoff": 2.0, "beta": 0.09}     # changed from the UI ("Prędkość i płynność")


class OneEuroFilter:
    """1-€ filter: low jitter when the hand is still, no lag when it moves fast.

    Tuned for hand landmarks (normalised units): mincutoff sets the steadiness of
    a motionless hand, beta how quickly the filter opens up during motion.
    """

    def __init__(self, mincutoff: float = 2.0, beta: float = 0.09, dcutoff: float = 1.2):
        self.mincutoff, self.beta, self.dcutoff = mincutoff, beta, dcutoff
        self._x: np.ndarray | None = None
        self._dx: np.ndarray | None = None
        self._t: float | None = None

    @staticmethod
    def _alpha(cutoff: float | np.ndarray, dt: float) -> float | np.ndarray:
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def reset(self) -> None:
        self._x = self._dx = self._t = None

    def __call__(self, x: np.ndarray, t: float) -> np.ndarray:
        if self._x is None or self._t is None:
            self._x, self._dx, self._t = x.copy(), np.zeros_like(x), t
            return self._x
        dt = max(1e-3, min(0.2, t - self._t))
        self._t = t
        dx = (x - self._x) / dt
        self._dx = self._alpha(self.dcutoff, dt) * dx + (1 - self._alpha(self.dcutoff, dt)) * self._dx
        cutoff = self.mincutoff + self.beta * np.abs(self._dx)
        a = self._alpha(cutoff, dt)
        self._x = a * x + (1 - a) * self._x
        return self._x


FINGER_TIPS = (8, 12, 16, 20)
FINGER_PIPS = (6, 10, 14, 18)
PALM_POINTS = (0, 5, 9, 13, 17)
FINGER_CHAINS = ((5, 6, 7, 8), (9, 10, 11, 12), (13, 14, 15, 16), (17, 18, 19, 20))   # MCP PIP DIP TIP


def _bend(P: np.ndarray, a: int, b: int, c: int) -> float:
    """How much a joint is bent (deg): 0 = straight, 90 = right angle."""
    v1, v2 = P[a] - P[b], P[c] - P[b]
    n = float(np.linalg.norm(v1) * np.linalg.norm(v2)) or 1e-9
    return 180.0 - math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(v1, v2)) / n))))


def finger_bends(P3: np.ndarray) -> list[float]:
    """Total bend of PIP + DIP joints per finger, measured in 3-D.

    3-D angles do not shrink when a finger points at the camera (the flat image makes a
    straight finger look short - that used to turn "point" into "fist")."""
    return [_bend(P3, m, p, d) + _bend(P3, p, d, t) for m, p, d, t in FINGER_CHAINS]


class GestureInterpreter:
    """
    Classification (all distances normalised by palm length wrist→middle-MCP,
    measured in aspect-corrected image space, so it is scale/rotation invariant):

      color     : thumb tip ↔ index tip pinch ("OK") with ≥2 other fingers up
      point     : index extended, middle/ring/pinky curled
      dimmer    : all four fingers extended, palm facing camera
      crossfade : all four fingers extended, hand edge-on (narrow palm)
      strobe    : fist / curled fingers – tightness 0..1 from curl ratio
    """

    STABLE_FRAMES = 3           # debounce
    ENTER_FRAMES = {"strobe": 5, "full": 4, "thumbdown": 4, "color": 2, "spin": 2, "point": 1, "dimmer": 1, "crossfade": 2}
    STRAIGHT, CURLED = 62.0, 105.0   # PIP+DIP bend (deg): below = straight finger, above = curled
    EXT_RATIO = 1.18            # tip-wrist / pip-wrist above → finger extended
    PINCH_RATIO = 0.33
    EDGE_ON_WIDTH = 0.42        # index-MCP↔pinky-MCP / palm length below → edge-on
    CURL_OPEN, CURL_TIGHT = 1.05, 0.50
    ROLL_RANGE = 70.0           # ±deg of hand roll mapped to the full hue wheel

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self._filter = OneEuroFilter(HAND_FILTER["mincutoff"], HAND_FILTER["beta"])
        self._wfilter = OneEuroFilter(HAND_FILTER["mincutoff"], HAND_FILTER["beta"] * 8)   # world landmarks (metres)
        self.stable = "none"
        self._cand, self._cand_n = "none", 0
        self._roll: float | None = None
        self._tight = 0.0
        self._world: np.ndarray | None = None

    def analyze(self, lm: np.ndarray, aspect: float, world: np.ndarray | None = None) -> dict[str, Any]:
        now = time.monotonic()
        if world is not None:
            world = self._wfilter(np.asarray(world, dtype=np.float32), now)   # steady 3-D model and finger angles
        self._world = world
        L = self._filter(lm, now)
        P = L[:, :2] * np.array([aspect, 1.0], dtype=np.float32)

        def d(a: int, b: int) -> float:
            return float(np.linalg.norm(P[a] - P[b]))

        palm = max(d(0, 9), 1e-4)
        # finger state from 3-D joint angles (world landmarks in metres; fallback: normalised x, y, z)
        if world is not None:
            P3 = np.asarray(world, dtype=np.float32)
        else:
            P3 = L[:, :3] * np.array([aspect, 1.0, aspect], dtype=np.float32)
        bends = finger_bends(P3)
        prev = self.stable
        # hysteresis: a finger that is "in use" (index while pointing) may bend more before it counts as curled
        lim = [self.STRAIGHT + (28.0 if (i == 0 and prev in ("point", "spin")) or prev in ("dimmer", "crossfade") else 0.0)
               for i in range(4)]
        ext = [b < lim[i] for i, b in enumerate(bends)]
        curled = [b > self.CURLED for b in bends]
        center = P[list(PALM_POINTS)].mean(axis=0)
        curl = float(np.mean([np.linalg.norm(P[t] - center) for t in FINGER_TIPS])) / palm
        pinch = d(4, 8) / palm
        width = d(5, 17) / palm
        v = P[9] - P[0]
        roll = math.degrees(math.atan2(float(v[0]), float(-v[1])))  # 0 = upright, + = tilted right

        thumb_ext = d(4, 17) > d(3, 17) * 1.05 and d(4, 5) > 0.55 * palm
        n_ext = sum(ext)
        if pinch < self.PINCH_RATIO and sum(ext[1:]) >= 2:
            raw = "color"                      # OK / pinch
        elif ext[0] and ext[1] and not ext[2] and not ext[3]:
            raw = "spin"                       # peace sign - rotation / motor speed
        elif ext[0] and not any(ext[1:]):
            raw = "point"                      # index only - aim (wins over "fist" by construction)
        elif n_ext == 4:
            raw = "crossfade" if width < self.EDGE_ON_WIDTH else "dimmer"
        elif all(curled) and thumb_ext and curl < 1.0 and P[4][1] > P[2][1] + 0.25 * palm:
            raw = "thumbdown"                  # thumbs down - "no" (calibration), otherwise nothing
        elif all(curled) and thumb_ext and curl < 1.0:
            raw = "full"                       # thumbs up - snap to full / "yes" in calibration
        elif all(curled) and bends[0] > self.CURLED + 10:
            raw = "strobe"                     # real fist: every finger - index too - clearly curled
        else:
            raw = "none"

        if raw == self._cand:
            self._cand_n += 1
        else:
            self._cand, self._cand_n = raw, 1
        need = self.ENTER_FRAMES.get(self._cand, self.STABLE_FRAMES)
        if prev == "point" and self._cand == "strobe":
            need += 6                          # leaving "point" for "fist" needs a deliberate fist
        if self._cand_n >= need:
            self.stable = self._cand

        tight = min(1.0, max(0.0, (self.CURL_OPEN - curl) / (self.CURL_OPEN - self.CURL_TIGHT)))
        self._tight = 0.6 * self._tight + 0.4 * tight
        self._roll = roll if self._roll is None else 0.7 * self._roll + 0.3 * roll
        hue = min(1.0, max(0.0, (self._roll + self.ROLL_RANGE) / (2 * self.ROLL_RANGE))) * 360.0

        pc = L[list(PALM_POINTS), :2].mean(axis=0)
        return {
            "hand": True,
            "gesture": self.stable,
            "raw_gesture": raw,
            "landmarks": np.round(L, 5).tolist(),
            "world": np.round(self._world, 4).tolist() if self._world is not None else None,
            "index_tip": [round(float(L[8, 0]), 4), round(float(L[8, 1]), 4)],
            "palm_center": [round(float(pc[0]), 4), round(float(pc[1]), 4)],
            "fingers": ext,
            "bends": [round(b, 1) for b in bends],
            "thumb": bool(thumb_ext),
            "tightness": round(self._tight, 3),
            "curl": round(curl, 3),
            "pinch": round(pinch, 3),
            "width_ratio": round(width, 3),
            "roll_deg": round(self._roll, 1),
            "hue": round(hue, 1),
            "aspect": round(aspect, 4),
        }


# =============================================================================
# OBJECT TRACKER (OpenCV)
# =============================================================================
def create_cv_tracker(preferred: str = "CSRT") -> tuple[Any, str]:
    order = [preferred] + [n for n in ("CSRT", "KCF", "MIL") if n != preferred]
    for name in order:
        for ns in (cv2, getattr(cv2, "legacy", None)):
            if ns is None:
                continue
            fn = getattr(ns, f"Tracker{name}_create", None)
            if fn is None:
                cls = getattr(ns, f"Tracker{name}", None)
                fn = getattr(cls, "create", None) if cls is not None else None
            if fn is None:
                continue
            try:
                return fn(), name
            except Exception:
                continue
    raise RuntimeError("no OpenCV tracker available – install opencv-contrib-python")


class ObjectTracker:
    def __init__(self, algo: str = "CSRT"):
        self.algo_pref = algo
        self._lock = threading.Lock()
        self._pending: Any = None
        self._tracker: Any = None
        self.algo: str | None = None
        self.bbox: tuple[float, float, float, float] | None = None
        self.ok = False
        self.lost = 0
        self.error: str | None = None

    def request(self, bbox_norm: tuple[float, float, float, float]) -> None:
        with self._lock:
            self._pending = tuple(float(v) for v in bbox_norm)

    def clear(self) -> None:
        with self._lock:
            self._pending = "clear"

    def update(self, frame: np.ndarray) -> dict[str, Any]:
        h, w = frame.shape[:2]
        with self._lock:
            pending, self._pending = self._pending, None
        if pending == "clear":
            self._tracker, self.bbox, self.ok, self.lost = None, None, False, 0
        elif pending is not None:
            x, y, bw, bh = pending
            rect = (int(x * w), int(y * h), max(8, int(bw * w)), max(8, int(bh * h)))
            try:
                self._tracker, self.algo = create_cv_tracker(self.algo_pref)
                self._tracker.init(frame, rect)
                self.bbox, self.ok, self.lost, self.error = pending, True, 0, None
                log.info("Tracker %s initialised on %s", self.algo, rect)
            except Exception as e:
                self._tracker, self.error = None, str(e)
                log.error("Tracker init failed: %s", e)
        elif self._tracker is not None:
            ok, box = self._tracker.update(frame)
            if ok:
                x, y, bw, bh = box
                self.bbox = (x / w, y / h, bw / w, bh / h)
                self.ok, self.lost = True, 0
            else:
                self.ok = False
                self.lost += 1
        return self.state()

    def state(self) -> dict[str, Any]:
        center = None
        if self.bbox:
            x, y, bw, bh = self.bbox
            center = [round(x + bw / 2, 4), round(y + bh / 2, 4)]
        return {"active": self._tracker is not None, "ok": self.ok,
                "bbox": [round(v, 4) for v in self.bbox] if self.bbox else None,
                "center": center, "algo": self.algo, "lost": self.lost, "error": self.error}


# =============================================================================
# PROCESSING THREAD
# =============================================================================
ResultCallback = Callable[[dict[str, Any], dict[str, Any], str], None]
MODES = ("gesture", "track", "manual")


class VisionProcessor:
    def __init__(self, video: VideoSource, on_result: ResultCallback | None = None,
                 mode: str = "gesture"):
        self.video = video
        self.on_result = on_result
        self.mode = mode if mode in MODES else "gesture"
        self.hands = HandDetector(num_hands=2)
        # one interpreter per tracked hand slot (debounce / smoothing is per hand)
        self.interps = [GestureInterpreter(), GestureInterpreter()]
        self._slot_wrist: list[np.ndarray | None] = [None, None]
        self._slot_miss = [0, 0]
        self._last_out: list[dict[str, Any] | None] = [None, None]
        self.tracker = ObjectTracker()
        self._lock = threading.Lock()
        self._jpeg: bytes | None = None
        self._jpeg_id = 0
        self.perception: dict[str, Any] = {"hand": False, "gesture": "none"}
        self.tracking: dict[str, Any] = self.tracker.state()
        self.proc_fps = 0.0
        self.proc_ms = 0.0
        self.result_id = 0             # +1 per processed frame (the WebSocket pushes on every new result)
        self.want_jpeg = True          # False while no browser shows the camera image (saves ~5 ms per frame)
        self.people_on = False         # detect people also in gesture mode (person calibration)
        self._miss = 0
        self._running = False
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._running = True
        threading.Thread(target=self.hands.init, name="mp-init", daemon=True).start()
        self._thread = threading.Thread(target=self._run, name="vision", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)

    def set_mode(self, mode: str) -> None:
        if mode not in MODES:
            raise ValueError(f"mode must be one of {MODES}")
        self.mode = mode
        if mode != "gesture":
            self.reset_hands()

    def reset_hands(self) -> None:
        for i in (0, 1):
            self.interps[i].reset()
            self._slot_wrist[i], self._slot_miss[i], self._last_out[i] = None, 0, None

    def _assign(self, hands: list) -> list[tuple[int, Any]]:
        """Keep hand identity between frames: match detected wrists to previous slots."""
        def cost(slot: int, lm: np.ndarray) -> float:
            w = self._slot_wrist[slot]
            return 0.25 if w is None else float(np.linalg.norm(lm[0, :2] - w))
        if not hands:
            return []
        if len(hands) == 1:
            slot = min((0, 1), key=lambda s: cost(s, hands[0][0]))
            return [(slot, hands[0])]
        a, b = hands[0], hands[1]
        if cost(0, a[0]) + cost(1, b[0]) <= cost(1, a[0]) + cost(0, b[0]):
            return [(0, a), (1, b)]
        return [(1, a), (0, b)]

    @staticmethod
    def _person_lum(frame: np.ndarray, people: list[dict]) -> dict[str, float] | None:
        """How bright the biggest person is (torso) vs the whole picture - "is the light on me?"."""
        try:
            p = max(people, key=lambda q: q["box"][2] * q["box"][3])
            x, y, w, h = p["box"]
            H, W = frame.shape[:2]
            x0, x1 = int(max(0, (x + w * 0.2) * W)), int(min(W, (x + w * 0.8) * W))
            y0, y1 = int(max(0, (y + h * 0.12) * H)), int(min(H, (y + h * 0.8) * H))
            if x1 - x0 < 4 or y1 - y0 < 4:
                return None
            g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            return {"person": float(g[y0:y1, x0:x1].mean()), "frame": float(g.mean())}
        except Exception:
            return None

    def latest_jpeg(self) -> tuple[int, bytes | None]:
        with self._lock:
            return self._jpeg_id, self._jpeg

    def info(self) -> dict[str, Any]:
        with self._lock:
            return {"mode": self.mode, "proc_fps": round(self.proc_fps, 1),
                    "proc_ms": round(self.proc_ms, 1), "hand_backend": self.hands.backend,
                    "hand_status": self.hands.status, "hand_ready": self.hands.ready,
                    "hand_failed": self.hands.failed,
                    "perception": self.perception, "tracking": self.tracking}

    def _run(self) -> None:
        last_id = -1
        t_last = time.perf_counter()
        while self._running:
            frame, fid = self.video.wait_frame(last_id, timeout=0.5)
            if frame is None or fid == last_id:
                continue
            last_id = fid
            t0 = time.perf_counter()
            h, w = frame.shape[:2]
            proc = frame
            if w > PROC_WIDTH:
                proc = cv2.resize(frame, (PROC_WIDTH, int(h * PROC_WIDTH / w)), interpolation=cv2.INTER_AREA)
            ph, pw = proc.shape[:2]
            mode = self.mode

            perception: dict[str, Any] = {"hand": False, "gesture": "none", "hands": []}
            if mode == "gesture" and self.hands.ready and self.video.connected:
                try:
                    hands = self.hands.detect(cv2.cvtColor(proc, cv2.COLOR_BGR2RGB))[:2]
                except Exception as e:
                    log.exception("hand detection failed: %s", e)
                    hands = []
                seen, outs = set(), []
                for slot, (lm, label, score, world) in self._assign(hands):
                    r = self.interps[slot].analyze(lm, pw / ph, world)
                    r.update(handedness=label, score=round(score, 3), slot=slot)
                    self._slot_wrist[slot], self._slot_miss[slot] = lm[0, :2].copy(), 0
                    seen.add(slot)
                    outs.append(r)
                for slot in (0, 1):                  # forget a hand after ~6 missed frames
                    if slot not in seen:
                        self._slot_miss[slot] += 1
                        if self._slot_miss[slot] <= 2 and self._last_out[slot] is not None:
                            outs.append({**self._last_out[slot], "held": True})   # one missed detection is not "hand gone"
                        if self._slot_miss[slot] > 6:
                            self.interps[slot].reset()
                            self._slot_wrist[slot] = None
                            self._last_out[slot] = None
                for r in outs:
                    if not r.get("held"):
                        self._last_out[r["slot"]] = r
                if outs:
                    outs.sort(key=lambda r: r["palm_center"][0])   # left → right on screen
                    perception = {**outs[0], "hands": outs}

            if mode == "track":
                self.tracker.show_people = True
                tracking = self.tracker.update(proc, fid)
            else:
                self.tracker.show_people = False
                tracking = self.tracker.state()
                det = getattr(self.tracker, "detector", None)
                if self.people_on and det is not None and self.video.connected:
                    det.submit(proc, fid)
                    self.tracker.people = self.tracker.label_people(self.tracker._fresh_people(0.6))
                    tracking = self.tracker.state()

            if self.people_on and tracking.get("people"):
                tracking = {**tracking, "lum": self._person_lum(proc, tracking["people"])}
            if self.on_result is not None:
                try:
                    self.on_result(perception, tracking, mode)
                except Exception:
                    log.exception("interaction callback failed")

            ok, buf = False, None
            if self.want_jpeg or not self._jpeg:
                disp = frame
                if w > STREAM_WIDTH:
                    disp = cv2.resize(frame, (STREAM_WIDTH, int(h * STREAM_WIDTH / w)), interpolation=cv2.INTER_AREA)
                ok, buf = cv2.imencode(".jpg", disp, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])

            now = time.perf_counter()
            with self._lock:
                if ok:
                    self._jpeg, self._jpeg_id = buf.tobytes(), fid
                self.perception, self.tracking = perception, tracking
                self.result_id += 1
                self.proc_ms = self.proc_ms * 0.8 + (now - t0) * 1000 * 0.2
                dt, t_last = now - t_last, now
                if dt > 0:
                    self.proc_fps = self.proc_fps * 0.9 + (1.0 / dt) * 0.1
