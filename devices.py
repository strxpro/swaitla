"""
devices.py
==========
Plug & play: notices when a USB-DMX interface or a camera is plugged in / out.

* USB-DMX (FTDI Open DMX, ENTTEC Pro, uDMX) - recognised by USB id / name. A cable
  plugged in while the program runs is connected right away (unless the current
  interface already works), so "plug in and play" needs no clicks.
* Cameras - listed by Windows (Plug and Play); a new camera shows a notice with its
  name so it can be picked as the main or the stage camera.

DMX fixtures themselves cannot tell what they are: cheap lamps only listen on DMX
(no RDM), so a lamp is added from the library and checked with the lamp wizard.
"""

from __future__ import annotations

import logging
import platform
import subprocess
import threading
import time
from typing import Any, Callable

from dmx_controller import d2xx_devices, find_udmx, list_serial_ports

log = logging.getLogger("devices")
IS_WINDOWS = platform.system() == "Windows"


# other light programs that open the same USB-DMX cable (process name -> what the user knows)
RIVALS = [("qlcplus.exe", "QLC+"), ("qlcplus-qml.exe", "QLC+"), ("freestyler512.exe", "Freestyler"), ("freestyler.exe", "Freestyler"),
          ("dmxcontrol.exe", "DMXControl"), ("lightjams.exe", "Lightjams"), ("mqqt.exe", "MagicQ"), ("magicq.exe", "MagicQ"),
          ("daslight.exe", "Daslight"), ("sunlite.exe", "Sunlite"), ("martinm-pc.exe", "Martin M-PC")]


def identify_port(p: dict[str, Any]) -> tuple[str, str] | None:
    """(backend, friendly name) for a serial port that looks like a DMX interface."""
    desc = (p.get("description") or "").upper()
    if "DMX USB PRO" in desc or "ENTTEC" in desc and "PRO" in desc:
        return "enttec", "ENTTEC DMX USB Pro"
    if p.get("vid") == 0x0403 or "FTDI" in desc or "FT232" in desc or "USB SERIAL CONVERTER" in desc:
        return "opendmx", "FTDI Open DMX (FT232R)"
    return None


def list_cameras() -> list[str]:
    """Names of the cameras Windows sees (does not open them)."""
    if not IS_WINDOWS:
        return []
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-CimInstance Win32_PnPEntity -Filter \"PNPClass='Camera' OR PNPClass='Image'\" "
             "| Where-Object { $_.Status -eq 'OK' } | ForEach-Object { $_.Name }"],
            capture_output=True, text=True, timeout=8, creationflags=0x08000000)
        return sorted({ln.strip() for ln in out.stdout.splitlines() if ln.strip()})
    except Exception:
        return []


class DeviceWatcher:
    def __init__(self, engine: Any, notify: Callable[..., None],
                 on_camera: Callable[[], None] | None = None) -> None:
        self.engine, self.notify, self.on_camera = engine, notify, on_camera
        self.ports: dict[str, dict] = {}
        self.udmx = False
        self.cameras: list[str] = []
        self.known: list[dict[str, str]] = []           # what is plugged in now (for the UI)
        self.rivals: list[str] = []                     # other light programs that may hold the DMX cable
        self._running = True
        threading.Thread(target=self._loop, name="devices", daemon=True).start()

    def stop(self) -> None:
        self._running = False

    def _loop(self) -> None:
        first, last_cam = True, 0.0
        while self._running:
            try:
                self._check_dmx(first)
                if time.monotonic() - last_cam > 8 or first:
                    last_cam = time.monotonic()
                    self._check_cameras(first)
                self._check_rivals()
            except Exception:
                log.exception("device watch failed")
            first = False
            time.sleep(2.0)

    def _check_dmx(self, first: bool) -> None:
        ports = {p["device"]: p for p in list_serial_ports() if p.get("usb")}
        udmx = find_udmx()
        new = [p for d, p in ports.items() if d not in self.ports]
        gone = [p for d, p in self.ports.items() if d not in ports]
        self.ports, prev_udmx, self.udmx = ports, self.udmx, udmx
        known = []
        for p in ports.values():
            idn = identify_port(p)
            known.append({"kind": "dmx" if idn else "serial", "name": idn[1] if idn else p["description"],
                          "port": p["device"], "backend": idn[0] if idn else ""})
        if udmx:
            known.append({"kind": "dmx", "name": "uDMX (Anyma)", "port": "USB", "backend": "udmx"})
        self.known = known + [{"kind": "camera", "name": c, "port": "", "backend": ""} for c in self.cameras]
        if first:
            return
        eng = self.engine
        for p in new:
            idn = identify_port(p)
            if not idn:
                continue
            backend, name = idn
            if not eng.output.ok or eng.output.name == "simulation":
                try:
                    eng.reconfigure_output(backend, p["device"])
                    self.notify("dev.dmxAuto", "ok", name=name, port=p["device"])
                except Exception as e:
                    self.notify("dev.dmxFail", "err", name=name, err=str(e))
            else:
                self.notify("dev.dmxNew", "ok", name=name, port=p["device"])
        for p in gone:
            if identify_port(p):
                self.notify("dev.dmxGone", "warn", name=identify_port(p)[1], port=p["device"])
        if udmx and not prev_udmx:
            if not eng.output.ok or eng.output.name == "simulation":
                try:
                    eng.reconfigure_output("udmx")
                    self.notify("dev.dmxAuto", "ok", name="uDMX", port="USB")
                except Exception as e:
                    self.notify("dev.dmxFail", "err", name="uDMX", err=str(e))
            else:
                self.notify("dev.dmxNew", "ok", name="uDMX", port="USB")
        elif prev_udmx and not udmx:
            self.notify("dev.dmxGone", "warn", name="uDMX", port="USB")

    def _check_rivals(self) -> None:
        """QLC+, Freestyler … running = the DMX cable may be taken by them (only one program at a time)."""
        try:
            out = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True, timeout=6,
                                 creationflags=0x08000000).stdout.lower()
        except Exception:
            return
        found = [label for exe, label in RIVALS if f'"{exe}"' in out]
        if found != self.rivals:
            new = [x for x in found if x not in self.rivals]
            self.rivals = found
            for name in new:
                self.notify("dev.rival", "warn", name=name)

    def _check_cameras(self, first: bool) -> None:
        cams = list_cameras()
        if not cams and not self.cameras:
            return
        new = [c for c in cams if c not in self.cameras]
        gone = [c for c in self.cameras if c not in cams]
        self.cameras = cams
        if first:
            return
        if new and self.on_camera:
            self.on_camera()                    # waiting video sources reconnect right away
        for c in new:
            self.notify("dev.camNew", "ok", name=c)
        for c in gone:
            self.notify("dev.camGone", "warn", name=c)
