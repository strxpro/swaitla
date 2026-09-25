"""
qlcimport.py
============
Reads the lamps from QLC+ workspaces (*.qxw) so Lumo can say
"Found in QLC+: Little Dragonfly 21CH at address 1 — is this your lamp?".

DMX lamps cannot tell what they are, but QLC+ already knows how you set them up:
the recent workspaces are listed in the Windows registry, next to them lie the
other workspaces of the same folder. Every fixture (name, model, mode, address,
channel count) is matched against the Lumo library by name first, then by the
number of channels. A "RAW" fixture that spans several lamps is split using the
lamps found in the other workspaces (e.g. RAW 1-37 = Dragonfly 21 + 16 channels).
"""

from __future__ import annotations

import glob
import logging
import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

log = logging.getLogger("qlc")

# words in a QLC+ name / model -> Lumo library key (channel count picks between variants)
RULES: list[tuple[str, dict[int, str] | str]] = [
    ("dragonfly", "dragonfly-21"),
    ("bee", "beam-bar-26"), ("beam bar", "beam-bar-26"),
    ("moving effect", "moving-effect-16"),
    ("mini", {9: "mini-spot-9", 11: "mini-spot-11"}), ("tomshine", {9: "mini-spot-9", 11: "mini-spot-11"}),
    ("spot", {9: "mini-spot-9", 11: "mini-spot-11"}),
    ("moving head", {9: "moving-head-9"}),
    ("par", {4: "par-rgbw-4", 7: "par-rgbw-7"}),
    ("strob", {2: "strobe-2"}),
    ("smoke", {1: "smoke-1", 3: "smoke-3"}), ("fog", {1: "smoke-1", 3: "smoke-3"}), ("dym", {1: "smoke-1", 3: "smoke-3"}),
    ("laser", {8: "laser-8"}),
]


def _tag(x: str) -> str:
    return x.split("}")[-1]


def recent_workspaces() -> list[str]:
    """Workspaces QLC+ opened last (newest first), then the others in the same folders."""
    out: list[str] = []
    try:
        import winreg
        for sub in (r"Software\qlcplus\Q Light Controller Plus\workspace", r"Software\qlcplus\qlcplus\workspace"):
            try:
                key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, sub)
            except OSError:
                continue
            for i in range(20):
                try:
                    val, _ = winreg.QueryValueEx(key, f"recent{i}")
                except OSError:
                    continue
                if val:
                    out.append(os.path.normpath(str(val).lstrip("/")))
    except ImportError:
        pass
    folders = {os.path.dirname(p) for p in out if p}
    for d in sorted(folders):
        out += sorted(glob.glob(os.path.join(d, "*.qxw")), key=os.path.getmtime, reverse=True)
    seen, res = set(), []
    for p in out:
        k = os.path.normcase(p)
        if k in seen or ".autosave." in k or not os.path.isfile(p):
            continue
        seen.add(k)
        res.append(p)
    return res[:30]


def read_workspace(path: str) -> list[dict[str, Any]]:
    try:
        root = ET.parse(path).getroot()
    except Exception as e:                     # damaged or not a QLC+ file
        log.debug("cannot read %s: %s", path, e)
        return []
    fx = []
    for el in root.iter():
        if _tag(el.tag) != "Fixture":
            continue
        d = {_tag(c.tag): (c.text or "").strip() for c in el}
        if "Address" not in d:
            continue
        try:
            fx.append({"name": d.get("Name", ""), "manufacturer": d.get("Manufacturer", ""), "model": d.get("Model", ""),
                       "mode": d.get("Mode", ""), "universe": int(d.get("Universe", 0) or 0),
                       "address": int(d.get("Address", 0) or 0) + 1, "channels": int(d.get("Channels", 0) or 0)})
        except ValueError:
            continue
    return fx


def match(fx: dict[str, Any], library: list[dict[str, Any]]) -> tuple[str | None, bool]:
    """Library key for a QLC+ fixture and whether the match is sure (by name) or a guess (by count)."""
    keys = {e["key"]: e for e in library}
    text = f"{fx['manufacturer']} {fx['model']} {fx['name']} {fx['mode']}".lower()
    n = fx["channels"]
    for word, target in RULES:
        if word in text:
            key = target if isinstance(target, str) else target.get(n)
            if key in keys and len(keys[key]["channels"]) == n:
                return key, True
    same = [e["key"] for e in library if len(e["channels"]) == n]
    if len(same) == 1:
        return same[0], False
    return None, False


def scan(library: list[dict[str, Any]]) -> dict[str, Any]:
    """Every lamp found in the QLC+ workspaces, newest workspace first, with a Lumo suggestion."""
    files = recent_workspaces()
    found: list[dict[str, Any]] = []
    known: list[dict[str, Any]] = []            # sure matches from any workspace (to split RAW ranges)
    per_file = []
    for p in files:
        items = read_workspace(p)
        per_file.append((p, items))
        for fx in items:
            key, sure = match(fx, library)
            if key and sure:
                known.append({**fx, "key": key})
    seen = set()
    for p, items in per_file:
        for fx in items:
            if fx["universe"] != 0:
                continue
            key, sure = match(fx, library)
            parts = [{**fx, "key": key, "sure": sure}]
            if not key and re.search(r"raw|oba|all|wszystk", fx["name"].lower()):
                parts = _split(fx, known, library)
            for part in parts:
                sig = (part["address"], part["channels"], part.get("key"))
                if sig in seen:
                    continue
                seen.add(sig)
                lib = next((e for e in library if e["key"] == part.get("key")), None)
                found.append({"file": os.path.basename(p), "path": p, "name": part["name"], "address": part["address"],
                              "channels": part["channels"], "key": part.get("key"), "sure": part.get("sure", False),
                              "model": lib["model"] if lib else None})
    return {"files": [os.path.basename(p) for p in files], "fixtures": found}


def _split(raw: dict[str, Any], known: list[dict[str, Any]], library: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """RAW range (several lamps in one generic fixture): known lamps first, the rest guessed by channel count."""
    start, end = raw["address"], raw["address"] + raw["channels"] - 1
    parts, a = [], start
    for k in sorted(known, key=lambda x: x["address"]):
        if k["address"] == a and k["address"] + k["channels"] - 1 <= end:
            parts.append({**k, "name": k["name"], "sure": True})
            a += k["channels"]
    if a <= end:
        rest = end - a + 1
        same = [e["key"] for e in library if len(e["channels"]) == rest]
        parts.append({"name": f"{raw['name']} ({a}-{end})", "address": a, "channels": rest,
                      "key": same[0] if len(same) == 1 else None, "sure": False})
    return parts if parts else [{**raw, "key": None, "sure": False}]
