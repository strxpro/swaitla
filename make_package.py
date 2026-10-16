"""
make_package.py
===============
Builds a ZIP that installs Lumo on another Windows computer.

    python make_package.py                    # clean install (no lamps / shows of this computer)
    python make_package.py --with-settings    # + config.json, own effects, shows and songs
    python make_package.py --offline          # + all Python packages (no internet needed on the target PC)

Result: dist/Lumo-<date>.zip  →  on the other computer: unzip, double-click instaluj.bat.
"""

from __future__ import annotations

import argparse
import shutil
import struct
import subprocess
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TOP = "Lumo"
FILES = ["main.py", "vision.py", "dmx_controller.py", "interaction.py", "effects.py", "tracking.py", "spotlight.py", "devices.py", "smoke.py", "qlcimport.py", "dmxdoctor.py", "mecal.py",
         "custom_gestures.py", "stage.py", "calibration.py", "make_package.py", "rhythm.py", "director.py", "musicai.py", "aihelp.py", "VERSION",
         "requirements.txt", "fixture_library.json", "README.md", "ROZPISKA.md",
         "run.bat", "instaluj.bat", "odinstaluj.bat", "pakuj.bat", "lumo.ico"]
DIRS = ["static", "models", "tools", "fixturelib", "tests", "installer"]
SETTINGS = ["config.json", "presets.json"]
SKIP_PARTS = {"__pycache__", ".venv", "dist", "build", ".claude"}


def make_icon(path: Path) -> None:
    """lumo.ico: violet-to-teal tile, a white lamp and its soft beam (PNG images inside an ICO)."""
    import cv2
    import numpy as np
    images = []
    for size in (256, 64, 48, 32, 16):
        s = 256
        yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
        k = np.clip((xx + yy) / (2 * s), 0, 1)[..., None]                       # diagonal gradient
        c0, c1 = np.array([242, 63, 123], np.float32), np.array([201, 182, 31], np.float32)   # BGR violet, teal
        rgb = c0 * (1 - k) + c1 * k
        img = np.zeros((s, s, 4), np.uint8)
        img[..., :3] = rgb.astype(np.uint8)
        img[..., 3] = 255
        beam = img.copy()                                                            # Lumo: lamp, beam, spot on the floor
        cv2.fillPoly(beam, [np.array([[106, 101], [150, 101], [200, 205], [56, 205]], np.int32)], (255, 255, 255, 255), cv2.LINE_AA)
        img = cv2.addWeighted(beam, 0.36, img, 0.64, 0)
        spot = img.copy()
        cv2.ellipse(spot, (128, 205), (72, 18), 0, 0, 360, (255, 255, 255, 255), -1, cv2.LINE_AA)
        img = cv2.addWeighted(spot, 0.6, img, 0.4, 0)
        cv2.circle(img, (128, 80), 38, (255, 255, 255, 255), -1, cv2.LINE_AA)      # lamp
        cv2.circle(img, (128, 80), 15, tuple(int(v) for v in c0) + (255,), -1, cv2.LINE_AA)
        mask = np.zeros((s, s), np.uint8)                                            # rounded tile
        r = 64
        cv2.rectangle(mask, (r, 0), (s - r, s), 255, -1)
        cv2.rectangle(mask, (0, r), (s, s - r), 255, -1)
        for cx, cy in ((r, r), (s - r - 1, r), (r, s - r - 1), (s - r - 1, s - r - 1)):
            cv2.circle(mask, (cx, cy), r, 255, -1, cv2.LINE_AA)
        img[..., 3] = mask
        if size != s:
            img = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
        ok, png = cv2.imencode(".png", img)
        images.append((size, png.tobytes()))
    head = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries, blobs = b"", b""
    for size, data in images:
        entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset + len(blobs))
        blobs += data
    path.write_bytes(head + entries + blobs)


def download_wheels(dest: Path) -> None:
    """All packages from requirements.txt as wheels for this Windows / Python version."""
    dest.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([sys.executable, "-m", "pip", "download", "-r", str(ROOT / "requirements.txt"),
                           "-d", str(dest), "--only-binary=:all:"])


def build(with_settings: bool, offline: bool) -> Path:
    if not (ROOT / "lumo.ico").exists():
        make_icon(ROOT / "lumo.ico")
    out_dir = ROOT / "dist"
    out_dir.mkdir(exist_ok=True)
    name = f"Lumo-{time.strftime('%Y%m%d')}{'-z-ustawieniami' if with_settings else ''}{'-offline' if offline else ''}.zip"
    out = out_dir / name
    wheels = ROOT / "build" / "wheels"
    if offline:
        if wheels.exists():
            shutil.rmtree(wheels)
        download_wheels(wheels)
    count = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        def add(p: Path, arc: str) -> None:
            nonlocal count
            z.write(p, f"{TOP}/{arc}")
            count += 1
        for f in FILES:
            if (ROOT / f).exists():
                add(ROOT / f, f)
        for d in DIRS:
            for p in sorted((ROOT / d).rglob("*")):
                if p.is_file() and not (set(p.relative_to(ROOT).parts) & SKIP_PARTS):
                    add(p, p.relative_to(ROOT).as_posix())
        if with_settings:
            for f in SETTINGS:
                if (ROOT / f).exists():
                    add(ROOT / f, f)
            for p in sorted((ROOT / "shows").rglob("*")):
                if p.is_file():
                    add(p, p.relative_to(ROOT).as_posix())
        if offline:
            for p in sorted(wheels.glob("*.whl")):
                add(p, f"wheels/{p.name}")
    print(f"\n  Gotowe: {out}  ({count} plików, {out.stat().st_size / 1e6:.1f} MB)")
    print("  Na drugim komputerze: rozpakuj ZIP i uruchom instaluj.bat\n")
    return out


SED = """[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName={target}
FriendlyName=Lumo
AppLaunched=cmd /c setup.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0="app.zip"
FILE1="setup.ps1"
FILE2="setup.cmd"
FILE3="lumo.ico"
[SourceFiles]
SourceFiles0={src}\\
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
"""


def build_installer(zip_path: Path) -> Path | None:
    """Lumo-Setup.exe: a normal installer window (installer/setup.ps1) packed with Windows' own IExpress."""
    iexpress = Path(r"C:\Windows\System32\iexpress.exe")
    if sys.platform != "win32" or not iexpress.exists():
        print("  (instalator .exe tylko na Windows - pomijam)")
        return None
    import tempfile
    work = Path(tempfile.mkdtemp(prefix="lumo-setup-"))           # IExpress dislikes spaces in paths
    shutil.copy(zip_path, work / "app.zip")
    for f in ("setup.ps1", "setup.cmd"):
        shutil.copy(ROOT / "installer" / f, work / f)
    shutil.copy(ROOT / "lumo.ico", work / "lumo.ico")
    target = work / "Lumo-Setup.exe"
    (work / "lumo.sed").write_text(SED.format(target=target, src=work), encoding="ascii")
    subprocess.run([str(iexpress), "/N", "/Q", str(work / "lumo.sed")], check=False, timeout=600)
    if not target.exists():
        print("  Nie udało się zbudować instalatora (IExpress)")
        return None
    out = zip_path.parent / "Lumo-Setup.exe"
    shutil.copy(target, out)
    shutil.rmtree(work, ignore_errors=True)
    print(f"  Instalator: {out}  ({out.stat().st_size / 1e6:.1f} MB) - dwuklik = okno instalacji\n")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Paczka instalacyjna Lumo")
    ap.add_argument("--with-settings", action="store_true", help="dołącz lampy, własne efekty, pokazy i utwory")
    ap.add_argument("--offline", action="store_true", help="dołącz pakiety Pythona (instalacja bez internetu)")
    ap.add_argument("--icon-only", action="store_true", help=argparse.SUPPRESS)
    a = ap.parse_args()
    if a.icon_only:
        make_icon(ROOT / "photon.ico")
        return
    out = build(a.with_settings, a.offline)
    build_installer(out)


if __name__ == "__main__":
    main()
