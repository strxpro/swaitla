"""
Fuzzy search over fixture names: typos, spaces, dashes, "MH-3" = "MH 3" = "mh3", "30 W" = "30W",
Polish letters, channel counts ("11ch") used as a filter.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any, Iterable

_PL = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
SOURCE_BONUS = {"rdm": 0.12, "mine": 0.08, "spotly": 0.06, "ofl": 0.04, "gdtf": 0.03, "qlc": 0.02}
STOP = {"the", "led", "dmx", "light", "lights", "lighting", "fixture", "lampa", "lamp", "with", "and", "for", "stage"}


def norm(s: str) -> str:
    s = s.translate(_PL).lower().replace("&", " and ")
    s = re.sub(r"(\d)\s*(w|ch|x|pcs)\b", r"\1\2", s)          # "30 W" -> "30w", "11 ch" -> "11ch"
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def tokens(s: str) -> list[str]:
    n = norm(s)
    out = []
    for w in n.split():
        out.append(w)
        m = re.fullmatch(r"([a-z]+)(\d+)", w) or re.fullmatch(r"(\d+)([a-z]+)", w)
        if m and not re.fullmatch(r"\d+(w|ch)", w):
            out += [m.group(1), m.group(2)]                        # "mh3" also as "mh" + "3"
    return out


def compact(s: str) -> str:
    return norm(s).replace(" ", "")


def wanted_channels(q: str) -> int | None:
    m = re.search(r"\b(\d{1,3})\s*(ch|kan|channel)", q.lower())
    return int(m.group(1)) if m else None


def _tok_score(q: str, cand: Iterable[str]) -> float:
    best = 0.0
    for e in cand:
        if q == e:
            return 1.0
        if len(q) >= 3 and (e.startswith(q) or q in e):
            best = max(best, 0.9)
            continue
        if len(q) >= 4 and len(e) >= 3:
            sm = SequenceMatcher(None, q, e)
            if sm.real_quick_ratio() < 0.7 or sm.quick_ratio() < 0.7:
                continue
            r = sm.ratio()
            if r >= 0.75:
                best = max(best, r * 0.8)
    return best


def score(query: str, entry: dict[str, Any]) -> float:
    """0..~1.3; entry = index record with manufacturer, model, aliases, modes."""
    qt = [w for w in tokens(query) if w not in STOP and not re.fullmatch(r"\d+ch", w)]
    want = wanted_channels(query)
    if "_tok" not in entry:
        text = " ".join([entry.get("manufacturer", ""), entry.get("model", "")] + list(entry.get("aliases") or []))
        entry["_tok"] = set(tokens(text))
        entry["_cmp"] = compact(text)
    et = entry["_tok"]
    if not qt:
        s = 0.5 if want else 0.0
    else:
        s = sum(_tok_score(q, et) for q in qt) / len(qt)
        cq = compact(" ".join(qt))
        if len(cq) >= 4 and cq in entry["_cmp"]:
            s += 0.3
    counts = [m[1] for m in entry.get("modes") or []]
    if want:
        s = s + 0.2 if want in counts else s * 0.5
    return s + SOURCE_BONUS.get(entry.get("source", ""), 0.0) * (1 if s > 0.3 else 0)


def search(query: str, index: list[dict[str, Any]], limit: int = 30, manufacturer: str = "", channels: int | None = None,
           category: str = "") -> list[dict[str, Any]]:
    out = []
    man = norm(manufacturer)
    for e in index:
        if man and man not in norm(e.get("manufacturer", "")):
            continue
        if channels and channels not in [m[1] for m in e.get("modes") or []]:
            continue
        if category and e.get("category") != category:
            continue
        s = score(query, e) if query.strip() else 0.5
        if s >= 0.45:
            out.append((s, e))
    out.sort(key=lambda x: (-x[0], x[1].get("model", "")))
    res = []
    for s, e in out[:limit]:
        r = {k: v for k, v in e.items() if not k.startswith("_")}
        r["score"] = round(min(1.0, s / 1.2), 3)
        res.append(r)
    return res
