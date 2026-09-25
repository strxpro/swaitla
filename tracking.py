"""
tracking.py
===========
Following people and objects - with automatic re-acquisition.

* ``Detector``      – finds people (and objects) in a frame.  Uses the MediaPipe
                      ObjectDetector when ``models/efficientdet_lite0.tflite`` is
                      present (80 COCO classes, better), otherwise OpenCV's
                      built-in HOG people detector (no download needed).
* ``AsyncDetector`` – runs a Detector on the newest frame in its own thread so
                      the camera loop never waits for it.
* ``SmartTracker``  – follows one target on the main camera:
                      CSRT/KCF box tracker + colour-appearance check + motion
                      prediction.  When the target is lost (occluded, left the
                      frame, tracker drifted) it predicts the motion for a
                      moment and keeps searching - among detected people and by
                      colour back-projection - until the same target is found
                      again, then locks on automatically.
* ``StageWatcher``  – optional second camera looking at the whole stage:
                      detects and numbers every person, maps their feet onto
                      the floor (own 4-corner calibration), lets the user name /
                      mark people and objects and follow one of them with light.
"""

from __future__ import annotations

import logging
import math
import threading
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable

import cv2
import numpy as np

from vision import VideoSource, create_cv_tracker, parse_source

log = logging.getLogger("tracking")

try:
    import mediapipe as mp
except Exception:  # pragma: no cover
    mp = None

DET_MODEL_PATH = Path(__file__).resolve().parent / "models" / "efficientdet_lite0.tflite"
DET_MODEL_URLS = (
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite",
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite",
)
STAGE_PROC_WIDTH = 480
MARK_COLORS = ["#2b8cff", "#e98a00", "#16a34a", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#65a30d"]


def download_detector_model() -> str:
    """Fetch the better people/object model (≈4 MB) on request from the UI."""
    DET_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    err = ""
    for url in DET_MODEL_URLS:
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = r.read()
            if len(data) > 100_000:
                DET_MODEL_PATH.write_bytes(data)
                return ""
        except Exception as e:
            err = str(e)
    return err or "download failed"


# =============================================================================
# DETECTION
# =============================================================================
def _iou(a: tuple, b: tuple) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(0.0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0.0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def _nms(dets: list[dict], thr: float = 0.45) -> list[dict]:
    dets = sorted(dets, key=lambda d: -d["score"])
    keep: list[dict] = []
    for d in dets:
        if all(_iou(d["box"], k["box"]) < thr for k in keep):
            keep.append(d)
    return keep


class Detector:
    """People (+ objects with the MediaPipe model).  Boxes are normalised (x, y, w, h)."""

    def __init__(self) -> None:
        self.backend = "none"
        self._mp: Any = None
        self._hog: Any = None
        self.reload()

    def reload(self) -> None:
        self._mp = None
        if mp is not None and DET_MODEL_PATH.exists():
            try:
                from mediapipe.tasks import python as mp_python
                from mediapipe.tasks.python import vision as mp_vision
                opts = mp_vision.ObjectDetectorOptions(
                    base_options=mp_python.BaseOptions(model_asset_buffer=DET_MODEL_PATH.read_bytes()),
                    running_mode=mp_vision.RunningMode.IMAGE, max_results=12, score_threshold=0.35)
                self._mp = mp_vision.ObjectDetector.create_from_options(opts)
                self.backend = "mediapipe"
                return
            except Exception as e:
                log.warning("ObjectDetector unavailable (%s) - using HOG", e)
        if self._hog is None:
            self._hog = cv2.HOGDescriptor()
            self._hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        self.backend = "hog"

    def detect(self, bgr: np.ndarray, people_only: bool = False) -> list[dict]:
        h, w = bgr.shape[:2]
        out: list[dict] = []
        if self._mp is not None:
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            res = self._mp.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
            for d in res.detections:
                cat = d.categories[0] if d.categories else None
                label = cat.category_name if cat else "?"
                if people_only and label != "person":
                    continue
                b = d.bounding_box
                out.append({"box": (b.origin_x / w, b.origin_y / h, b.width / w, b.height / h),
                            "score": float(cat.score) if cat else 0.5, "label": label})
            return _nms(out)
        # HOG: tuned for speed on a ~480 px frame (upscale small frames so people ≥ 128 px tall fit)
        scale = 1.0
        img = bgr
        if w < 400:
            scale = 400 / w
            img = cv2.resize(bgr, None, fx=scale, fy=scale)
        rects, weights = self._hog.detectMultiScale(img, winStride=(8, 8), padding=(8, 8), scale=1.08)
        H, W = img.shape[:2]
        for (x, y, bw, bh), sc in zip(rects, np.ravel(weights) if len(rects) else []):
            if sc < 0.35:
                continue
            # HOG boxes are loose: trim 10 % on each side
            x, y, bw, bh = x + bw * 0.1, y + bh * 0.05, bw * 0.8, bh * 0.9
            out.append({"box": (x / W, y / H, bw / W, bh / H), "score": float(min(1.0, sc / 2)),
                        "label": "person"})
        return _nms(out, 0.3)


class AsyncDetector:
    """Detection in a worker thread: submit() the newest frame, read the latest result."""

    def __init__(self, people_only: bool = False) -> None:
        self.det = Detector()
        self.people_only = people_only
        self._cond = threading.Condition()
        self._frame: np.ndarray | None = None
        self._fid = 0
        self.result: tuple[int, list[dict], float] = (-1, [], 0.0)
        self.ms = 0.0
        self._running = True
        threading.Thread(target=self._run, name="detector", daemon=True).start()

    def submit(self, frame: np.ndarray, fid: int) -> None:
        with self._cond:
            self._frame, self._fid = frame, fid
            self._cond.notify()

    def _run(self) -> None:
        while self._running:
            with self._cond:
                while self._frame is None and self._running:
                    self._cond.wait(0.5)
                frame, fid, self._frame = self._frame, self._fid, None
            if frame is None:
                continue
            t0 = time.perf_counter()
            try:
                dets = self.det.detect(frame, self.people_only)
            except Exception as e:
                log.warning("detector failed: %s", e)
                dets = []
            self.ms = self.ms * 0.8 + (time.perf_counter() - t0) * 200
            self.result = (fid, dets, time.monotonic())

    def stop(self) -> None:
        self._running = False
        with self._cond:
            self._cond.notify()


# =============================================================================
# APPEARANCE MODEL
# =============================================================================
def _inner(box_px: tuple[int, int, int, int], shape: tuple) -> tuple[int, int, int, int] | None:
    """Centre part of a box (less background around a person)."""
    x, y, w, h = box_px
    H, W = shape[:2]
    x0, x1 = int(x + w * 0.18), int(x + w * 0.82)
    y0, y1 = int(y + h * 0.08), int(y + h * 0.92)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W, x1), min(H, y1)
    if x1 - x0 < 3 or y1 - y0 < 3:
        return None
    return x0, y0, x1, y1


def appearance(frame_hsv: np.ndarray, box_px: tuple) -> np.ndarray | None:
    r = _inner(box_px, frame_hsv.shape)
    if r is None:
        return None
    x0, y0, x1, y1 = r
    roi = frame_hsv[y0:y1, x0:x1]
    hist = cv2.calcHist([roi], [0, 1, 2], None, [12, 8, 6], [0, 180, 0, 256, 0, 256])
    cv2.normalize(hist, hist, 1.0, 0, cv2.NORM_L1)
    return hist


def back_project(hsv: np.ndarray, hist: np.ndarray) -> np.ndarray:
    """Per-pixel likelihood of the target colours (cv2.calcBackProject is unreliable for 3-D hists)."""
    lut = hist / max(1e-9, float(hist.max()))
    return lut[(hsv[..., 0].astype(np.int32) * 12) // 180,
               hsv[..., 1] >> 5,
               np.minimum(5, (hsv[..., 2].astype(np.int32) * 6) >> 8)] * 255.0


def similarity(a: np.ndarray | None, b: np.ndarray | None) -> float:
    """1 = identical colours, 0 = nothing in common."""
    if a is None or b is None:
        return 0.0
    return float(1.0 - cv2.compareHist(a, b, cv2.HISTCMP_BHATTACHARYYA))


def _px(box: tuple, shape: tuple) -> tuple[int, int, int, int]:
    H, W = shape[:2]
    x, y, w, h = box
    return int(x * W), int(y * H), max(6, int(w * W)), max(6, int(h * H))


def _clip_box(box: tuple) -> tuple:
    x, y, w, h = box
    w, h = min(max(w, 0.01), 1.0), min(max(h, 0.01), 1.0)
    return (min(max(x, -w * 0.5), 1 - w * 0.5), min(max(y, -h * 0.5), 1 - h * 0.5), w, h)


# =============================================================================
# SMART TRACKER (one target, re-acquires on its own)
# =============================================================================
class SmartTracker:
    """Drop-in replacement for vision.ObjectTracker with loss recovery.

    status:  idle | tracking | coasting (short loss, motion predicted) |
             searching (lost - looking for it) | reacquired (found again, shown ~1 s)
    """
    COAST_S = 0.6            # predict the motion this long after a loss (light keeps moving)
    SIM_KEEP = 0.42          # appearance similarity needed to trust the box tracker
    SIM_FIND = 0.50          # … and to accept a re-found candidate

    def __init__(self, algo: str = "CSRT", detector: AsyncDetector | None = None):
        self.algo_pref = algo
        self.detector = detector
        self._lock = threading.Lock()
        self._pending: Any = None
        self._tracker: Any = None
        self.algo: str | None = None
        self.bbox: tuple | None = None
        self.ok = False
        self.lost = 0
        self.error: str | None = None
        self.status = "idle"
        self.conf = 0.0
        self.label = ""
        self.is_person = False
        self.model: np.ndarray | None = None
        self.vel = np.zeros(2)                 # centre velocity (normalised units / s)
        self._last_t = 0.0
        self._lost_t = 0.0
        self._bad = 0
        self._found_t = 0.0
        self._snap_t = 0.0
        self._lost_box: tuple | None = None
        self._fid = 0
        self.people: list[dict] = []          # latest detections (clickable in the UI)
        self.show_people = False
        self._pids: list[tuple[int, tuple, float]] = []   # (id, box, last seen) - stable numbers
        self._next_pid = 1
        self.recent: list[dict] = []          # people who left the picture recently

    # ---- requests (any thread) ------------------------------------------------
    def request(self, bbox_norm: tuple) -> None:
        with self._lock:
            self._pending = ("box", tuple(float(v) for v in bbox_norm))

    def request_point(self, x: float, y: float) -> None:
        """Click on the video: follow the detected person under the click, else a box around it."""
        with self._lock:
            self._pending = ("point", (float(x), float(y)))

    def request_auto(self) -> None:
        """Follow the most prominent person without clicking."""
        with self._lock:
            self._pending = ("auto", None)

    def clear(self) -> None:
        with self._lock:
            self._pending = ("clear", None)

    @property
    def active(self) -> bool:
        return self.model is not None

    # ---- internals ------------------------------------------------------------
    def _start(self, frame: np.ndarray, hsv: np.ndarray, box: tuple, label: str = "") -> None:
        box = _clip_box(box)
        rect = _px(box, frame.shape)
        try:
            self._tracker, self.algo = create_cv_tracker(self.algo_pref)
            self._tracker.init(frame, rect)
            self.error = None
        except Exception as e:
            self._tracker, self.error = None, str(e)
            log.error("tracker init failed: %s", e)
            return
        self.bbox, self.ok, self.lost, self._bad = box, True, 0, 0
        self.model = appearance(hsv, rect)
        self.label = label or self.label
        self.is_person = (label == "person") or self.is_person
        self.status, self.conf = "tracking", 1.0
        self._snap_t = time.monotonic()

    def label_people(self, dets: list[dict]) -> list[dict]:
        """Give every detected person a number that stays while they move."""
        now = time.monotonic()
        out, used = [], set()
        for d in sorted(dets, key=lambda d: -d["box"][2] * d["box"][3]):
            best, bi = None, 0.25
            for pid, box, _t in self._pids:
                if pid in used:
                    continue
                iou = _iou(box, d["box"])
                near = math.hypot(box[0] + box[2] / 2 - d["box"][0] - d["box"][2] / 2,
                                  box[1] + box[3] / 2 - d["box"][1] - d["box"][3] / 2) < 0.08
                score = iou + (0.3 if near else 0.0)
                if score > bi:
                    best, bi = pid, score
            if best is None:
                best = self._next_pid
                self._next_pid += 1
            used.add(best)
            out.append({**d, "id": best})
        keep = [(pid, box, t) for pid, box, t in self._pids if pid not in used and now - t < 1.5]
        for pid, box, t in self._pids:
            if pid not in used and now - t >= 1.5 and not any(r["id"] == pid for r in self.recent):
                self.recent = ([{"id": pid, "t": time.time()}] + self.recent)[:6]
        self._pids = keep + [(d["id"], d["box"], now) for d in out]
        self.recent = [r for r in self.recent if time.time() - r["t"] < 30 and r["id"] not in used]
        return out

    def _fresh_people(self, max_age: float = 0.4) -> list[dict]:
        if self.detector is None:
            return []
        _fid, dets, ts = self.detector.result
        return dets if time.monotonic() - ts < max_age else []

    def _box_at(self, dets: list[dict], x: float, y: float) -> dict | None:
        hits = [d for d in dets if d["box"][0] <= x <= d["box"][0] + d["box"][2]
                and d["box"][1] <= y <= d["box"][1] + d["box"][3]]
        return min(hits, key=lambda d: d["box"][2] * d["box"][3]) if hits else None

    def _search(self, frame: np.ndarray, hsv: np.ndarray, now: float) -> tuple | None:
        """Look for the lost target: detected people first, then colour back-projection."""
        lost_for = now - self._lost_t
        pred = self._predicted_centre(now)
        reach = 0.12 + 0.35 * lost_for                   # search radius grows while lost
        best, best_score = None, 0.0
        for d in self._fresh_people():
            if self.is_person and d["label"] != "person":
                continue
            sim = similarity(self.model, appearance(hsv, _px(d["box"], frame.shape)))
            cx, cy = d["box"][0] + d["box"][2] / 2, d["box"][1] + d["box"][3] / 2
            dist = math.hypot(cx - pred[0], cy - pred[1])
            near = math.exp(-(dist / max(0.05, reach)) ** 2)
            score = sim * (0.6 + 0.4 * near)
            if sim >= self.SIM_FIND and score > best_score:
                best, best_score = d["box"], score
        if best is not None:
            return best
        # colour back-projection + CamShift in a window around the predicted position
        if self.model is None or self.bbox is None:
            return None
        H, W = frame.shape[:2]
        bw, bh = self.bbox[2], self.bbox[3]
        win = (pred[0] - bw / 2 - reach, pred[1] - bh / 2 - reach, bw + 2 * reach, bh + 2 * reach)
        x0, y0 = max(0, int(win[0] * W)), max(0, int(win[1] * H))
        x1, y1 = min(W, int((win[0] + win[2]) * W)), min(H, int((win[1] + win[3]) * H))
        if x1 - x0 < 8 or y1 - y0 < 8:
            return None
        back = back_project(hsv, self.model)
        bwp, bhp = max(4, int(bw * W * 0.64)), max(4, int(bh * H * 0.84))
        dens = cv2.boxFilter(back.astype(np.float32), -1, (bwp, bhp))    # colour mass of a target-sized box
        roi = dens[y0:y1, x0:x1]
        if roi.size == 0 or float(roi.max()) < 8:
            return None
        ys, xs = np.mgrid[y0:y1, x0:x1]
        prior = np.exp(-(((xs / W - pred[0]) ** 2 + (ys / H - pred[1]) ** 2) / (2 * max(0.05, reach) ** 2)))
        score = roi * (0.5 + 0.5 * prior)
        iy, ix = np.unravel_index(int(np.argmax(score)), score.shape)
        cx, cy = (x0 + ix) / W, (y0 + iy) / H
        cand = (cx - bw / 2, cy - bh / 2, bw, bh)
        sim = similarity(self.model, appearance(hsv, _px(cand, frame.shape)))
        return cand if sim >= self.SIM_FIND + 0.08 else None

    def _predicted_centre(self, now: float) -> tuple[float, float]:
        box = self._lost_box if self.status != "tracking" and self._lost_box else self.bbox
        if box is None:
            return 0.5, 0.5
        dt = min(now - self._lost_t, self.COAST_S) if self.status != "tracking" else 0.0
        cx = box[0] + box[2] / 2 + self.vel[0] * dt * 0.8
        cy = box[1] + box[3] / 2 + self.vel[1] * dt * 0.8
        return min(max(cx, 0.0), 1.0), min(max(cy, 0.0), 1.0)

    def _lose(self, now: float) -> None:
        self._tracker = None
        self.status = "coasting"
        self._lost_t = now
        self._lost_box = self.bbox

    # ---- per frame (vision thread) ------------------------------------------------
    def update(self, frame: np.ndarray, fid: int | None = None) -> dict[str, Any]:
        now = time.monotonic()
        self._fid = fid if fid is not None else self._fid + 1
        if self.detector is not None and (self.show_people or self.status in ("coasting", "searching")
                                          or (self.status == "tracking" and self.is_person)):
            self.detector.submit(frame, self._fid)
        with self._lock:
            pending, self._pending = self._pending, None
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        dets = self._fresh_people(0.6)
        self.people = self.label_people(dets)
        if pending is not None:
            kind, arg = pending
            if kind == "clear":
                self._tracker, self.bbox, self.ok, self.lost, self.model = None, None, False, 0, None
                self.status, self.label, self.is_person = "idle", "", False
            elif kind == "box":
                d = next((d for d in dets if _iou(d["box"], arg) > 0.5), None)
                self.label, self.is_person = "", False
                self._start(frame, hsv, arg, d["label"] if d else "")
            elif kind == "point":
                x, y = arg
                d = self._box_at(dets, x, y)
                self.label, self.is_person = "", False
                if d:
                    self._start(frame, hsv, d["box"], d["label"])
                else:
                    self._start(frame, hsv, (x - 0.06, y - 0.12, 0.12, 0.24))
            elif kind == "auto":
                people = [d for d in dets if d["label"] == "person"]
                if people:
                    d = max(people, key=lambda d: d["box"][2] * d["box"][3] * (1.2 - abs(d["box"][0] + d["box"][2] / 2 - 0.5)))
                    self.label, self.is_person = "", True
                    self._start(frame, hsv, d["box"], "person")
                else:
                    self.error = "no_person"
            self._last_t = now
            return self.state()

        if self.model is None:
            return self.state()

        if self._tracker is not None:
            ok, box = self._tracker.update(frame)
            H, W = frame.shape[:2]
            if ok:
                nb = (box[0] / W, box[1] / H, box[2] / W, box[3] / H)
                sim = similarity(self.model, appearance(hsv, tuple(int(v) for v in box)))
                self.conf = sim
                if sim < self.SIM_KEEP:
                    self._bad += 1
                else:
                    self._bad = 0
                if self._bad >= 4:              # tracker drifted onto something else
                    ok = False
            if ok:
                dt = max(1e-3, now - self._last_t)
                old = self.bbox
                if old is not None:
                    v = np.array([(nb[0] + nb[2] / 2) - (old[0] + old[2] / 2),
                                  (nb[1] + nb[3] / 2) - (old[1] + old[3] / 2)]) / dt
                    self.vel = self.vel * 0.7 + np.clip(v, -3, 3) * 0.3
                self.bbox, self.ok, self.lost = nb, True, 0
                if self.status != "reacquired" or now - self._found_t > 1.0:
                    self.status = "tracking"
                # slow appearance update while confident (lighting changes on stage)
                if self.conf > 0.65:
                    new = appearance(hsv, tuple(int(v) for v in box))
                    if new is not None:
                        self.model = cv2.addWeighted(self.model, 0.96, new, 0.04, 0)
                # people: re-seat the box on a matching detection now and then (fixes size drift)
                if self.is_person and dets and now - self._snap_t > 1.0:
                    d = max(dets, key=lambda d: _iou(d["box"], nb))
                    if _iou(d["box"], nb) > 0.35:
                        model, status = self.model, self.status
                        self._start(frame, hsv, d["box"], "person")
                        self.model, self.status = model, status     # keep the learnt appearance
            else:
                self._lose(now)

        if self._tracker is None:                    # lost: predict, then search
            self.lost += 1
            found = self._search(frame, hsv, now)
            if found is not None:
                self._start(frame, hsv, found, "person" if self.is_person else self.label)
                self.status, self._found_t = "reacquired", now
                log.info("target re-acquired after %.1f s", now - self._lost_t)
            elif now - self._lost_t < self.COAST_S:
                cx, cy = self._predicted_centre(now)
                bw, bh = self.bbox[2], self.bbox[3]
                self.bbox = (cx - bw / 2, cy - bh / 2, bw, bh)
                self.ok, self.status = True, "coasting"
            else:
                self.ok, self.status = False, "searching"
        self._last_t = now
        return self.state()

    def state(self) -> dict[str, Any]:
        center = None
        if self.bbox:
            x, y, bw, bh = self.bbox
            center = [round(x + bw / 2, 4), round(y + bh / 2, 4)]
        return {"active": self.model is not None, "ok": self.ok, "status": self.status,
                "bbox": [round(v, 4) for v in self.bbox] if self.bbox else None,
                "center": center, "algo": self.algo, "lost": self.lost, "error": self.error,
                "conf": round(self.conf, 2), "label": self.label,
                "lost_s": round(time.monotonic() - self._lost_t, 1) if self.status == "searching" else 0,
                "people": [{"box": [round(v, 4) for v in d["box"]], "label": d["label"], "id": d.get("id"),
                            "score": round(d["score"], 2),
                            "target": bool(self.bbox and self.ok and _iou(tuple(d["box"]), self.bbox) > 0.3)}
                           for d in self.people[:12]],
                "recent": self.recent,
                "detector": self.detector.det.backend if self.detector else None}


# =============================================================================
# STAGE CAMERA (second camera: who is where)
# =============================================================================
class _Track:
    __slots__ = ("id", "box", "hist", "hits", "miss", "name", "color", "kind", "floor",
                 "tracker", "seen_t", "vel")

    def __init__(self, tid: int, box: tuple, hist: np.ndarray | None, kind: str = "person"):
        self.id, self.box, self.hist = tid, box, hist
        self.hits, self.miss = 1, 0
        self.name, self.color, self.kind = "", MARK_COLORS[tid % len(MARK_COLORS)], kind
        self.floor: list[float] | None = None
        self.tracker: SmartTracker | None = None
        self.seen_t = time.monotonic()
        self.vel = (0.0, 0.0)


class StageWatcher:
    """Second camera over the stage: numbered people + marked objects on the floor map."""

    def __init__(self, engine: Any) -> None:
        self.engine = engine
        self.video: VideoSource | None = None
        self.source: int | str | None = None
        self.mirror = False
        self.det = Detector()
        self.quad = [[0.0, 1.0], [1.0, 1.0], [1.0, 0.0], [0.0, 0.0]]     # FL FR BR BL on this camera
        self._H = None
        self.tracks: dict[int, _Track] = {}
        self.gone: list[_Track] = []           # named tracks that left - re-identified when back
        self._next = 1
        self.follow_id: int | None = None
        self.follow_target: str = "active"     # "active" | "all"
        self.names: dict[str, dict] = {}
        self._lock = threading.Lock()
        self._jpeg: bytes | None = None
        self._jpeg_id = 0
        self.fps = 0.0
        self.ms = 0.0
        self._running = False
        self._thread: threading.Thread | None = None
        self._pending_mark: tuple | None = None
        self._set_quad(self.quad)

    # ---- config -------------------------------------------------------------
    def _set_quad(self, quad: list) -> None:
        st = self.engine.stage
        self.quad = [[float(x), float(y)] for x, y in quad]
        self._H = cv2.getPerspectiveTransform(np.float32(self.quad), np.float32(st.floor_corners()))

    def set_quad(self, quad: list | None) -> None:
        with self._lock:
            self._set_quad(quad or [[0.0, 1.0], [1.0, 1.0], [1.0, 0.0], [0.0, 0.0]])

    def to_config(self) -> dict[str, Any]:
        return {"source": self.source, "mirror": self.mirror, "quad": self.quad,
                "follow_target": self.follow_target}

    def load_config(self, cfg: dict | None) -> None:
        cfg = cfg or {}
        self.mirror = bool(cfg.get("mirror", False))
        self.follow_target = cfg.get("follow_target", "active")
        if cfg.get("quad"):
            self._set_quad(cfg["quad"])
        if cfg.get("source") is not None:
            self.set_source(cfg["source"])

    # ---- lifecycle ----------------------------------------------------------------
    def set_source(self, source: int | str | None) -> None:
        if source in (None, "", "off"):
            self.stop()
            self.source = None
            return
        src = parse_source(source)
        self.source = src
        if self.video is None:
            self.video = VideoSource(src, mirror=self.mirror)
            self.video.start()
        else:
            self.video.set_source(src)
        if not self._running:
            self._running = True
            self._thread = threading.Thread(target=self._run, name="stage-cam", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
            self._thread = None
        if self.video:
            self.video.stop()
            self.video = None
        with self._lock:
            self.tracks.clear()
            self._jpeg = None

    # ---- user actions ------------------------------------------------------------
    def mark(self, box: tuple, name: str = "") -> None:
        """Drag on the stage view: follow an object (guitar amp, DJ desk, dancer …)."""
        self._pending_mark = (tuple(float(v) for v in box), name)

    def rename(self, tid: int, name: str) -> None:
        with self._lock:
            if tid in self.tracks:
                self.tracks[tid].name = name[:24]

    def forget(self, tid: int) -> None:
        with self._lock:
            self.tracks.pop(tid, None)
            if self.follow_id == tid:
                self.follow_id = None

    def follow(self, tid: int | None, target: str | None = None) -> None:
        self.follow_id = tid
        if target in ("active", "all"):
            self.follow_target = target

    # ---- geometry ---------------------------------------------------------------
    def to_floor(self, x: float, y: float) -> list[float] | None:
        v = self._H @ np.array([x, y, 1.0])
        if abs(v[2]) < 1e-9:
            return None
        return [round(float(v[0] / v[2]), 3), round(float(v[1] / v[2]), 3)]

    # ---- loop ---------------------------------------------------------------------
    def _run(self) -> None:
        last_id, t_last = -1, time.perf_counter()
        while self._running:
            video = self.video
            if video is None:
                time.sleep(0.1)
                continue
            video.mirror = self.mirror
            frame, fid = video.wait_frame(last_id, timeout=0.5)
            if frame is None or fid == last_id:
                continue
            last_id = fid
            t0 = time.perf_counter()
            h, w = frame.shape[:2]
            proc = frame if w <= STAGE_PROC_WIDTH else cv2.resize(
                frame, (STAGE_PROC_WIDTH, int(h * STAGE_PROC_WIDTH / w)), interpolation=cv2.INTER_AREA)
            dets: list[dict] = []
            if video.connected:
                try:
                    dets = [d for d in self.det.detect(proc) if d["label"] in ("person",) or self.det.backend == "mediapipe"]
                except Exception as e:
                    log.warning("stage detection failed: %s", e)
            hsv = cv2.cvtColor(proc, cv2.COLOR_BGR2HSV)
            self._update_tracks(proc, hsv, [d for d in dets if d["label"] == "person"])
            self._follow()
            ok, buf = cv2.imencode(".jpg", frame if w <= 960 else cv2.resize(frame, (960, int(h * 960 / w))),
                                   [cv2.IMWRITE_JPEG_QUALITY, 70])
            now = time.perf_counter()
            with self._lock:
                if ok:
                    self._jpeg, self._jpeg_id = buf.tobytes(), fid
                self.ms = self.ms * 0.8 + (now - t0) * 200
                dt, t_last = now - t_last, now
                if dt > 0:
                    self.fps = self.fps * 0.9 + 0.1 / dt

    def _update_tracks(self, frame: np.ndarray, hsv: np.ndarray, dets: list[dict]) -> None:
        now = time.monotonic()
        with self._lock:
            # marked objects follow their own SmartTracker
            if self._pending_mark:
                box, name = self._pending_mark
                self._pending_mark = None
                t = _Track(self._next, box, appearance(hsv, _px(box, frame.shape)), kind="object")
                t.name = name or f"Obiekt {self._next}"
                t.tracker = SmartTracker("CSRT")
                t.tracker.request(box)
                t.hits = 3
                self.tracks[t.id] = t
                self._next += 1
            for t in list(self.tracks.values()):
                if t.kind == "object" and t.tracker:
                    st = t.tracker.update(frame)
                    if st["bbox"]:
                        t.box = tuple(st["bbox"])
                    t.miss = 0 if st["ok"] else t.miss + 1
            people = [t for t in self.tracks.values() if t.kind == "person"]
            # greedy matching: overlap + distance + colour
            hists = [appearance(hsv, _px(d["box"], frame.shape)) for d in dets]
            pairs = []
            for ti, t in enumerate(people):
                pb = (t.box[0] + t.vel[0], t.box[1] + t.vel[1], t.box[2], t.box[3])
                for di, d in enumerate(dets):
                    iou = _iou(pb, d["box"])
                    dc = math.hypot((pb[0] + pb[2] / 2) - (d["box"][0] + d["box"][2] / 2),
                                    (pb[1] + pb[3] / 2) - (d["box"][1] + d["box"][3] / 2))
                    if iou < 0.05 and dc > 0.15:
                        continue
                    sim = similarity(t.hist, hists[di])
                    pairs.append((iou + 0.5 * sim - dc, ti, di))
            pairs.sort(reverse=True)
            used_t, used_d = set(), set()
            for _score, ti, di in pairs:
                if ti in used_t or di in used_d:
                    continue
                used_t.add(ti)
                used_d.add(di)
                t, d = people[ti], dets[di]
                nb = d["box"]
                t.vel = ((nb[0] - t.box[0]) * 0.5 + t.vel[0] * 0.5, (nb[1] - t.box[1]) * 0.5 + t.vel[1] * 0.5)
                t.box = tuple(0.5 * a + 0.5 * b for a, b in zip(t.box, nb))
                if hists[di] is not None and t.hist is not None:
                    t.hist = cv2.addWeighted(t.hist, 0.9, hists[di], 0.1, 0)
                t.hits += 1
                t.miss = 0
                t.seen_t = now
            for ti, t in enumerate(people):
                if ti not in used_t:
                    t.miss += 1
                    t.box = (t.box[0] + t.vel[0], t.box[1] + t.vel[1], t.box[2], t.box[3])
                    t.vel = (t.vel[0] * 0.6, t.vel[1] * 0.6)
            # new people - maybe someone we know coming back
            for di, d in enumerate(dets):
                if di in used_d:
                    continue
                if any(_iou(d["box"], t.box) > 0.3 for t in self.tracks.values()):
                    continue
                back = None
                if self.gone and hists[di] is not None:
                    back = max(self.gone, key=lambda g: similarity(g.hist, hists[di]))
                    if similarity(back.hist, hists[di]) < (0.5 if back.name else 0.6):
                        back = None
                if back is not None:
                    self.gone.remove(back)
                    back.box, back.miss, back.hits, back.seen_t = d["box"], 0, 3, now
                    self.tracks[back.id] = back
                    continue
                t = _Track(self._next, d["box"], hists[di])
                self._next += 1
                self.tracks[t.id] = t
            # drop stale tracks (named / followed ones are remembered for re-identification)
            for t in list(self.tracks.values()):
                limit = 60 if t.kind == "object" else (6 if t.hits < 3 else 40)
                if t.miss > limit:
                    del self.tracks[t.id]
                    # confirmed people keep their number / name when they come back (named ones longer)
                    if t.kind == "person" and (t.hits >= 8 or t.name or t.id == self.follow_id):
                        keep = [g for g in self.gone if now - g.seen_t < (180 if g.name else 25)]
                        self.gone = keep[-16:] + [t]
            for t in self.tracks.values():
                x, y, bw, bh = t.box
                t.floor = self.to_floor(x + bw / 2, y + bh)       # feet on the floor

    def _follow(self) -> None:
        if self.follow_id is None:
            return
        with self._lock:
            t = self.tracks.get(self.follow_id)
            if t is None or t.miss > 3 or t.floor is None:
                return
            X, Z = t.floor
            bx, by, bw, bh = t.box
        eng = self.engine
        ids = "all" if self.follow_target == "all" else None

        def floor_aim(fid: int) -> None:            # lamps without a person calibration for this camera
            if eng.aim_mode == "stage":
                eng.aim(fid, [X, eng.stage.aim_height, Z])
            else:
                img = eng.stage.floor_to_image(X, Z)
                if img:
                    eng.set_position_norm(fid, img[0], img[1])
        eng.aim_person(ids, bx + bw / 2, by + bh, "stage", fallback=floor_aim)
        eng.hold(ids, "move", 0.6)

    # ---- UI ---------------------------------------------------------------------
    def latest_jpeg(self) -> tuple[int, bytes | None]:
        with self._lock:
            return self._jpeg_id, self._jpeg

    def state(self) -> dict[str, Any]:
        v = self.video
        with self._lock:
            tracks = [{"id": t.id, "box": [round(c, 4) for c in t.box], "name": t.name, "color": t.color,
                       "kind": t.kind, "floor": t.floor, "ok": t.miss <= 3}
                      for t in self.tracks.values() if t.hits >= 3 or t.kind == "object"]
        return {"on": self.source is not None, "source": self.source,
                "state": v.state if v else "offline", "fps": round(self.fps, 1),
                "ms": round(self.ms, 1), "mirror": self.mirror, "quad": self.quad,
                "tracks": tracks, "follow": self.follow_id, "follow_target": self.follow_target,
                "detector": self.det.backend,
                "model_ready": DET_MODEL_PATH.exists()}
