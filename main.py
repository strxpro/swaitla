"""
main.py
=======
Lumo – FastAPI + WebSocket hub between the CV pipeline, the DMX
engine and the browser console.

Threads:  video-capture → vision (MediaPipe / tracker → interaction) ;
          dmx-engine (40 Hz smoothing + output) ; asyncio (HTTP/WS).

Run:
    python main.py                              # webcam 0, simulation
    python main.py --source 1                   # Iriun / DroidCam index
    python main.py --source http://192.168.1.20:8080/video
    python main.py --dmx artnet --artnet-ip 2.0.0.10 --universe 0
    python main.py --dmx enttec --dmx-port COM4
Then open http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import time
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import dmx_controller
from dmx_controller import DMXEngine, list_serial_ports, load_json, save_json
from calibration import AutoCalibrator
from effects import CATEGORY as FX_CATEGORY, EffectEngine
from interaction import InteractionController
from tracking import AsyncDetector, SmartTracker, StageWatcher, download_detector_model
from spotlight import Spotlight
from smoke import SmokeController
from devices import DeviceWatcher
import qlcimport
import dmxdoctor
from mecal import MeCalibrator
from fixturelib import FixtureLibraryService
from fixturelib import manual as fx_manual, rdm as fx_rdm
from collections import deque
import vision as vision_mod
from vision import VideoSource, VisionProcessor, parse_source, scan_cameras

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
CONFIG_PATH = BASE_DIR / "config.json"

log = logging.getLogger("main")

# Runtime options (overridden by CLI flags in __main__)
OPTIONS: dict[str, Any] = {"source": None, "mirror": None, "mode": "gesture", "ws_fps": 45}


# =============================================================================
# RIG – owns every subsystem
# =============================================================================
class Rig:
    def __init__(self) -> None:
        cfg = load_json(CONFIG_PATH)
        dcfg = cfg.get("dmx") or {}
        if not OPTIONS.get("dmx_cli") and dcfg.get("backend", "sim") != "sim":
            # restore the DMX interface chosen in the UI (CLI flags take precedence)
            dmx_controller.ENABLE_PHYSICAL_DMX = True
            dmx_controller.DMX_BACKEND = dcfg["backend"]
            dmx_controller.DMX_SERIAL_PORT = dcfg.get("port", dmx_controller.DMX_SERIAL_PORT)
            dmx_controller.ARTNET_TARGET_IP = dcfg.get("ip", dmx_controller.ARTNET_TARGET_IP)
            dmx_controller.ARTNET_UNIVERSE = int(dcfg.get("universe", dmx_controller.ARTNET_UNIVERSE))
        self.engine = DMXEngine()
        self.engine.load_config(cfg.get("fixtures"), cfg.get("engine"))
        vcfg = cfg.get("video", {})
        source = OPTIONS["source"] if OPTIONS["source"] is not None else vcfg.get("source", 0)
        mirror = OPTIONS["mirror"] if OPTIONS["mirror"] is not None else vcfg.get("mirror", True)
        self.video = VideoSource(parse_source(source), mirror=bool(mirror))
        self.interaction = InteractionController(self.engine)
        icfg = cfg.get("interaction", {})
        self.interaction.scope = icfg.get("scope", "active")
        self.interaction.follow_all = bool(icfg.get("follow_all", False))
        self.interaction.load_cfg(icfg.get("gcfg"))
        self.interaction.relative = bool(icfg.get("relative", True))
        # start in gestures; following a person only when asked for (a saved "track" is not resumed)
        start_mode = vcfg.get("mode", "gesture")
        self.vision = VisionProcessor(self.video, on_result=self.interaction.handle,
                                      mode=OPTIONS["mode"] or ("gesture" if start_mode == "track" else start_mode))
        self.detector = AsyncDetector()
        self.vision.tracker = SmartTracker(detector=self.detector)
        self.vision.tracking = self.vision.tracker.state()
        self.stagecam = StageWatcher(self.engine)
        self.stagecam_cfg = cfg.get("stagecam") or {}
        self.autocal = AutoCalibrator(self.engine, self.video, self.interaction, on_success=self.save)
        self.effects = EffectEngine(self.engine)
        self.engine.pre_tick.append(self.effects.apply)
        self.interaction.effects = self.effects
        self.interaction.custom.load(cfg.get("gestures"))
        self.spotlight = Spotlight(self.engine, self.vision, self.stagecam, self.interaction)
        self.mecal = MeCalibrator(self.engine, self.vision, on_done=self.save)
        self.interaction.mecal = self.mecal
        self.engine.pre_tick.append(self.spotlight.tick)          # after the effects: the spot wins
        self.interaction.spotlight = self.spotlight
        self.effects.on_spot = self.spotlight.moment
        show = cfg.get("show") or {}
        if show.get("palette"):
            self.effects.palette = [list(map(int, c))[:3] for c in show["palette"]][:8]
        self.effects.autopilot["mood"] = show.get("mood", "dynamic")
        self.effects.autopilot["spot"] = bool(show.get("spot", False))
        vision_mod.HAND_FILTER.update(cfg.get("hand_filter") or {})
        self.bindings = cfg.get("bindings") or []              # keyboard / MIDI buttons → actions
        self.notices: deque = deque(maxlen=40)                  # (seq, toast) sent to every browser
        self._notice_seq = 0
        self.devices = DeviceWatcher(self.engine, self.notify, on_camera=self._camera_plugged)
        self.smoke = SmokeController(self.engine)
        self.smoke.load_config(cfg.get("smoke"))
        self.engine.pre_tick.append(self.smoke.tick)
        self.interaction.smoke = self.smoke
        self.looks: list[dict] = cfg.get("looks") or []
        self.interaction.looks = self.recall_look

    def start(self) -> None:
        self.engine.start()
        self.video.start()
        self.vision.start()
        try:
            self.stagecam.load_config(self.stagecam_cfg)
        except Exception:
            log.exception("stage camera start failed")

    def recall_look(self, lid: Any, fade: float | None = None) -> bool:
        lk = next((x for x in self.looks if x["id"] == lid), None)
        if lk is None:
            return False
        self.effects.stop_all()
        self.engine.look_recall(lk["values"], lk.get("fade", 1.0) if fade is None else fade)
        return True

    def _camera_plugged(self) -> None:
        for v in (self.video, self.stagecam.video):
            if v is not None:
                v.wake()

    def notify(self, key: str, level: str = "ok", **params: Any) -> None:
        self._notice_seq += 1
        self.notices.append((self._notice_seq, _toast("", level, key=key, **params)))

    def _track_floor(self) -> list[float] | None:
        """Where the person followed by the main camera stands (for the 3-D view)."""
        tr = self.vision.tracking
        if not (tr.get("active") and tr.get("ok") and tr.get("bbox")):
            return None
        x, y, w, h = tr["bbox"]
        X, Z = self.engine.stage.image_to_floor(x + w / 2, y + h)
        return [round(X, 3), round(Z, 3)]

    def stop(self) -> None:
        self.devices.stop()
        self.spotlight.stop()
        self.stagecam.stop()
        self.detector.stop()
        self.vision.stop()
        self.video.stop()
        self.engine.stop()

    def save(self) -> None:
        save_json(CONFIG_PATH, self.config_data())

    def config_data(self) -> dict[str, Any]:
        data = self.engine.to_config()
        data["video"] = {"source": self.video.source, "mirror": self.video.mirror,
                         "mode": self.vision.mode}
        data["dmx"] = self.engine.snapshot()["dmx"]["config"]
        data["gestures"] = self.interaction.custom.dump()
        data["interaction"] = {"scope": self.interaction.scope,
                               "follow_all": self.interaction.follow_all,
                               "gcfg": self.interaction.gcfg, "relative": self.interaction.relative}
        data["stagecam"] = self.stagecam.to_config()
        data["show"] = {"palette": self.effects.palette, "mood": self.effects.autopilot["mood"],
                        "spot": self.effects.autopilot["spot"]}
        data["hand_filter"] = dict(vision_mod.HAND_FILTER)
        data["bindings"] = self.bindings
        data["looks"] = self.looks
        data["smoke"] = self.smoke.to_config()
        return data

    def apply_config(self, cfg: dict[str, Any]) -> None:
        """Load a whole settings file while running (backup restore). Lasers stay off."""
        self.effects.stop_all()
        self.spotlight.set(False)
        self.engine.load_config(cfg.get("fixtures"), cfg.get("engine"))
        vcfg = cfg.get("video") or {}
        if "source" in vcfg and vcfg["source"] != self.video.source:
            self.video.set_source(parse_source(vcfg["source"]))
        if "mirror" in vcfg:
            self.video.mirror = bool(vcfg["mirror"])
        if vcfg.get("mode") in ("gesture", "track", "manual"):
            self.vision.mode = vcfg["mode"]
        icfg = cfg.get("interaction") or {}
        self.interaction.scope = icfg.get("scope", self.interaction.scope)
        self.interaction.follow_all = bool(icfg.get("follow_all", self.interaction.follow_all))
        self.interaction.load_cfg(icfg.get("gcfg"))
        self.interaction.relative = bool(icfg.get("relative", self.interaction.relative))
        self.interaction.custom.load(cfg.get("gestures"))
        show = cfg.get("show") or {}
        if show.get("palette"):
            self.effects.palette = [list(map(int, c))[:3] for c in show["palette"]][:8]
        self.effects.autopilot["mood"] = show.get("mood", self.effects.autopilot["mood"])
        self.effects.autopilot["spot"] = bool(show.get("spot", False))
        vision_mod.HAND_FILTER.update(cfg.get("hand_filter") or {})
        self.bindings = list(cfg.get("bindings") or [])
        self.smoke.load_config(cfg.get("smoke"))
        self.looks = list(cfg.get("looks") or [])
        if cfg.get("stagecam") is not None:
            try:
                self.stagecam.load_config(cfg["stagecam"])
            except Exception:
                log.exception("stage camera restore failed")
        d = cfg.get("dmx") or {}
        cur = self.engine.snapshot()["dmx"]["config"]
        if d.get("backend") and any(d.get(k) != cur.get(k) for k in ("backend", "port", "ip", "universe")):
            self.engine.reconfigure_output(d["backend"], d.get("port"), d.get("ip"), d.get("universe"))
        self.engine.lasers_enabled = False

    def state(self) -> dict[str, Any]:
        s = self.engine.snapshot()
        s.update(type="state", t=round(time.time(), 3), video=self.video.info(),
                 vision=self.vision.info(), interaction=self.interaction.ui_state(),
                 calibration=self.autocal.state, effects=self.effects.state(),
                 stagecam=self.stagecam.state(), spotlight=self.spotlight.state(),
                 hand_filter=vision_mod.HAND_FILTER, track_floor=self._track_floor(),
                 bindings=self.bindings, devices=self.devices.known, people_on=self.vision.people_on,
                 dmx_rivals=list(dict.fromkeys(self.devices.rivals)),
                 smoke=self.smoke.state(), looks=[{k: v for k, v in x.items() if k != "values"} for x in self.looks],
                 frame_len=self.engine.frame_len(), refresh_hz=dmx_controller.DMX_REFRESH_HZ)
        return s


rig: Rig | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global rig
    rig = Rig()
    rig.start()
    fixlib.start()                  # offline index from cache; rebuild / OFL update in the background
    log.info("Lumo ready")
    yield
    rig.stop()


class FreshStatic(StaticFiles):
    """Browser always re-checks the files (304 when unchanged) - an update never leaves a stale script."""
    def file_response(self, *args: Any, **kwargs: Any):
        resp = super().file_response(*args, **kwargs)
        resp.headers["Cache-Control"] = "no-cache"
        return resp


app = FastAPI(title="Lumo", lifespan=lifespan)


@app.post("/api/upload")
async def upload(request: Request, kind: str, name: str = "file") -> JSONResponse:
    """Raw file body: kind = pdf (manual) | gdtf (fixture file). Photos are shown in the browser only."""
    data = await request.body()
    if len(data) > 25_000_000:
        return JSONResponse({"error": "plik za duży (max 25 MB)"}, status_code=413)
    try:
        if kind == "pdf":
            text = await asyncio.to_thread(fx_manual.pdf_text, data)
            return JSONResponse({"charts": fx_manual.parse_chart(text), "chars": len(text), "text": text[:3000]})
        if kind == "gdtf":
            defn = await asyncio.to_thread(fixlib.import_gdtf, data, name)
            return JSONResponse({"fixture": defn.to_dict()})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    return JSONResponse({"error": "nieznany rodzaj pliku"}, status_code=400)
app.mount("/static", FreshStatic(directory=STATIC_DIR), name="static")


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/api/state")
async def api_state() -> dict[str, Any]:
    return rig.state()


@app.get("/api/config")
async def api_config() -> JSONResponse:
    """The whole settings file as a download (Ustawienia → Kopia zapasowa)."""
    name = f"lumo-ustawienia-{time.strftime('%Y-%m-%d_%H%M')}.json"
    return JSONResponse(rig.config_data(), headers={"Content-Disposition": f'attachment; filename="{name}"'})


SHOWS_DIR = BASE_DIR / "shows"
AUDIO_DIR = SHOWS_DIR / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")


def _safe_name(name: str) -> str:
    """File names from the browser: letters, digits, space, dot, dash, underscore only."""
    import re
    clean = re.sub(r"[^\w\-. ]", "_", name, flags=re.UNICODE).strip(" .")
    if not clean:
        raise ValueError("pusta nazwa")
    return clean[:120]


@app.get("/api/shows")
async def list_shows() -> list[dict[str, Any]]:
    out = []
    for p in sorted(SHOWS_DIR.glob("*.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
            out.append({"name": p.stem, "audio": d.get("audio"), "duration": d.get("duration"),
                        "cues": len(d.get("cues", []))})
        except Exception:
            continue
    return out


@app.get("/api/shows/{name}")
async def get_show(name: str) -> dict[str, Any]:
    return json.loads((SHOWS_DIR / f"{_safe_name(name)}.json").read_text(encoding="utf-8"))


@app.put("/api/shows/{name}")
async def put_show(name: str, request: Request) -> dict[str, Any]:
    data = await request.json()
    save_json(SHOWS_DIR / f"{_safe_name(name)}.json", data)
    return {"ok": True}


@app.delete("/api/shows/{name}")
async def delete_show(name: str) -> dict[str, Any]:
    p = SHOWS_DIR / f"{_safe_name(name)}.json"
    if p.exists():
        p.unlink()
    return {"ok": True}


@app.put("/api/audio/{name}")
async def put_audio(name: str, request: Request) -> dict[str, Any]:
    fname = _safe_name(name)
    (AUDIO_DIR / fname).write_bytes(await request.body())
    return {"ok": True, "url": f"/audio/{fname}"}


@app.get("/stream/stage")
async def stream_stage() -> StreamingResponse:
    """Second (stage) camera as MJPEG - shown with a plain <img> in the browser."""
    async def gen():
        last = -1
        while True:
            fid, jpeg = rig.stagecam.latest_jpeg()
            if jpeg is not None and fid != last:
                last = fid
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
            await asyncio.sleep(1 / 30)
    return StreamingResponse(gen(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get("/api/effects")
async def list_effects() -> dict[str, str]:
    return FX_CATEGORY


@app.get("/api/presets")
async def list_presets() -> dict[str, Any]:
    """User-made effects (layers of built-in effects)."""
    return rig.effects.presets


@app.put("/api/presets/{name}")
async def put_preset(name: str, request: Request) -> dict[str, Any]:
    rig.effects.set_preset(_safe_name(name), await request.json())
    return {"ok": True}


@app.delete("/api/presets/{name}")
async def delete_preset(name: str) -> dict[str, Any]:
    rig.effects.delete_preset(_safe_name(name))
    return {"ok": True}


@app.get("/api/cameras")
async def api_cameras() -> list[dict[str, Any]]:
    cur = rig.video.source if isinstance(rig.video.source, int) else None
    return await asyncio.to_thread(scan_cameras, 5, cur)


# =============================================================================
# WEBSOCKET
# =============================================================================
FIXTURE_KEYS = ("name", "address", "pan_16bit", "tilt_16bit", "has_rgb", "pos", "mount", "yaw",
                "pan_deg", "tilt_deg", "invert_pan", "invert_tilt", "beam_deg",
                "shutter_open", "strobe_min", "strobe_max", "model", "type", "library_key",
                "channels", "aim_pan", "aim_tilt", "wheel", "gobos", "caps", "defaults")

LIBRARY_PATH = BASE_DIR / "fixture_library.json"
fixlib = FixtureLibraryService(BASE_DIR, LIBRARY_PATH)     # every fixture source, searchable offline


def load_library() -> list[dict[str, Any]]:
    """Device models the user can add from the UI (lights, lasers, smoke machines)."""
    try:
        return json.loads(LIBRARY_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        log.error("fixture library: %s", e)
        return []


def library_spec(key: str) -> dict[str, Any]:
    entry = next((e for e in load_library() if e["key"] == key), None)
    if entry is None:
        raise KeyError(f"nieznany model {key!r}")
    spec = {k: v for k, v in entry.items() if k in FIXTURE_KEYS}
    spec.update(name=entry["model"], model=entry["model"], type=entry.get("type", "moving_head"),
                library_key=entry["key"], channels=list(entry["channels"]),
                pan_16bit=entry.get("pan_16bit", False), tilt_16bit=entry.get("tilt_16bit", False),
                has_rgb=any(c in entry["channels"] for c in ("red", "green", "blue")))
    return spec


# commands that change the rig layout / setup are saved to config.json automatically
AUTOSAVE = {"add_fixture", "update_fixture", "remove_fixture", "stage", "camera_quad", "dmx_output", "lasers", "aim_mode",
            "aim_cal", "gesture_delete",
            "source", "mirror", "mode", "scope", "follow_all", "select", "smoothing",
            "stagecam_source", "stagecam_mirror", "stagecam_quad", "stagecam_follow",
            "gesture_save", "autopilot", "palette", "aim_box", "speed_profile", "selection",
            "aim_point", "aim_point_clear", "bindings", "smoke", "look_save", "look_update", "look_delete"}
_save_task: asyncio.Task | None = None


def schedule_save() -> None:
    """Debounced autosave (1 s after the last structural change)."""
    global _save_task
    if _save_task and not _save_task.done():
        _save_task.cancel()

    async def later() -> None:
        await asyncio.sleep(1.0)
        await asyncio.to_thread(rig.save)
    _save_task = asyncio.create_task(later())


SPOT_CUES: set = set()                 # running "spot" cues of the timeline


def _toast(text: str, level: str = "ok", key: str | None = None, **params: Any) -> dict[str, Any]:
    """key → translated in the browser (PL / IT); text is the fallback."""
    return {"type": "toast", "level": level, "text": text, "key": key, "params": params}


async def handle_message(m: dict[str, Any]) -> dict[str, Any] | None:
    """Apply one client command. Returns an optional reply for the sender."""
    r, eng = rig, rig.engine
    t = m.get("type")

    if t in ("set", "set_many", "position"):   # manual control pauses effects on what it touches
        params = [m.get("param", "")] if t == "set" else list(m.get("values", {})) if t == "set_many" else ["pan"]
        for prm in params:
            grp = ("move" if prm.startswith(("pan", "tilt")) else "dim" if prm == "dimmer" else
                   "strobe" if prm == "strobe" else "color" if prm in ("red", "green", "blue", "rgb", "cwheel") else None)
            if grp:
                eng.hold(m.get("id"), grp, 1.5)

    if t == "set":            # {id, param, value}   param: pan|tilt|pan_coarse|pan_fine|…|dimmer|strobe|red|…
        if m.get("param") == "rgb":
            red, green, blue = m["value"]
            eng.set_params(m.get("id"), {"red": red, "green": green, "blue": blue})
        else:
            eng.set_param(m.get("id"), m["param"], float(m["value"]))
    elif t == "set_many":     # {id, values:{param: value}}
        eng.set_params(m.get("id"), {k: float(v) for k, v in m["values"].items()})
    elif t == "position":     # {x, y} normalised camera image → floor point → active fixture
        eng.set_position_norm(m.get("id"), float(m["x"]), float(m["y"]))
    elif t == "aim":          # {x, y, z} world metres (click on the 3D floor)
        eng.aim("all" if m.get("all") else m.get("id"), [float(m["x"]), float(m["y"]), float(m["z"])])
    elif t == "stage":        # {width, depth, truss_height, aim_height}
        st = eng.stage
        st.truss_height = float(m.get("truss_height", st.truss_height))
        st.aim_height = float(m.get("aim_height", st.aim_height))
        st.resize(float(m.get("width", st.width)), float(m.get("depth", st.depth)))
    elif t == "camera_quad":  # {quad: [[x,y]*4] FL, FR, BR, BL} or {quad: null} = reset
        from stage import DEFAULT_QUAD
        eng.stage.set_quad(m.get("quad") or DEFAULT_QUAD)
        return _toast("Kalibracja podłogi zapisana" if m.get("quad") else "Mapa kamery zresetowana")
    elif t == "autocal":
        err = r.autocal.start(int(m.get("id") or eng.active_id))
        return _toast(err, "err") if err else _toast("Auto-kalibracja start – nie ruszaj kamery")
    elif t == "autocal_cancel":
        r.autocal.cancel()
    elif t == "select":
        eng.select(int(m["id"]))
    elif t == "blackout":
        eng.blackout = bool(m.get("value", not eng.blackout))
    elif t == "grand_master":
        eng.grand_master = int(max(0, min(255, m["value"])))
    elif t == "chan_set":     # {id, index, value} one channel of a lamp, from the desk
        eng.chan_set(int(m["id"]), int(m["index"]), int(m["value"]))
    elif t == "chan_auto":    # {id?, index?} channel(s) back to automatic
        eng.chan_auto(m.get("id"), m.get("index"))
    elif t == "short_frames":
        eng.short_frames = bool(m.get("value"))
    elif t == "gesture_cfg":   # {g, on?, gain?, target?, extra?, extra_mode?} what a built-in gesture does
        r.interaction.set_gesture(str(m["g"]), **{k: m[k] for k in ("on", "gain", "target", "extra", "extra_mode") if k in m})
        await asyncio.to_thread(r.save)
    elif t == "gesture_extra":  # {id, extra: [{action, params}]} extra actions of an own gesture
        for tpl in r.interaction.custom.templates:
            if tpl.get("id") == m.get("id"):
                tpl["extra"] = [{"action": x["action"], "params": dict(x.get("params") or {})}
                                for x in (m.get("extra") or []) if x.get("action")][:8]
        await asyncio.to_thread(r.save)
    elif t == "gesture_try":   # {actions: [...]} preview the combination now
        r.interaction.run_list(m.get("actions") or [])
    elif t == "gesture_relative":
        r.interaction.relative = bool(m.get("value", True))
        await asyncio.to_thread(r.save)
    elif t == "flip":          # {id, axis: x|y} finger right -> lamp left? flip it
        on = eng.flip(int(m["id"]), "x" if m.get("axis") == "x" else "y")
        await asyncio.to_thread(r.save)
        return _toast("", key="toast.flip" + ("X" if m.get("axis") == "x" else "Y"), on=on)
    elif t == "mecal_start":   # {ids?} calibration on me
        if r.spotlight.on:
            r.spotlight.set(False)
        r.vision.set_mode("gesture")
        err = r.mecal.start([int(i) for i in m["ids"]] if m.get("ids") else None, int(m.get("spots", 1)))
        if err:
            return _toast("", "warn", key="toast.mecal." + err)
    elif t == "mecal_stop":
        r.mecal.stop()
    elif t == "mecal_yes":
        r.mecal.yes()
    elif t == "mecal_no":
        r.mecal.no()
    elif t == "mecal_skip":
        r.mecal.skip()
    elif t == "mecal_nudge":   # {dx, dy} arrows
        r.mecal.nudge(float(m.get("dx", 0)), float(m.get("dy", 0)))
    elif t == "lib_state":
        return {"type": "lib", "op": "state", **fixlib.state()}
    elif t == "lib_search":    # {q, manufacturer?, channels?, category?}
        res = await asyncio.to_thread(fixlib.search, str(m.get("q", "")), str(m.get("manufacturer", "")),
                                      int(m["channels"]) if m.get("channels") else None, str(m.get("category", "")), 40)
        return {"type": "lib", "op": "search", "q": m.get("q", ""), "results": res, **fixlib.state()}
    elif t == "lib_details":   # {id}
        try:
            d = await asyncio.to_thread(fixlib.details, str(m["id"]))
        except Exception as e:
            return {"type": "lib", "op": "error", "error": str(e)}
        return {"type": "lib", "op": "details", "fixture": d}
    elif t == "lib_add":       # {id, mode, address?, name?} - put a library profile on the stage
        try:
            spec = await asyncio.to_thread(fixlib.engine_spec, str(m["id"]), m.get("mode"))
        except Exception as e:
            return _toast(str(e), "err")
        n = len(spec["channels"])
        addr = int(m["address"]) if m.get("address") else (eng.free_address(n) or eng.next_free_address())
        if m.get("name"):
            spec["name"] = str(m["name"])[:24]
        if m.get("alias"):
            fixlib.add_alias(str(m["alias"]), str(m["id"]))
        f = eng.add_fixture(**spec, address=addr, values={"dimmer": 200})
        eng.select(f.id)
        await asyncio.to_thread(r.save)
        return _toast("", key="toast.libAdded", name=f.name, a=f"{f.address:03d}", n=f.footprint)
    elif t == "lib_disambiguate":  # {q, count} - candidate maps + which channels tell them apart
        res = await asyncio.to_thread(fixlib.disambiguate, str(m.get("q", "")), int(m["count"]))
        return {"type": "lib", "op": "disambiguate", **res}
    elif t == "lib_match":     # {count, known: {offset: ChannelType}, text?} - smart matching after calibration
        res = await asyncio.to_thread(fixlib.match, int(m["count"]) if m.get("count") else None,
                                      m.get("known") or {}, str(m.get("text", "")))
        return {"type": "lib", "op": "match", "results": res}
    elif t == "lib_save":      # {profile, name, add?, address?} - "learn this fixture"
        defn = await asyncio.to_thread(fixlib.save_profile, m["profile"], m.get("name"))
        if m.get("add"):
            spec = fixlib.engine_spec(defn.id, None)
            n = len(spec["channels"])
            target = int(m["address"]) if m.get("address") else (eng.free_address(n) or eng.next_free_address())
            extra = {k: v for k, v in (m.get("extra") or {}).items() if k in ("invert_pan", "invert_tilt")}
            if m.get("replace") and int(m["replace"]) in eng.fixtures:
                eng.update_fixture(int(m["replace"]), **{k: v for k, v in spec.items() if k != "name"}, address=target, **extra)
            else:
                f = eng.add_fixture(**spec, address=target, values={"dimmer": 200})
                if extra:
                    eng.update_fixture(f.id, **extra)
                eng.select(f.id)
            await asyncio.to_thread(r.save)
        return {"type": "lib", "op": "saved", "fixture": defn.to_dict()}
    elif t == "lib_mine":
        return {"type": "lib", "op": "mine", "results": fixlib.mine_entries()}
    elif t == "lib_delete":
        await asyncio.to_thread(fixlib.delete_profile, str(m["id"]))
        return {"type": "lib", "op": "deleted", "id": m["id"]}
    elif t == "lib_alias":
        fixlib.add_alias(str(m["alias"]), str(m["id"]))
    elif t == "lib_update":    # refresh the Open Fixture Library list now
        state = await asyncio.to_thread(fixlib.update_ofl, True)
        return {"type": "lib", "op": "state", **fixlib.state(), "ofl": state}
    elif t == "lib_link":      # {url} product / maker page -> name, manuals, search results
        try:
            info = await asyncio.to_thread(fx_manual.product_info, str(m["url"]).strip())
        except Exception as e:
            return {"type": "lib", "op": "link", "error": str(e)}
        words = fx_manual.search_words(info["title"])
        res = await asyncio.to_thread(fixlib.search, words, "", None, "", 12) if words else []
        return {"type": "lib", "op": "link", **info, "words": words, "results": res}
    elif t == "lib_pdf_url":   # {url} read a PDF manual found on a product page
        try:
            data, _ = await asyncio.to_thread(fx_manual.fetch, str(m["url"]))
            text = await asyncio.to_thread(fx_manual.pdf_text, data)
        except Exception as e:
            return {"type": "lib", "op": "pdf", "error": str(e)}
        return {"type": "lib", "op": "pdf", "charts": fx_manual.parse_chart(text), "chars": len(text)}
    elif t == "rdm_discover":
        ctl = fx_rdm.controller_for(eng.output)
        if ctl is None:
            return {"type": "lib", "op": "rdm", "supported": False, "why": fx_rdm.why_unavailable(eng.output),
                    "interface": eng.output.label}
        devs = await asyncio.to_thread(fx_rdm.discover_and_describe, ctl)
        out = []
        for d in devs:
            res = await asyncio.to_thread(fixlib.match, d.footprint, {},
                                          f"{d.manufacturer_label} {d.model_description}",
                                          {"manufacturer_id": d.manufacturer_id, "model_id": d.model_id})
            out.append({**d.to_dict(), "matches": res})
        return {"type": "lib", "op": "rdm", "supported": True, "devices": out}
    elif t == "free_address":  # {id} move a device to the first free range
        f = eng.fixtures.get(int(m["id"]))
        if f:
            a = eng.free_address(f.footprint, skip=f.id)
            if a is None:
                return _toast("", "err", key="toast.noFree")
            eng.update_fixture(f.id, address=a)
            await asyncio.to_thread(r.save)
            return _toast("", key="toast.freeAddr", name=f.name, a=f"{a:03d}")
    elif t == "probe":         # {address, count, offset, value, base?: {offset: value}} one channel of an unknown lamp
        a0, n = int(m["address"]), int(m.get("count", 1))
        eng.test_channels.clear()
        for k in range(n):
            eng.test_channels[a0 + k] = 0
        for k, v in (m.get("base") or {}).items():
            eng.test_channels[a0 + int(k)] = int(max(0, min(255, v)))
        if m.get("offset") is not None:
            eng.test_channels[a0 + int(m["offset"])] = int(max(0, min(255, m.get("value", 0))))
    elif t == "dmx_doctor":   # {fix?: bool} check cable + lamps, repair what can be repaired
        res = await asyncio.to_thread(dmxdoctor.run, r, bool(m.get("fix", True)))
        return {"type": "doctor", **res}
    elif t == "kill_rival":   # user clicked "close QLC+" in the doctor
        await asyncio.to_thread(dmxdoctor.kill_rivals)
        await asyncio.sleep(1.5)
        await asyncio.to_thread(eng.take_output)
        return _toast("", key="toast.dmxTaken") if eng.output.ok else _toast(eng.output.status, "err")
    elif t == "zero":
        eng.zero()
        return _toast("Wszystkie wartości wyzerowane", "warn")
    elif t == "home":
        eng.home(m.get("id", "all"))
    elif t == "smoothing":
        eng.position_smoothing = float(max(0.02, min(1.0, m["value"])))
    elif t == "mode":
        mode, note = m["mode"], None
        if mode != "track" and r.spotlight.active:
            r.spotlight.set(False)          # the user picked gestures / manual: the follow spot lets go
            note = _toast("", "warn", key="toast.spotOffMode")
        r.vision.set_mode(mode)
        if mode != "track":
            r.vision.tracker.clear()        # nobody is followed any more
        return note
    elif t == "source":
        r.vision.tracker.clear()
        r.vision.reset_hands()
        r.video.set_source(m["source"])
        return _toast(f"Przełączanie źródła → {m['source']}")
    elif t == "mirror":
        r.video.mirror = bool(m["value"])
        r.vision.tracker.clear()
    elif t == "track_roi":
        r.vision.set_mode("track")
        r.vision.tracker.request((m["x"], m["y"], m["w"], m["h"]))
        r.stagecam.follow(None)
    elif t == "track_clear":
        if r.spotlight.active:
            r.spotlight.set(False)
        r.vision.tracker.clear()
    elif t == "track_point":   # {x, y} click on a person / object in the camera view
        r.vision.set_mode("track")
        r.vision.tracker.request_point(float(m["x"]), float(m["y"]))
        r.stagecam.follow(None)
    elif t == "track_auto":    # follow the most prominent person
        r.vision.set_mode("track")
        r.vision.tracker.request_auto()
        r.stagecam.follow(None)
    elif t == "stagecam_source":   # {source: index | url | null}
        await asyncio.to_thread(r.stagecam.set_source, m.get("source"))
        return _toast("", key="toast.stagecamOn" if r.stagecam.source is not None else "toast.stagecamOff")
    elif t == "stagecam_mirror":
        r.stagecam.mirror = bool(m.get("value"))
    elif t == "stagecam_quad":     # {quad: [[x,y]*4] FL, FR, BR, BL | null}
        r.stagecam.set_quad(m.get("quad"))
        return _toast("", key="toast.stagecamQuad")
    elif t == "stagecam_follow":   # {id | null, target: active | all}
        r.stagecam.follow(m.get("id"), m.get("target"))
        if m.get("id") is not None:
            r.vision.tracker.clear()           # one follower at a time
    elif t == "stagecam_name":
        r.stagecam.rename(int(m["id"]), str(m.get("name", "")))
    elif t == "stagecam_forget":
        r.stagecam.forget(int(m["id"]))
    elif t == "stagecam_mark":     # {x, y, w, h, name}
        r.stagecam.mark((m["x"], m["y"], m["w"], m["h"]), m.get("name", ""))
    elif t == "detector_download":
        err = await asyncio.to_thread(download_detector_model)
        if err:
            return _toast(f"{err}", "err", key="toast.modelFail", err=err)
        r.detector.det.reload()
        r.stagecam.det.reload()
        return _toast("", key="toast.modelOk")
    elif t == "scope":
        r.interaction.scope = "all" if m.get("value") == "all" else "active"
    elif t == "follow_all":
        r.interaction.follow_all = bool(m.get("value"))
    elif t == "fx_start":      # {kind, params?, targets?, duration?, id?}
        if m["kind"] == "spot":                 # timeline / scene: "light on the person" (tracked or at a set place)
            p = m.get("params") or {}
            r.spotlight.place(p.get("point"))
            r.spotlight.set(True)
            SPOT_CUES.add(m.get("id"))
        else:
            r.effects.start(m["kind"], m.get("params"), m.get("targets", "all"), m.get("duration"), m.get("id"))
    elif t == "fx_stop":
        if m["id"] in SPOT_CUES:
            SPOT_CUES.discard(m["id"])
            r.spotlight.set(False)
            r.spotlight.place(None)
        r.effects.stop(m["id"])
    elif t == "fx_stop_all":
        r.effects.stop_all()
    elif t == "bpm":           # {value} tempo of the loaded song: effects with "beats" follow it
        r.effects.bpm = float(m["value"]) if m.get("value") else None
    elif t == "beat":          # {strength, drop, bpm} from live audio or the timeline
        r.effects.beat(float(m.get("strength", 1)), bool(m.get("drop")), m.get("bpm"))
    elif t == "reactions":     # {flash, color_step, move_step, strobe_drop}
        r.effects.reactions.update({k: bool(v) for k, v in m.get("value", {}).items()
                                    if k in r.effects.reactions})
    elif t == "test_channel":  # {channel 1-512, value 0-255} - manual channel test
        eng.test_channels[int(m["channel"])] = int(max(0, min(255, m["value"])))
    elif t == "aim_cal":       # {id, corner: "a" (left / top) | "b" (right / bottom)} or {id, reset}
        f = eng.fixtures[int(m["id"])]
        if m.get("reset"):
            f.aim_pan = f.aim_tilt = None
            return _toast("", key="toast.aimReset")
        k = 0 if m.get("corner") == "a" else 1
        f.aim_pan = list(f.aim_pan or [f.target["pan"], f.target["pan"]])
        f.aim_tilt = list(f.aim_tilt or [f.target["tilt"], f.target["tilt"]])
        f.aim_pan[k], f.aim_tilt[k] = float(f.target["pan"]), float(f.target["tilt"])
        return _toast("", key="toast.aimSaved", n=k + 1)
    elif t == "gesture_record":  # {kind: pose|motion|two}  (legacy: {name, action, params})
        r.interaction.custom.start_recording(m.get("kind", "pose"), m.get("name", ""), m.get("action"), m.get("params"))
    elif t == "gesture_cancel":
        r.interaction.custom.cancel_recording()
    elif t == "gesture_save":    # {name, action, params, map: {x, y}}
        tpl = r.interaction.custom.save_pending(m.get("name", ""), m.get("action", "motion"), m.get("params"),
                                                m.get("map"))
        return _toast("", key="toast.gestureSaved2", name=tpl["name"])
    elif t == "spotlight":     # {value, point?: [x, y] | null, seconds?}
        if "point" in m:
            r.spotlight.place(m.get("point"))
        if m.get("seconds"):
            r.spotlight.moment(float(m["seconds"]))
            return None
        if "value" in m:
            r.spotlight.set(bool(m.get("value")))
        elif "point" in m:
            return None
        return _toast("", key="toast.spotOn" if r.spotlight.on else "toast.spotOff")
    elif t == "autopilot":     # {on?, mood?, spot?, white?, lasers?}
        r.effects.set_autopilot(m.get("on"), m.get("mood"), m.get("spot"), m.get("white"), m.get("lasers"))
    elif t == "palette":       # {colors: [[r,g,b], …]}
        cols = [[int(max(0, min(255, v))) for v in c[:3]] for c in m.get("colors", []) if len(c) >= 3][:8]
        if cols:
            r.effects.palette = cols
    elif t == "aim_box":       # {box: [x0, y0, x1, y1] | null} - reach of the pointing hand
        b = m.get("box")
        eng.aim_box = [float(v) for v in b[:4]] if b else None
        return _toast("", key="toast.handCal" if b else "toast.handCalReset")
    elif t == "speed_profile":  # {position_smoothing?, value_smoothing?, motor?, filter?: {mincutoff, beta}}
        if m.get("position_smoothing") is not None:
            eng.position_smoothing = float(max(0.02, min(1.0, m["position_smoothing"])))
        if m.get("value_smoothing") is not None:
            eng.value_smoothing = float(max(0.05, min(1.0, m["value_smoothing"])))
        if "motor" in m:
            eng.motor_speed = None if m["motor"] is None else int(max(0, min(255, m["motor"])))
            if eng.motor_speed is not None:
                eng.set_params("all", {"speed": eng.motor_speed})
        if m.get("filter"):
            vision_mod.HAND_FILTER.update({k: float(v) for k, v in m["filter"].items() if k in ("mincutoff", "beta")})
            r.vision.reset_hands()
    elif t == "aim_point":     # {ids, x, y, cam} - the light is on the person standing there: remember it
        n = eng.aim_point_add(m.get("ids", "sel"), float(m["x"]), float(m["y"]), m.get("cam", "main"))
        return _toast("", key="toast.aimPoint", n=n)
    elif t == "aim_point_clear":   # {ids, cam?}
        eng.aim_point_clear(m.get("ids", "all"), m.get("cam"))
        return _toast("", level="warn", key="toast.aimPointClear")
    elif t == "people_detect":     # {value} - detect people in gesture mode too (calibration)
        r.vision.people_on = bool(m.get("value"))
    elif t == "smoke":             # {burst: seconds} | {hold: bool} | {auto: {on, every, dur}} | {level}
        if "level" in m:
            r.smoke.level = int(max(0, min(255, m["level"])))
        if m.get("burst"):
            r.smoke.burst(float(m["burst"]))
        if "hold" in m:
            r.smoke.hold(bool(m["hold"]))
        if isinstance(m.get("auto"), dict):
            a = m["auto"]
            r.smoke.set_auto(a.get("on"), a.get("every"), a.get("dur"))
    elif t == "look_save":         # {name, ids?, fade?} - remember how the lamps look now
        import uuid as _uuid
        lk = {"id": _uuid.uuid4().hex[:8], "name": str(m.get("name") or f"Scena {len(r.looks) + 1}")[:24],
              "fade": float(m.get("fade", 1.0)), "color": m.get("color") or "#2f7bff",
              "values": eng.look_capture(m.get("ids", "all"))}
        r.looks.append(lk)
        return _toast("", key="toast.lookSaved", name=lk["name"])
    elif t == "look_recall":       # {id, fade?}
        r.recall_look(m.get("id"), m.get("fade"))
    elif t == "look_update":       # {id, name?, fade?, color?, recapture?}
        for lk in r.looks:
            if lk["id"] == m.get("id"):
                for k in ("name", "fade", "color"):
                    if k in m:
                        lk[k] = m[k]
                if m.get("recapture"):
                    lk["values"] = eng.look_capture("all")
    elif t == "look_delete":
        r.looks = [x for x in r.looks if x["id"] != m.get("id")]
    elif t == "fx_speed":          # {value 0..1} global effect tempo (MIDI knob)
        r.effects.speed_scale = 0.25 + max(0.0, min(1.0, float(m.get("value", 0.27)))) * 2.75
    elif t == "bindings":          # {list: [...]} keyboard / MIDI buttons
        r.bindings = list(m.get("list") or [])[:128]
    elif t == "selection":     # {ids: [...]} lamps picked in the 3-D view
        eng.selection = [int(i) for i in m.get("ids", []) if int(i) in eng.fixtures]
    elif t == "gesture_delete":
        r.interaction.custom.delete(m["id"])
        return _toast("", key="toast.gestureDeleted", level="warn")
    elif t == "gesture_test":   # run an action once from the UI
        r.interaction.run_action(m["action"], m.get("params") or {})
    elif t == "aim_mode":      # {value: direct|stage, span?: [pan_deg, tilt_deg]}
        eng.aim_mode = "stage" if m.get("value") == "stage" else "direct"
        if m.get("span"):
            eng.aim_span = [float(v) for v in m["span"][:2]]
    elif t == "test_clear":
        eng.test_channels.clear()
    elif t == "gestures":      # {value} - false while the hand controls the UI
        r.interaction.gestures_enabled = bool(m.get("value", True))
    elif t == "lasers":
        eng.lasers_enabled = bool(m.get("value"))
        return _toast("Lasery uzbrojone - uwaga na oczy" if eng.lasers_enabled else "Lasery wyłączone",
                      "warn" if eng.lasers_enabled else "ok")
    elif t == "library":
        return {"type": "library", "fixtures": load_library()}
    elif t == "add_fixture":
        spec = {k: m[k] for k in FIXTURE_KEYS if k != "type" and m.get(k) is not None}
        if m.get("library_key"):
            spec = {**library_spec(m["library_key"]), **spec}
        ch = m.get("channels")
        if ch:
            spec["channels"] = [c.strip().lower() for c in ch.split(",") if c.strip()] if isinstance(ch, str) else ch
        f = eng.add_fixture(**spec, values={"dimmer": 200})
        eng.select(f.id)
        return _toast(f"Dodano {f.name} @ DMX {f.address:03d} ({f.footprint} ch)")
    elif t == "update_fixture":
        eng.update_fixture(int(m["id"]), **{k: v for k, v in m.items() if k not in ("type", "id")})
    elif t == "duplicate_fixture":  # {id} - same device once more, next free address, a bit to the right
        src = eng.fixtures.get(int(m["id"]))
        if src is None:
            return None
        spec = src.to_config()
        for k in ("id", "address", "aim_points", "icon_x", "icon_y"):
            spec.pop(k, None)
        spec["name"] = (src.name + " 2")[:24]
        spec["pos"] = [round(src.pos[0] + 1.0, 2), src.pos[1], src.pos[2]]
        f = eng.add_fixture(**spec)
        eng.select(f.id)
        return _toast(f"Dodano {f.name} @ DMX {f.address:03d} ({f.footprint} ch)")
    elif t == "config_import":     # {data: {...}} - load a backup file; the current settings are kept as config.previous.json
        data = m.get("data")
        if not isinstance(data, dict) or not any(k in data for k in ("fixtures", "engine", "video", "dmx")):
            return _toast("To nie jest plik ustawień Lumo", "err")
        await asyncio.to_thread(save_json, BASE_DIR / "config.previous.json", r.config_data())
        await asyncio.to_thread(r.apply_config, data)
        await asyncio.to_thread(r.save)
        return _toast("Wczytano kopię ustawień")
    elif t == "config_restore":    # back to the settings from before the last import
        prev = load_json(BASE_DIR / "config.previous.json")
        if not prev:
            return _toast("Nie ma poprzednich ustawień", "warn")
        cur = r.config_data()
        await asyncio.to_thread(r.apply_config, prev)
        await asyncio.to_thread(save_json, BASE_DIR / "config.previous.json", cur)
        await asyncio.to_thread(r.save)
        return _toast("Przywrócono poprzednie ustawienia")
    elif t == "remove_fixture":
        eng.remove_fixture(int(m["id"]))
        return _toast("Usunięto urządzenie", "warn")
    elif t == "save":
        await asyncio.to_thread(r.save)
        return _toast("Ustawienia zapisane")
    elif t == "dmx_output":   # {backend: sim|artnet|enttec|opendmx, port?, ip?, universe?}
        await asyncio.to_thread(eng.reconfigure_output, m["backend"], m.get("port"),
                                m.get("ip"), m.get("universe"))
        if eng.output.ok:
            extra = " · BLACKOUT aktywny" if eng.blackout and m["backend"] != "sim" else ""
            return _toast(f"DMX: {eng.output.status}{extra}", "warn" if extra else "ok")
        return _toast(eng.output.status, "err")
    elif t == "dmx_release":       # give the cable to QLC+ (or another program)
        await asyncio.to_thread(eng.release_output)
        return _toast("", "warn", key="toast.dmxReleased")
    elif t == "dmx_take":          # take the cable back
        await asyncio.to_thread(eng.take_output)
        if eng.output.ok:
            return _toast("", key="toast.dmxTaken")
        return _toast(eng.output.status, "err")
    elif t == "qlc_scan":          # lamps from the QLC+ workspaces, matched to the library
        res = await asyncio.to_thread(qlcimport.scan, load_library())
        return {"type": "qlc", **res}
    elif t == "list_ports":
        return {"type": "ports", "ports": await asyncio.to_thread(list_serial_ports)}
    elif t == "scan_cameras":
        cur = r.video.source if isinstance(r.video.source, int) else None
        cams = await asyncio.to_thread(scan_cameras, 5, cur)
        return {"type": "cameras", "cameras": cams}
    else:
        return _toast(f"Nieznana komenda: {t}", "err")
    return None


VIDEO_WANTED: dict[int, bool] = {}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    outbox: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async def sender() -> None:
        interval = 1.0 / OPTIONS["ws_fps"]
        last_fid, last_rid, last_sent = -1, -1, 0.0
        last_notice = rig.notices[-1][0] if rig.notices else 0
        while True:
            # push as soon as the vision thread has a new result (lowest latency), at least every interval
            t0 = time.perf_counter()
            rid = rig.vision.result_id
            for seq, note in list(rig.notices):              # plug & play notices for every browser
                if seq > last_notice:
                    last_notice = seq
                    outbox.put_nowait(note)
            if rid == last_rid and t0 - last_sent < interval and outbox.empty():
                await asyncio.sleep(0.003)
                continue
            last_rid, last_sent = rid, t0
            fid, jpeg = rig.vision.latest_jpeg()
            if jpeg is not None and fid != last_fid:
                await ws.send_bytes(jpeg)
                last_fid = fid
            msg = rig.interaction.custom_msg
            if msg:
                rig.interaction.custom_msg = None
                if msg == "ok":
                    await asyncio.to_thread(rig.save)
                    outbox.put_nowait(_toast("", key="toast.gestureSaved"))
                elif msg == "pending":
                    outbox.put_nowait(_toast("", key="toast.gesturePending"))
                else:
                    outbox.put_nowait(_toast("", level="err", key="toast.gestureFail"))
            await ws.send_text(json.dumps(rig.state(), separators=(",", ":")))
            while not outbox.empty():
                await ws.send_text(json.dumps(outbox.get_nowait()))
            await asyncio.sleep(0.004)

    task = asyncio.create_task(sender())
    VIDEO_WANTED[id(ws)] = True
    rig.vision.want_jpeg = True
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
                if msg.get("type") == "video":      # this browser shows / hides the camera image
                    VIDEO_WANTED[id(ws)] = bool(msg.get("value"))
                    rig.vision.want_jpeg = any(VIDEO_WANTED.values())
                    continue
                reply = await handle_message(msg)
                if msg.get("type") in AUTOSAVE:
                    schedule_save()
            except Exception as e:
                log.exception("command failed: %s", raw[:200])
                reply = _toast(f"Błąd: {e}", "err")
            if reply:
                outbox.put_nowait(reply)
    except WebSocketDisconnect:
        pass
    finally:
        task.cancel()
        VIDEO_WANTED.pop(id(ws), None)
        rig.vision.want_jpeg = any(VIDEO_WANTED.values())


# =============================================================================
# CLI
# =============================================================================
def main() -> None:
    ap = argparse.ArgumentParser(description="Lumo – light controlled by your hand (DMX)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--source", help="camera index (0,1,2…) or stream URL (http/rtsp)")
    ap.add_argument("--no-mirror", action="store_true", help="do not mirror the camera image")
    ap.add_argument("--mode", choices=("gesture", "track", "manual"), default=None)
    ap.add_argument("--ws-fps", type=int, default=45, help="video/state push rate to the browser")
    ap.add_argument("--dmx", choices=("artnet", "enttec", "opendmx", "udmx"),
                    help="enable PHYSICAL DMX output with this backend")
    ap.add_argument("--dmx-port", help="serial port for enttec/opendmx (COM3, /dev/ttyUSB0)")
    ap.add_argument("--artnet-ip", help="Art-Net node IP or broadcast address")
    ap.add_argument("--universe", type=int, help="Art-Net universe (port-address)")
    ap.add_argument("--open", action="store_true", help="open the browser automatically")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s")

    if args.source is not None:
        OPTIONS["source"] = args.source
    if args.no_mirror:
        OPTIONS["mirror"] = False
    OPTIONS["mode"] = args.mode
    OPTIONS["ws_fps"] = max(5, min(60, args.ws_fps))
    if args.dmx:
        OPTIONS["dmx_cli"] = True
        dmx_controller.ENABLE_PHYSICAL_DMX = True
        dmx_controller.DMX_BACKEND = args.dmx
    if args.dmx_port:
        dmx_controller.DMX_SERIAL_PORT = args.dmx_port
    if args.artnet_ip:
        dmx_controller.ARTNET_TARGET_IP = args.artnet_ip
    if args.universe is not None:
        dmx_controller.ARTNET_UNIVERSE = args.universe

    url = f"http://{'127.0.0.1' if args.host in ('0.0.0.0', '::') else args.host}:{args.port}"
    print(f"\n  Lumo  →  {url}\n")
    if args.open:
        webbrowser.open(url)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
