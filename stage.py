"""
stage.py
========
3-D stage model shared by the DMX engine, the interaction layer and the UI.

World coordinates (metres), seen from the audience / camera position:
    X  right (+) / left (-)          stage spans  -width/2 .. +width/2
    Y  up, floor = 0
    Z  toward the audience (+)       front edge = +depth/2, back edge = -depth/2

Camera → floor mapping is a homography built from 4 clicked image points
(front-left, front-right, back-right, back-left corners of the stage floor).

Moving-head kinematics (identical formulas are used in static/stage3d.js):
    pan_eff  = (pan16/65535  - 0.5) * pan_deg   (negated if invert_pan)
    tilt_eff = (tilt16/65535 - 0.5) * tilt_deg  (negated if invert_tilt)
    phi = yaw + pan_eff          rotation about +Y, 0 = facing +Z (audience)
    hanging head: dir = ( sin t·sin phi, -cos t, sin t·cos phi )   (DMX centre = straight down)
    floor head:   dir = ( sin t·sin phi, +cos t, sin t·cos phi )   (DMX centre = straight up)
"""

from __future__ import annotations

import math
from typing import Any, Iterable

import cv2
import numpy as np

# image corners in normalised coordinates: FL, FR, BR, BL (bottom of frame = front of stage)
DEFAULT_QUAD = [[0.0, 1.0], [1.0, 1.0], [1.0, 0.0], [0.0, 0.0]]


class Stage:
    def __init__(self, width: float = 10.0, depth: float = 8.0, truss_height: float = 5.0,
                 aim_height: float = 1.2, quad: list | None = None):
        self.width, self.depth = float(width), float(depth)
        self.truss_height = float(truss_height)
        self.aim_height = float(aim_height)       # tracked person: aim at torso, not at the feet
        self.set_quad(quad or DEFAULT_QUAD)

    # ---- camera mapping --------------------------------------------------------
    def floor_corners(self) -> list[list[float]]:
        w, d = self.width / 2, self.depth / 2
        return [[-w, d], [w, d], [w, -d], [-w, -d]]

    def set_quad(self, quad: Iterable[Iterable[float]]) -> None:
        self.quad = [[float(x), float(y)] for x, y in quad]
        self.H = cv2.getPerspectiveTransform(np.float32(self.quad), np.float32(self.floor_corners()))
        self.H_inv = np.linalg.inv(self.H)

    def resize(self, width: float, depth: float) -> None:
        self.width, self.depth = float(width), float(depth)
        self.set_quad(self.quad)

    def image_to_floor(self, x: float, y: float) -> tuple[float, float]:
        v = self.H @ np.array([x, y, 1.0])
        if abs(v[2]) < 1e-9:
            return 0.0, 0.0
        return float(v[0] / v[2]), float(v[1] / v[2])

    def floor_to_image(self, X: float, Z: float) -> tuple[float, float] | None:
        v = self.H_inv @ np.array([X, Z, 1.0])
        if v[2] <= 1e-9:
            return None
        return float(v[0] / v[2]), float(v[1] / v[2])

    def camera_footprint(self) -> list[list[float]] | None:
        """Floor polygon seen by the camera (image corners projected; None if horizon is visible)."""
        pts = []
        for x, y in ((0, 1), (1, 1), (1, 0), (0, 0)):
            v = self.H @ np.array([x, y, 1.0])
            if v[2] <= 1e-9:
                return None
            X, Z = v[0] / v[2], v[1] / v[2]
            if abs(X) > 100 or abs(Z) > 100:
                return None
            pts.append([round(float(X), 3), round(float(Z), 3)])
        return pts

    def to_config(self) -> dict[str, Any]:
        return {"width": self.width, "depth": self.depth, "truss_height": self.truss_height,
                "aim_height": self.aim_height, "quad": self.quad}

    def state(self) -> dict[str, Any]:
        s = self.to_config()
        s["H_inv"] = [[round(float(v), 6) for v in row] for row in self.H_inv]
        s["footprint"] = self.camera_footprint()
        s["calibrated"] = self.quad != DEFAULT_QUAD
        return s


# =============================================================================
# KINEMATICS
# =============================================================================
def _angles(f: Any, pan16: float, tilt16: float) -> tuple[float, float]:
    pe = (pan16 / 65535.0 - 0.5) * f.pan_deg
    te = (tilt16 / 65535.0 - 0.5) * f.tilt_deg
    return (-pe if f.invert_pan else pe), (-te if f.invert_tilt else te)


def fk_dir(f: Any, pan16: float, tilt16: float, yaw: float | None = None) -> np.ndarray:
    pe, te = _angles(f, pan16, tilt16)
    phi = math.radians((f.yaw if yaw is None else yaw) + pe)
    t = math.radians(te)
    up = -1.0 if f.mount == "hang" else 1.0
    return np.array([math.sin(t) * math.sin(phi), up * math.cos(t), math.sin(t) * math.cos(phi)])


def floor_hit(f: Any, pan16: float, tilt16: float, pos: Iterable[float] | None = None,
              yaw: float | None = None) -> tuple[float, float, float] | None:
    """Beam ∩ floor plane → (X, Z, distance) or None when the beam does not reach the floor."""
    p = np.asarray(f.pos if pos is None else pos, dtype=float)
    d = fk_dir(f, pan16, tilt16, yaw)
    if d[1] > -1e-4 or p[1] <= 0:
        return None
    s = -p[1] / d[1]
    if s > 60:
        return None
    hit = p + d * s
    return float(hit[0]), float(hit[2]), float(s)


def ik(f: Any, target: Iterable[float], cur_pan16: float, cur_tilt16: float) -> tuple[float, float]:
    """Pan/tilt (16-bit) that aims fixture f at a world point; picks the solution closest to now."""
    p = np.asarray(f.pos, dtype=float)
    d = np.asarray(target, dtype=float) - p
    h = math.hypot(d[0], d[2])
    v = -d[1] if f.mount == "hang" else d[1]
    t = math.degrees(math.atan2(h, v))                       # 0..180 away from the rest axis
    cur_pe, cur_te = _angles(f, cur_pan16, cur_tilt16)
    phi = math.degrees(math.atan2(d[0], d[2])) if h > 1e-6 else f.yaw + cur_pe
    half_p, half_t = f.pan_deg / 2.0, f.tilt_deg / 2.0
    best, best_cost = None, float("inf")
    for ph, te in ((phi, t), (phi + 180.0, -t)):
        pe0 = (ph - f.yaw + 180.0) % 360.0 - 180.0
        for k in range(-2, 3):
            pe = pe0 + 360.0 * k
            if abs(pe) > half_p + 1e-6 or abs(te) > half_t + 1e-6:
                continue
            cost = abs(pe - cur_pe) + 2.0 * abs(te - cur_te)
            if cost < best_cost:
                best, best_cost = (pe, te), cost
    if best is None:  # unreachable: clamp the direct solution
        pe = max(-half_p, min(half_p, (phi - f.yaw + 180.0) % 360.0 - 180.0))
        best = (pe, max(-half_t, min(half_t, t)))
    pe, te = best
    if f.invert_pan:
        pe = -pe
    if f.invert_tilt:
        te = -te
    pan16 = (pe / f.pan_deg + 0.5) * 65535.0
    tilt16 = (te / f.tilt_deg + 0.5) * 65535.0
    return max(0.0, min(65535.0, pan16)), max(0.0, min(65535.0, tilt16))


# =============================================================================
# POSE SOLVER (camera auto-calibration)
# =============================================================================
def solve_pose(f: Any, samples: list[tuple[float, float, float, float]],
               truss_height: float) -> tuple[list[float], float, float]:
    """Find fixture position + yaw from observed spots.

    samples: [(pan16, tilt16, X_floor, Z_floor), ...] – floor points where the
    beam was seen by the camera.  Mount type, pan/tilt degrees and inversion
    flags are taken from ``f`` (they must match the real fixture).
    Returns (pos[x,y,z], yaw_deg, rms_error_m).
    """
    obs = np.array([[s[2], s[3]] for s in samples], dtype=float)

    def residual(q: np.ndarray) -> np.ndarray:
        pos, yaw = q[:3], q[3]
        r = []
        for (pan, tilt, X, Z) in samples:
            hit = floor_hit(f, pan, tilt, pos=pos, yaw=yaw)
            r.extend([10.0, 10.0] if hit is None else [hit[0] - X, hit[1] - Z])
        return np.array(r)

    cx, cz = obs[:, 0].mean(), obs[:, 1].mean()
    y0 = truss_height if f.mount == "hang" else 0.4
    best = (None, float("inf"))
    for yaw0 in (0.0, 90.0, 180.0, 270.0):
        for dz in (-3.0, 0.0, 3.0):
            q = np.array([cx, y0, cz + dz, yaw0])
            lam = 1e-2
            err = float(np.sum(residual(q) ** 2))
            for _ in range(60):
                r = residual(q)
                J = np.zeros((len(r), 4))
                for j, eps in enumerate((1e-3, 1e-3, 1e-3, 1e-2)):
                    dq = np.zeros(4); dq[j] = eps
                    J[:, j] = (residual(q + dq) - r) / eps
                A = J.T @ J
                step = np.linalg.solve(A + lam * np.diag(np.diag(A) + 1e-9), -J.T @ r)
                q_new = q + step
                q_new[1] = max(0.05, q_new[1])
                e_new = float(np.sum(residual(q_new) ** 2))
                if e_new < err:
                    q, err, lam = q_new, e_new, lam * 0.4
                    if np.linalg.norm(step) < 1e-5:
                        break
                else:
                    lam *= 5
                    if lam > 1e6:
                        break
            if err < best[1]:
                best = (q.copy(), err)
    q, err = best
    rms = math.sqrt(err / max(1, len(samples)))
    yaw = (float(q[3]) + 180.0) % 360.0 - 180.0
    return [round(float(v), 3) for v in q[:3]], round(yaw, 1), rms
