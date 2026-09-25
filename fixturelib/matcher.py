"""
FixtureMatcher: which known profile fits what we know about a lamp?

Evidence can be a partial calibration (channel count + "CH1 is pan, CH6 is dimmer"), text
(model name typed by the user) and RDM identifiers. Scoring follows the Lumo spec:

  exact channel count        +25
  pan offset match           +15      tilt offset match  +15
  dimmer match               +10      colour / gobo      +10     other channel type  +5
  manufacturer / model text  +20 × similarity
  RDM manufacturer ID        +40      RDM model ID       +60

Confidence = score / best possible score for the evidence given. A profile is never applied
automatically - the UI shows the result and the user confirms.

The disambiguation planner picks the channels that tell several candidate maps apart
("I have 3 possible 11CH profiles - let us check 3 channels").
"""

from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any

from .model import ChannelType as CT, DANGEROUS, Mode, SpotlyFixtureDefinition
from .search import norm

FAMILY = {
    CT.MasterDimmer: "dimmer", CT.Dimmer: "dimmer", CT.Shutter: "strobe", CT.Strobe: "strobe",
    CT.PanTiltSpeed: "speed", CT.MotorSpeed: "speed", CT.AutoProgram: "macro", CT.SoundProgram: "macro", CT.Macro: "macro",
    CT.ColorWheel: "cwheel", CT.GoboWheel: "gobo", CT.GoboRotation: "gobo_rot", CT.Unknown: "none", CT.Other: "none",
}
WEIGHT = {CT.Pan: 15, CT.Tilt: 15, CT.Dimmer: 10, CT.MasterDimmer: 10, CT.ColorWheel: 10, CT.GoboWheel: 10,
          CT.Red: 10, CT.Green: 10, CT.Blue: 10}

# what the user SEES when one channel goes up (answers of the probe step)
SEEN = {
    CT.Pan: "pan", CT.Tilt: "tilt", CT.Dimmer: "light", CT.MasterDimmer: "light", CT.Shutter: "light",
    CT.Strobe: "strobe", CT.Red: "color", CT.Green: "color", CT.Blue: "color", CT.White: "color", CT.Amber: "color",
    CT.UV: "color", CT.Cyan: "color", CT.Magenta: "color", CT.Yellow: "color", CT.ColorWheel: "color",
    CT.GoboWheel: "gobo", CT.GoboRotation: "gobo", CT.Prism: "gobo", CT.PrismRotation: "gobo",
    CT.AutoProgram: "auto", CT.SoundProgram: "auto", CT.Macro: "auto",
}


def fam(t: CT) -> str:
    return FAMILY.get(t, t.value)


def seen(t: CT) -> str:
    return SEEN.get(t, "nothing")


class FixtureMatcher:
    def score_mode(self, defn: SpotlyFixtureDefinition, mode: Mode, count: int | None = None,
                   known: dict[int, CT] | None = None, text: str = "", rdm: dict[str, int] | None = None) -> tuple[float, float]:
        """(score, max possible score) of one mode against the evidence."""
        s = best = 0.0
        if count:
            best += 25
            if mode.count == count:
                s += 25
            else:
                return (-100.0, best)            # a different channel count is never "the same map"
        for off, t in (known or {}).items():
            w = WEIGHT.get(t, 5)
            best += w
            if off < mode.count:
                mt = mode.channels[off].type
                if mt == t or fam(mt) == fam(t):
                    s += w
                elif not (t in (CT.Unknown, CT.Other) or mt in (CT.Unknown, CT.Other)):
                    s -= 10
        if text.strip():
            best += 20
            a, b = norm(text), norm(f"{defn.manufacturer} {defn.model} {' '.join(defn.aliases)}")
            sim = SequenceMatcher(None, a, b).ratio()
            if a and a in b:
                sim = max(sim, 0.95)
            s += 20 * sim
        if rdm:
            if rdm.get("manufacturer_id") is not None:
                best += 40
                if defn.rdm and defn.rdm.get("manufacturer_id") == rdm["manufacturer_id"]:
                    s += 40
            if rdm.get("model_id") is not None:
                best += 60
                if defn.rdm and defn.rdm.get("model_id") == rdm["model_id"] and (
                        rdm.get("manufacturer_id") is None or defn.rdm.get("manufacturer_id") == rdm.get("manufacturer_id")):
                    s += 60
        return s, best

    def rank(self, defs: list[SpotlyFixtureDefinition], count: int | None = None, known: dict[int, CT] | None = None,
             text: str = "", rdm: dict[str, int] | None = None, limit: int = 5) -> list[dict[str, Any]]:
        out = []
        for d in defs:
            for m in d.modes:
                s, best = self.score_mode(d, m, count, known, text, rdm)
                if best <= 0 or s <= 0:
                    continue
                out.append({"id": d.id, "manufacturer": d.manufacturer, "model": d.model, "mode": m.name,
                            "count": m.count, "source": d.source, "confidence": round(max(0.0, min(1.0, s / best)), 3)})
        out.sort(key=lambda r: -r["confidence"])
        return out[:limit]


def probe_plan(cands: list[tuple[SpotlyFixtureDefinition, Mode]], max_steps: int = 4) -> dict[str, Any]:
    """Channels to raise one by one so the user's answers tell the candidate maps apart.

    Never plans a channel that ANY candidate calls reset / lamp control / laser.
    Also returns a "base" frame that makes the lamp visible (dimmer / shutter every candidate agrees on).
    """
    if not cands:
        return {"steps": [], "base": {}}
    n = min(m.count for _, m in cands)
    base: dict[int, int] = {}
    for off in range(n):
        types = {m.channels[off].type for _, m in cands}
        if len(types) != 1:
            continue
        t = types.pop()
        if t in (CT.Dimmer, CT.MasterDimmer):
            base[off] = 200
        elif t == CT.Shutter:
            opens = [c for c in cands[0][1].channels[off].capabilities if c.semantic == "open"]
            base[off] = (opens[0].min + opens[0].max) // 2 if opens else 0
    remaining = list(range(len(cands)))
    steps = []
    used: set[int] = set()
    for _ in range(max_steps):
        best, best_groups = None, None
        for off in range(n):
            if off in used or off in base:
                continue
            if any(m.channels[off].type in DANGEROUS for _, m in cands):
                continue
            groups: dict[str, list[int]] = {}
            for i in remaining:
                groups.setdefault(seen(cands[i][1].channels[off].type), []).append(i)
            if len(groups) < 2:
                continue
            worst = max(len(v) for v in groups.values())          # minimise the biggest group left
            if best is None or worst < best_groups[0] or (worst == best_groups[0] and len(groups) > best_groups[1]):
                best, best_groups = off, (worst, len(groups))
        if best is None:
            break
        used.add(best)
        steps.append({"offset": best, "expect": {cands[i][0].id + "|" + cands[i][1].name: seen(cands[i][1].channels[best].type)
                                                  for i in range(len(cands))}})
        if best_groups[0] <= 1:
            break
    return {"steps": steps, "base": {str(k): v for k, v in base.items()}}
