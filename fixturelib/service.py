"""
FixtureLibraryService - one searchable library made of every source, working offline.

Lookup priority (also the order of equal search results):
  1. RDM exact manufacturer / model id      4. GDTF files the user imported
  2. my profiles (learned / saved lamps)    5. QLC+ definitions (installed with QLC+, offline)
  3. Lumo built-in library + Open Fixture Library (cached index, updated in the background)
  6. fuzzy match                            7. manual set-up / calibration

The index (names, makers, modes) is cached in cache/library_index.json and rebuilt in a
background thread when a source changes - the app never waits for the internet or for
parsing thousands of files.
"""

from __future__ import annotations

import glob
import json
import logging
import os
import re
import threading
import time
import urllib.request
from pathlib import Path
from typing import Any

from .adapters import GdtfFixtureAdapter, OflFixtureAdapter, QlcFixtureAdapter, SpotlyLibraryAdapter, _category, _slug
from .matcher import FixtureMatcher, probe_plan, seen
from .model import DANGEROUS, ChannelType, Mode, SpotlyFixtureDefinition, to_engine_spec
from .search import norm, search

log = logging.getLogger("fixturelib")

OFL_RAW = "https://raw.githubusercontent.com/OpenLightingProject/open-fixture-library/master/fixtures/"
OFL_SITE = "https://open-fixture-library.org/"
OFL_TREE = "https://api.github.com/repos/OpenLightingProject/open-fixture-library/git/trees/master?recursive=1"
INDEX_VERSION = 4


def qlc_dirs() -> list[str]:
    out = []
    for base in (r"C:\QLC+5", r"C:\QLC+", r"C:\Program Files\QLC+", r"C:\Program Files (x86)\QLC+",
                 os.path.expanduser(r"~\QLC+"), os.path.expanduser(r"~\Documents\QLC+")):
        d = os.path.join(base, "Fixtures") if os.path.isdir(os.path.join(base, "Fixtures")) else base if base.endswith("QLC+") and os.path.isdir(base) else None
        if d and os.path.isdir(d) and d not in out:
            out.append(d)
    return out


class FixtureLibraryService:
    def __init__(self, base_dir: Path, legacy_library: Path, online: bool = True) -> None:
        self.base = Path(base_dir)
        self.cache = self.base / "cache"
        self.legacy_path = Path(legacy_library)
        self.mine_path = self.base / "my_fixtures.json"
        self.online = online
        self.index: list[dict[str, Any]] = []
        self.ready = False
        self.building = False
        self.status = "idle"             # idle | building | ready | updating
        self.ofl_state = "none"          # none | cached | updated | offline | error
        self.ofl_updated = 0.0
        self._lock = threading.RLock()
        self._defs: dict[str, SpotlyFixtureDefinition] = {}
        self.matcher = FixtureMatcher()

    # ------------------------------------------------------------------ index
    def start(self) -> None:
        self.cache.mkdir(exist_ok=True)
        self._load_cached_index()
        threading.Thread(target=self._refresh, name="fixturelib", daemon=True).start()

    def _sig(self) -> dict[str, Any]:
        qfiles = [f for d in qlc_dirs() for f in glob.glob(os.path.join(d, "**", "*.qxf"), recursive=True)]
        gfiles = glob.glob(str(self.cache / "gdtf" / "*.gdtf"))
        reg = self.cache / "ofl" / "index.json"
        return {"v": INDEX_VERSION, "qlc": [len(qfiles), int(max((os.path.getmtime(f) for f in qfiles), default=0))],
                "gdtf": sorted(os.path.basename(f) for f in gfiles), "ofl": int(reg.stat().st_mtime) if reg.exists() else 0}

    def _load_cached_index(self) -> None:
        p = self.cache / "library_index.json"
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if data.get("sig", {}).get("v") == INDEX_VERSION:
                with self._lock:
                    self.index = data["entries"]
                    self.ready = True
                    self.status = "ready"
                log.info("fixture library: %d entries from cache", len(self.index))
        except Exception:
            pass

    def _refresh(self) -> None:
        try:
            sig = self._sig()
            cached = {}
            try:
                cached = json.loads((self.cache / "library_index.json").read_text(encoding="utf-8")).get("sig", {})
            except Exception:
                pass
            if sig != cached or not self.ready:
                self.rebuild(sig)
            if self.online:
                self.update_ofl()
        except Exception:
            log.exception("fixture library refresh failed")

    def rebuild(self, sig: dict[str, Any] | None = None) -> None:
        self.building, self.status = True, "building"
        t0 = time.time()
        entries: list[dict[str, Any]] = []
        qa = QlcFixtureAdapter()
        for d in qlc_dirs():
            for f in glob.glob(os.path.join(d, "**", "*.qxf"), recursive=True):
                try:
                    defn = qa.parse(Path(f).read_bytes(), f)
                    e = defn.summary()
                    e["path"] = f
                    entries.append(e)
                except Exception as ex:
                    log.debug("qxf %s: %s", f, ex)
        ga = GdtfFixtureAdapter()
        for f in glob.glob(str(self.cache / "gdtf" / "*.gdtf")):
            try:
                e = ga.parse(Path(f).read_bytes(), f).summary()
                e["path"] = f
                entries.append(e)
            except Exception as ex:
                log.warning("gdtf %s: %s", f, ex)
        entries += self._ofl_entries()
        # the same QLC+ file may exist in two installs: keep one
        uniq, seen_ids = [], set()
        for e in entries:
            if e["id"] in seen_ids:
                continue
            seen_ids.add(e["id"])
            uniq.append(e)
        with self._lock:
            self.index = uniq
            self.ready, self.building, self.status = True, False, "ready"
        try:
            (self.cache / "library_index.json").write_text(json.dumps({"sig": sig or self._sig(), "entries": uniq},
                                                                      ensure_ascii=False), encoding="utf-8")
        except Exception as ex:
            log.warning("cannot write the library cache: %s", ex)
        log.info("fixture library: %d entries built in %.1f s", len(uniq), time.time() - t0)

    def _ofl_entries(self) -> list[dict[str, Any]]:
        idx_p, man_p = self.cache / "ofl" / "index.json", self.cache / "ofl" / "manufacturers.json"
        if not idx_p.exists():
            return []
        try:
            keys = json.loads(idx_p.read_text(encoding="utf-8"))
            mans = json.loads(man_p.read_text(encoding="utf-8")) if man_p.exists() else {}
        except Exception:
            return []
        out = []
        for key in keys:
            man_key, _, fix = key.partition("/")
            man = (mans.get(man_key) or {}).get("name", man_key.replace("-", " ").title())
            name = " ".join(w.upper() if re.fullmatch(r"[a-z]*\d[a-z\d]*", w) else w.capitalize() for w in fix.split("-"))
            out.append({"id": f"ofl:{key}", "manufacturer": man, "model": name, "category": _category(name),
                        "modes": [], "aliases": [], "source": "ofl", "source_url": OFL_SITE + key})
        self.ofl_state = "cached"
        return out

    def update_ofl(self, force: bool = False) -> str:
        """Refresh the list of Open Fixture Library lamps (~0.4 MB) at most once a week, in the background."""
        idx_p = self.cache / "ofl" / "index.json"
        if not force and idx_p.exists() and time.time() - idx_p.stat().st_mtime < 7 * 86400:
            self.ofl_state = "cached"
            return self.ofl_state
        self.status = "updating"
        try:
            (self.cache / "ofl").mkdir(parents=True, exist_ok=True)
            tree = json.loads(_get(OFL_TREE))
            keys = sorted(t["path"][len("fixtures/"):-len(".json")] for t in tree.get("tree", [])
                          if t.get("type") == "blob" and t["path"].startswith("fixtures/") and t["path"].count("/") == 2
                          and t["path"].endswith(".json"))
            if len(keys) < 50:
                raise ValueError("pusta lista OFL")
            mans = _get(OFL_RAW + "manufacturers.json")
            json.loads(mans)
            (self.cache / "ofl" / "manufacturers.json").write_bytes(mans)
            idx_p.write_text(json.dumps(keys), encoding="utf-8")
            self.rebuild()
            self.ofl_state, self.ofl_updated = "updated", time.time()
        except Exception as e:
            log.info("OFL update skipped (%s) - working offline", e)
            self.ofl_state = "offline" if idx_p.exists() else "error"
            self.status = "ready" if self.ready else "idle"
        return self.ofl_state

    # ------------------------------------------------------------------ user data
    def _mine(self) -> dict[str, Any]:
        try:
            return json.loads(self.mine_path.read_text(encoding="utf-8"))
        except Exception:
            return {"profiles": [], "aliases": {}}

    def _save_mine(self, data: dict[str, Any]) -> None:
        tmp = self.mine_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.mine_path)

    def mine_entries(self) -> list[dict[str, Any]]:
        return [SpotlyFixtureDefinition.from_dict(p).summary() for p in self._mine().get("profiles", [])]

    def legacy_entries(self) -> list[dict[str, Any]]:
        try:
            lib = json.loads(self.legacy_path.read_text(encoding="utf-8"))
        except Exception:
            return []
        a = SpotlyLibraryAdapter()
        return [a.parse(e).summary() for e in lib]

    def save_profile(self, d: dict[str, Any], name: str | None = None) -> SpotlyFixtureDefinition:
        """"Learn this fixture": store the profile locally, next time it is one click."""
        defn = SpotlyFixtureDefinition.from_dict({**d, "id": d.get("id") or "mine:tmp"})
        if name:
            defn.model = name.strip()[:60]
        defn.source, defn.confidence = "mine", 1.0
        defn.id = "mine:" + _slug(f"{defn.model}-{int(time.time())}") if not defn.id.startswith("mine:") or defn.id == "mine:tmp" else defn.id
        data = self._mine()
        data["profiles"] = [p for p in data.get("profiles", []) if p.get("id") != defn.id] + [defn.to_dict()]
        self._save_mine(data)
        self._defs.pop(defn.id, None)
        return defn

    def delete_profile(self, fid: str) -> None:
        data = self._mine()
        data["profiles"] = [p for p in data.get("profiles", []) if p.get("id") != fid]
        data["aliases"] = {k: v for k, v in (data.get("aliases") or {}).items() if v != fid}
        self._save_mine(data)

    def add_alias(self, alias: str, fid: str) -> None:
        a = norm(alias)
        if not a:
            return
        data = self._mine()
        data.setdefault("aliases", {})[a] = fid
        self._save_mine(data)

    # ------------------------------------------------------------------ queries
    def all_entries(self) -> list[dict[str, Any]]:
        with self._lock:
            return self.mine_entries() + self.legacy_entries() + list(self.index)

    def search(self, q: str, manufacturer: str = "", channels: int | None = None, category: str = "",
               limit: int = 30) -> list[dict[str, Any]]:
        entries = self.all_entries()
        res = search(q, entries, limit, manufacturer, channels, category)
        alias = (self._mine().get("aliases") or {}).get(norm(q))
        if alias:
            hit = next((e for e in entries if e["id"] == alias), None)
            if hit:
                res = [{**{k: v for k, v in hit.items() if not k.startswith("_")}, "score": 1.0, "alias": True}] + \
                      [r for r in res if r["id"] != alias]
        return res[:limit]

    def get(self, fid: str) -> SpotlyFixtureDefinition:
        if fid in self._defs:
            return self._defs[fid]
        src, _, key = fid.partition(":")
        defn: SpotlyFixtureDefinition | None = None
        if src == "mine":
            p = next((p for p in self._mine().get("profiles", []) if p.get("id") == fid), None)
            if p:
                defn = SpotlyFixtureDefinition.from_dict(p)
        elif src == "spotly":
            lib = json.loads(self.legacy_path.read_text(encoding="utf-8"))
            e = next((e for e in lib if e["key"] == key), None)
            if e:
                defn = SpotlyLibraryAdapter().parse(e)
        elif src in ("qlc", "gdtf"):
            e = next((e for e in self.index if e["id"] == fid), None)
            if e and e.get("path") and os.path.exists(e["path"]):
                data = Path(e["path"]).read_bytes()
                defn = (QlcFixtureAdapter().parse(data, e["path"]) if src == "qlc" else GdtfFixtureAdapter().parse(data, e["path"]))
        elif src == "ofl":
            p = self.cache / "ofl" / "fixtures" / (key + ".json")
            if not p.exists():
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(_get(OFL_RAW + key + ".json"))     # fetched once, then offline
            e = next((e for e in self.index if e["id"] == fid), None)
            defn = OflFixtureAdapter().parse(p.read_bytes(), key, (e or {}).get("manufacturer", ""), OFL_SITE + key)
        if defn is None:
            raise KeyError(f"nie znam profilu {fid}")
        self._defs[fid] = defn
        if src == "ofl":                                   # now we know its modes: show them in the results
            with self._lock:
                for e in self.index:
                    if e["id"] == fid:
                        e["modes"] = [[m.name, m.count] for m in defn.modes]
        return defn

    def details(self, fid: str) -> dict[str, Any]:
        return self.get(fid).to_dict()

    def import_gdtf(self, data: bytes, filename: str) -> SpotlyFixtureDefinition:
        defn = GdtfFixtureAdapter().parse(data, filename)
        d = self.cache / "gdtf"
        d.mkdir(parents=True, exist_ok=True)
        p = d / (_slug(Path(filename).stem) + ".gdtf")
        p.write_bytes(data)
        defn.source_url = str(p)
        threading.Thread(target=self.rebuild, daemon=True).start()
        return defn

    def engine_spec(self, fid: str, mode: str | int | None) -> dict[str, Any]:
        defn = self.get(fid)
        m = defn.mode(mode)
        if m is None:
            raise KeyError(f"{defn.model}: nie ma trybu {mode}")
        return to_engine_spec(defn, m)

    # ------------------------------------------------------------------ matching
    def candidates(self, q: str, count: int, limit: int = 6) -> list[tuple[SpotlyFixtureDefinition, Mode]]:
        """Profiles with this channel count that fit the name - loaded fully (for the probe)."""
        out = []
        for r in self.search(q, channels=count, limit=limit * 2):
            try:
                d = self.get(r["id"])
            except Exception:
                continue
            m = d.mode(count)
            if m:
                out.append((d, m))
            if len(out) >= limit:
                break
        # the same map twice (a clone under another name) is one candidate
        uniq, sigs = [], set()
        for d, m in out:
            sig = tuple(seen(c.type) for c in m.channels)
            if sig not in sigs:
                sigs.add(sig)
                uniq.append((d, m))
        return uniq

    def disambiguate(self, q: str, count: int) -> dict[str, Any]:
        cands = self.candidates(q, count)
        plan = probe_plan(cands)
        return {"candidates": [{"key": d.id + "|" + m.name, "id": d.id, "mode": m.name, "model": d.model,
                                "manufacturer": d.manufacturer, "source": d.source,
                                "seen": [seen(c.type) for c in m.channels],
                                "danger": [i for i, c in enumerate(m.channels) if c.type in DANGEROUS]} for d, m in cands],
                **plan}

    def match(self, count: int | None, known: dict[int, str], text: str = "", rdm: dict[str, int] | None = None,
              limit: int = 5) -> list[dict[str, Any]]:
        kn = {}
        for k, v in known.items():
            try:
                kn[int(k)] = ChannelType(v)
            except ValueError:
                continue
        pool: list[SpotlyFixtureDefinition] = []
        text_ids = {r["id"] for r in self.search(text, channels=count, limit=60)} if text.strip() else set()
        for e in self.all_entries():
            if count and count not in [m[1] for m in e.get("modes") or []]:
                continue
            if text.strip() and not count and e["id"] not in text_ids:
                continue
            if e.get("types"):
                pool.append(SpotlyFixtureDefinition.from_summary(e))
        return self.matcher.rank(pool, count, kn, text, rdm, limit)

    def state(self) -> dict[str, Any]:
        return {"ready": self.ready, "status": self.status, "count": len(self.index) + len(self.mine_entries()),
                "ofl": self.ofl_state, "qlc_dirs": qlc_dirs(), "mine": len(self._mine().get("profiles", []))}


def _get(url: str, timeout: float = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Lumo/4.5 (fixture library)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()
