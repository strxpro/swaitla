"""
director.py
===========
The AI lighting director - the autopilot style "ai".

It works like a lighting designer at a live show.  Every beat it gets

* the beat grid (beat in the bar) from rhythm.RhythmClock,
* the part of the song from the browser tracker (static/beatcore.js):
  intro / verse / chorus / build / drop / breakdown / outro / quiet, with its energy,
* what the AI model hears (musicai.MusicAI): genre family, mood, a new song started.

From that it chooses a *flavour* (film, concert, club, chill, elegant, rave - or the
one the user picked), a colour palette that suits the genre and the mood, and every
phrase a new *look*: a movement, a colour layer, a dimmer layer and accents on the
beat.  A new look morphs out of the old one - long soft morphs for film and chill
music, quick ones for club music, a hard cut with a blinder (and strobe) on a drop.
Build-ups get a riser: the beams climb, the colours wash out to white and the
flashes get faster until the drop.
"""

from __future__ import annotations

import random
from collections import deque
from typing import Any, Callable

FLAVORS: dict[str, dict[str, Any]] = {
    # morph = beats of a normal look change, phrase = beats per look
    "cinema": {"pl": "Kino", "it": "Cinema", "morph": 4.0, "phrase": 32, "strobe": False, "hits": False},
    "concert": {"pl": "Koncert", "it": "Concerto", "morph": 2.0, "phrase": 16, "strobe": True, "hits": True},
    "club": {"pl": "Klub", "it": "Club", "morph": 1.0, "phrase": 16, "strobe": True, "hits": True},
    "chill": {"pl": "Chill", "it": "Chill", "morph": 4.0, "phrase": 32, "strobe": False, "hits": False},
    "elegant": {"pl": "Elegancja", "it": "Eleganza", "morph": 3.0, "phrase": 32, "strobe": False, "hits": False},
    "rave": {"pl": "Rave", "it": "Rave", "morph": 0.5, "phrase": 8, "strobe": True, "hits": True},
}
FAMILY_FLAVOR = {"electronic": "club", "rock": "concert", "pop": "concert", "urban": "club",
                 "cinematic": "cinema", "jazz": "elegant", "folk": "elegant", "latin": "concert",
                 "festive": "concert", "ambient": "chill"}
SECTION_ENERGY = {"intro": 0.35, "verse": 0.55, "chorus": 0.85, "build": 0.7, "drop": 1.0,
                  "breakdown": 0.3, "outro": 0.3, "quiet": 0.15}

PALETTES: dict[str, list[list[int]]] = {
    "electronic": [[0, 90, 255], [180, 0, 255], [255, 0, 140], [0, 220, 255]],
    "techno": [[255, 255, 255], [0, 60, 255], [255, 0, 40], [120, 0, 255]],
    "rock": [[255, 20, 0], [255, 140, 0], [255, 255, 255], [255, 200, 80]],
    "pop": [[255, 0, 140], [0, 220, 255], [255, 220, 0], [150, 0, 255]],
    "urban": [[120, 0, 255], [255, 170, 0], [255, 0, 60], [0, 40, 255]],
    "cinematic": [[255, 170, 60], [20, 60, 255], [255, 236, 210], [110, 30, 200]],
    "jazz": [[255, 140, 30], [255, 80, 10], [50, 40, 190], [255, 210, 150]],
    "folk": [[255, 150, 40], [255, 205, 100], [140, 210, 60], [255, 110, 40]],
    "latin": [[255, 90, 0], [255, 0, 120], [255, 210, 0], [0, 200, 120]],
    "festive": [[255, 0, 0], [0, 200, 60], [255, 190, 60], [255, 255, 255]],
    "ambient": [[0, 200, 200], [120, 80, 255], [255, 120, 180], [60, 140, 255]],
}
MOOD_PALETTES: dict[str, list[list[int]]] = {
    "sad": [[30, 60, 255], [90, 40, 220], [0, 150, 255], [170, 150, 255]],
    "tender": [[255, 120, 170], [255, 170, 120], [200, 120, 255], [255, 220, 200]],
    "angry": [[255, 0, 0], [255, 255, 255], [180, 0, 0], [255, 60, 0]],
    "scary": [[120, 0, 255], [255, 0, 30], [0, 255, 80], [40, 0, 120]],
    "happy": [[255, 200, 0], [255, 80, 160], [0, 220, 255], [120, 255, 60]],
}
FLAVOR_PALETTE = {"cinema": "cinematic", "concert": "rock", "club": "electronic", "chill": "ambient",
                  "elegant": "jazz", "rave": "techno"}


def L(kind: str, **params: Any) -> tuple[str, dict[str, Any]]:
    return kind, params


def look(lid: str, pl: str, it: str, flavors: str, energy: tuple[float, float], move: Any, color: Any,
         dim: Any = None, hit: float | None = None, acc: str | None = None) -> dict[str, Any]:
    return {"id": lid, "pl": pl, "it": it, "fl": set(flavors.split()), "e": energy,
            "move": move, "color": color, "dim": dim, "hit": hit, "acc": acc}


LOOKS = [
    # ---- film ----------------------------------------------------------------------
    look("sunrise", "Świt", "Alba", "cinema elegant chill", (0.0, 0.5),
         L("fly_out", beats=32, lift=18, spread=0.15), L("sunrise", beats=32, spread=0.1), L("breathe", beats=16, min=0.5)),
    look("premiere", "Premiera", "Prima", "cinema elegant concert", (0.2, 0.7),
         L("searchlight", beats=16, size=40, lift=25), L("color_morph", beats=8, hold=0.6)),
    look("noir", "Noir", "Noir", "cinema chill", (0.0, 0.55),
         L("sweep", beats=16, size=25, spread=0.3), L("noir", beats=16, spread=0.15), L("breathe", beats=8, min=0.35)),
    look("aurora", "Zorza", "Aurora", "cinema chill elegant", (0.0, 0.6),
         L("tilt_wave", beats=16, size=12, spread=0.25), L("aurora", beats=16), L("breathe", beats=16, min=0.55)),
    look("storm", "Burza", "Tempesta", "cinema concert", (0.45, 0.9),
         L("searchlight", beats=8, size=30, lift=15), L("noir", beats=8), L("lightning", beats=4, floor=0.15)),
    look("morph", "Morfing kształtów", "Forme che cambiano", "cinema chill concert club", (0.3, 0.8),
         L("shape_morph", beats=4, size=35, hold=2.0), L("color_morph", beats=4, hold=0.45)),
    # ---- concert -------------------------------------------------------------------
    look("ballyhoo", "Ballyhoo", "Ballyhoo", "concert club rave", (0.55, 1.0),
         L("ballyhoo", beats=4, size=50), L("color_morph", beats=2, hold=0.4), hit=0.4),
    look("crossfire", "Krzyżowy ogień", "Fuoco incrociato", "concert club", (0.5, 1.0),
         L("crossfire", beats=4, size=45), L("split", beats=8), hit=0.5),
    look("fanblast", "Wachlarz", "Ventaglio", "concert rave", (0.6, 1.0),
         L("mirror", beats=2, size=50), L("color_morph", beats=8, hold=0.8), acc="blinder"),
    look("audience", "Na publiczność", "Sul pubblico", "concert club", (0.5, 0.95),
         L("fly_out", beats=4, lift=30, spread=0.25), L("color_morph", beats=4, hold=0.5), L("chase_beat", floor=0.25)),
    look("rockwash", "Rockowa fala", "Onda rock", "concert", (0.45, 0.9),
         L("sweep", beats=8, size=40, spread=0.2), L("two_color", beats=2), hit=0.3),
    look("stack", "Schody", "Scala", "concert club", (0.5, 0.9),
         L("tilt_wave", beats=4, size=20, spread=0.2), L("sequence", beats=4), L("stack", beats=4)),
    # ---- club ----------------------------------------------------------------------
    look("beatchase", "Pościg w bit", "Inseguimento", "club rave", (0.6, 1.0),
         L("circle", beats=4, size=40, spread=0.25), L("chase", beats=1), L("chase_beat", floor=0.1)),
    look("pulse", "Puls", "Pulsazione", "club concert", (0.45, 0.85),
         L("figure8", beats=8, size=40, spread=0.25), L("color_morph", beats=2, hold=0.5), L("beat", floor=0.2, curve=2.0)),
    look("stutter", "Stutter", "Stutter", "club rave", (0.75, 1.0),
         L("crossfire", beats=2, size=40), L("sequence", beats=1), L("stutter", div=4, duty=0.5)),
    look("mirrorpulse", "Lustro", "Specchio", "club concert", (0.5, 0.95),
         L("mirror", beats=4, size=45), L("two_color", beats=1), hit=0.25),
    look("strobestorm", "Burza stroboskopów", "Tempesta di strobo", "rave", (0.8, 1.0),
         L("random", beats=1, size=55), L("static_color", white=True), L("stutter", div=2, duty=0.4)),
    look("raverun", "Rave run", "Rave run", "rave club", (0.7, 1.0),
         L("spiral", beats=4, size=55, spread=0.2), L("chase", beats=0.5), hit=0.0),
    # ---- chill / elegant -----------------------------------------------------------
    look("breath", "Oddech", "Respiro", "chill cinema elegant", (0.0, 0.5),
         L("figure8", beats=32, size=18, spread=0.25), L("color_morph", beats=8, hold=0.3), L("breathe", beats=8, min=0.45)),
    look("candle", "Świece", "Candele", "elegant chill", (0.0, 0.45),
         L("sweep", beats=32, size=15), L("candle")),
    look("ocean", "Ocean", "Oceano", "chill", (0.1, 0.6),
         L("tilt_wave", beats=16, size=15, spread=0.3), L("aurora", beats=32), L("breathe", beats=16, min=0.5)),
    look("golden", "Złota godzina", "Ora d’oro", "elegant cinema", (0.1, 0.6),
         L("searchlight", beats=32, size=25, lift=10), L("color_morph", beats=16, hold=0.6), L("breathe", beats=16, min=0.6)),
    look("twinkle", "Gwiazdy", "Stelle", "elegant chill", (0.0, 0.55),
         L("sweep", beats=32, size=10), L("color_morph", beats=16, hold=0.5), L("twinkle", floor=0.45)),
]
BUILD = look("build", "Narastanie", "Crescendo", "", (0.0, 1.0),
             L("rise", beats=16, lift=30), L("desaturate", beats=16), L("riser", beats=16))
LOOK_BY_ID = {lk["id"]: lk for lk in LOOKS + [BUILD]}


class Director:
    def __init__(self, fx: Any) -> None:
        self.fx = fx                                   # effects.EffectEngine
        self.ai: Callable[[], dict] | None = None      # musicai.MusicAI.state
        self.cfg: dict[str, Any] = {"flavor": "auto", "morph": 0.5, "intensity": 0.5,
                                    "ai_colors": True, "strobe": True}
        self.look: dict[str, Any] | None = None
        self.flavor_now = "concert"
        self.palette: list[list[int]] = []
        self.palette_name = ""
        self.energy_now = 0.5
        self.frozen = False
        self.reason = ""
        self.since = 0                                 # beats since the look started
        self.bars = 0
        self.looks_played = 0
        self.recent: deque[str] = deque(maxlen=4)
        self.song_seq = 0
        self._lvl = 0.0

    # ---- settings ----------------------------------------------------------------
    def configure(self, **cfg: Any) -> None:
        for k, v in cfg.items():
            if v is None or k not in self.cfg:
                continue
            if k == "flavor":
                self.cfg[k] = v if v in FLAVORS or v == "auto" else "auto"
            elif k in ("morph", "intensity"):
                self.cfg[k] = max(0.0, min(1.0, float(v)))
            else:
                self.cfg[k] = bool(v)
        if self.fx.autopilot["on"] and self.fx.autopilot["mood"] == "ai":
            self.phrase(force=True, reason="style")

    def freeze(self, on: bool) -> None:
        self.frozen = bool(on)

    # ---- what is playing ---------------------------------------------------------------
    def _info(self) -> dict[str, Any]:
        try:
            return (self.ai() if self.ai else None) or {}
        except Exception:
            return {}

    def flavor(self, info: dict[str, Any] | None = None) -> str:
        if self.cfg["flavor"] in FLAVORS:
            return self.cfg["flavor"]
        info = self._info() if info is None else info
        bpm = self.fx.bpm or 110
        fam = info.get("family") if info.get("music", 0) > 0.25 else None
        if fam:
            fl = FAMILY_FLAVOR.get(fam, "concert")
        elif bpm < 95:
            fl = "chill" if self.energy_now < 0.45 else "cinema"
        elif bpm < 118:
            fl = "concert"
        else:
            fl = "club"
        if fl == "club" and bpm >= 136 and self.energy_now >= 0.8:
            fl = "rave"
        if info.get("mood") in ("sad", "tender") and fl in ("club", "concert") and self.energy_now < 0.5:
            fl = "cinema"
        return fl

    def energy(self) -> float:
        sec = self.fx.section
        if sec.get("name") in SECTION_ENERGY:
            e = 0.6 * SECTION_ENERGY[sec["name"]] + 0.4 * float(sec.get("energy") or 0.0)
        else:
            e = self._lvl
        e += (self.cfg["intensity"] - 0.5) * 0.5
        return max(0.0, min(1.0, e))

    def _palette(self, fl: str, info: dict[str, Any]) -> tuple[list[list[int]], str]:
        fx = self.fx
        if fx.autopilot.get("white"):
            return [[255, 255, 255]], "white"
        if not self.cfg["ai_colors"]:
            return [list(c) for c in fx.palette] or [list(c) for c in PALETTES["pop"]], "mine"
        name = FLAVOR_PALETTE[fl]
        if info.get("mood") in MOOD_PALETTES and info.get("mood_conf", 0) > 0.25:
            name = info["mood"]
        elif info.get("genre_key") == "techno" or fl == "rave":
            name = "techno"
        elif info.get("family") in PALETTES and info.get("music", 0) > 0.25:
            name = info["family"]
        pal = [list(c) for c in (MOOD_PALETTES.get(name) or PALETTES[name])]
        k = self.looks_played % len(pal)                  # every look leads with another colour
        return pal[k:] + pal[:k], name

    def _morph_beats(self, fl: str) -> float:
        return FLAVORS[fl]["morph"] * (0.25 + 1.75 * self.cfg["morph"])

    # ---- looks -----------------------------------------------------------------------
    def phrase(self, force: bool = False, reason: str = "phrase", energy: float | None = None,
               morph: float | None = None, flavors: set[str] | None = None) -> None:
        if self.frozen and not force:
            return
        info = self._info()
        e = self.energy() if energy is None else energy
        self.energy_now = e
        fl = self.flavor(info)
        self.flavor_now = fl
        self.palette, self.palette_name = self._palette(fl, info)
        pool = flavors or {fl}
        cands = [lk for lk in LOOKS if pool & lk["fl"] and lk["e"][0] - 0.12 <= e <= lk["e"][1] + 0.12]
        cands = cands or [lk for lk in LOOKS if pool & lk["fl"]] or LOOKS
        fresh = [lk for lk in cands if lk["id"] not in self.recent] or cands
        weights = [1.0 / (0.15 + abs(e - (lk["e"][0] + lk["e"][1]) / 2)) for lk in fresh]
        lk = random.choices(fresh, weights)[0]
        self._apply(lk, self._morph_beats(fl) if morph is None else morph, e)
        self.reason = reason

    def _apply(self, lk: dict[str, Any], morph_beats: float, energy: float) -> None:
        fx = self.fx
        self.look = lk
        self.since = 0
        self.looks_played += 1
        self.recent.append(lk["id"])
        pal = self.palette or [[255, 255, 255]]
        order = random.choice(["left", "right", "center"])
        size_k = 0.6 + 0.6 * energy                      # bigger music, bigger movements
        mv = lk["move"]
        if mv:
            kind, prm = mv[0], dict(mv[1])
            if "size" in prm:
                prm["size"] = prm["size"] * size_k
            prm.update(order=order, morph_beats=morph_beats * 1.5, ease="smooth", home=True)
            fx.start(kind, prm, "all", None, "ap-move")
        else:
            fx.stop("ap-move")
        kind, prm = lk["color"][0], dict(lk["color"][1])
        if prm.pop("white", False) or fx.autopilot.get("white"):
            kind, prm = "static_color", {"color_a": [255, 255, 255]}
        prm.update(colors=pal, color_a=pal[0], color_b=pal[1 % len(pal)], morph_beats=morph_beats)
        fx.start(kind, prm, "all", None, "ap-color")
        if lk["hit"] is not None and FLAVORS[self.flavor_now]["hits"]:
            fx.stop("ap-dim")                            # the beat hits drive the dimmer now
        else:
            fx.stop("ap-hit")
            dim = lk["dim"] or L("glow", level=0.82 + 0.18 * energy)
            fx.start(dim[0], {**dim[1], "order": order, "morph_beats": morph_beats * 0.5}, "all", None, "ap-dim")
        beam = self.flavor_now in ("concert", "club", "rave") and energy > 0.7 and lk["id"] != "build"
        film = self.flavor_now == "cinema" and 0.3 <= energy <= 0.75 and lk["id"] != "build"
        if beam:
            fx.start(random.choice(["gobo", "gobo_shake"]), {}, "all", None, "ap-beam")
        elif film:                                       # film: slowly turning gobo textures on the walls
            fx.start("gobo_spin", {"speed": 22}, "all", None, "ap-beam")
        else:
            fx.stop("ap-beam")
        if fx.motor_ids():                               # derby / ball / bar / spider: turn with the energy of the music
            lively = self.flavor_now in ("club", "rave", "concert")
            fx.start("motors", {"energy": round(energy, 2), "flip": lively, "aux": lively and energy > 0.75,
                                "beats": 4 if lively else 16}, "all", None, "ap-motor")

    def _impact(self) -> None:
        """The drop: a white blinder, strobe for a moment, then straight into a big look."""
        fx = self.fx
        bpm = fx.bpm or 120
        fx.start("blinder", {"decay": 0.7}, "all", 1.6, "ap-acc")
        if FLAVORS[self.flavor_now]["strobe"] and self.cfg["strobe"]:
            fx.start("strobe", {"speed": 235}, "all", 2 * 60.0 / bpm, "ap-drop")
        self.phrase(force=True, reason="drop", energy=1.0, morph=0.0)

    # ---- every beat ------------------------------------------------------------------
    def beat(self, strength: float, drop: bool, in_bar: int | None) -> None:
        fx = self.fx
        s = fx.audio_level if fx.audio_seen else max(0.0, min(1.0, strength))
        self._lvl = self._lvl * 0.85 + s * 0.15 if self._lvl else s
        self.since += 1
        if in_bar == 0:
            self.bars += 1
        info = self._info()
        seq = int(info.get("song_seq") or 0)
        if seq != self.song_seq:                         # the AI heard a new song: a fresh look for it
            self.song_seq = seq
            if self.look is not None:
                self.phrase(force=True, reason="song")
        if self.look is None:
            self.phrase(force=True, reason="start")
        if drop:
            self._impact()
        fl = self.flavor_now
        phrase = FLAVORS[fl]["phrase"]
        if self.energy_now > 0.8 and fl in ("club", "rave", "concert"):
            phrase = max(8, phrase // 2)
        if self.look["id"] != "build" and self.since >= phrase and in_bar in (0, None):
            self.phrase(reason="phrase")
        lk = self.look
        bpm = fx.bpm
        if lk["hit"] is not None and FLAVORS[fl]["hits"] and bpm:
            fx.start("kicks", {"hits": [[0.0, 0.6 + 0.4 * min(1.0, strength)]], "floor": lk["hit"],
                               "max_len": 60.0 / bpm * 0.9}, "all", None, "ap-hit")
        if lk["acc"] == "blinder" and in_bar == 0 and self.bars % 2 == 0:
            fx.start("blinder", {"decay": 0.45}, "all", 1.2, "ap-acc")
        loud_part = self.energy_now >= 0.75 and fx.section.get("name") in ("chorus", "drop")
        fast = bool(bpm) and (bpm >= 135 or drop or strength >= 0.9 or loud_part) and fl in ("club", "rave", "concert")
        if (fx.autopilot.get("lasers") and fast and fx.engine.lasers_enabled and fx.laser_ids()
                and "ap-laser" not in fx.effects):
            fx.start("laser_hit", {"duty": 0.4, "beats": 1 if bpm < 150 else 0.5}, None, 4 * 60.0 / bpm, "ap-laser")
        if (fx.autopilot["spot"] and fx.on_spot and fl in ("cinema", "elegant", "chill", "concert")
                and self.energy_now < 0.6 and self.bars % 16 == 8 and in_bar == 0 and bpm):
            fx.on_spot(16 * 60.0 / bpm)                  # a short spotlight moment on a person

    def on_section(self, prev: str, name: str) -> None:
        if self.frozen:
            return
        fl = self.flavor_now
        if name == "drop":
            self._impact()
        elif name == "build":
            self.reason = "build"
            self.energy_now = 0.75
            self._apply(BUILD, 1.0, 0.75)
        elif name == "breakdown":                         # the drums are gone: a film moment
            self.phrase(force=True, reason="breakdown", energy=0.3, morph=self._morph_beats(fl) * 2,
                        flavors={"cinema", "chill", "elegant"})
        elif name in ("quiet", "outro"):
            self.phrase(force=True, reason=name, energy=0.2, morph=self._morph_beats(fl) * 2,
                        flavors={"cinema", "chill", "elegant"})
        elif name in ("chorus", "verse", "intro") and prev in ("build", "breakdown", "quiet", "intro", ""):
            self.phrase(force=True, reason=name)

    def next_look(self) -> None:
        self.phrase(force=True, reason="manual", morph=max(1.0, self._morph_beats(self.flavor_now)))

    # ---- UI ----------------------------------------------------------------------------
    def state(self) -> dict[str, Any]:
        lk = self.look or {}
        fl = self.flavor_now
        return {"look": lk.get("id"), "look_pl": lk.get("pl"), "look_it": lk.get("it"),
                "flavor": fl, "flavor_pl": FLAVORS[fl]["pl"], "flavor_it": FLAVORS[fl]["it"],
                "palette": self.palette, "palette_name": self.palette_name,
                "energy": round(self.energy_now, 2), "frozen": self.frozen, "reason": self.reason,
                "next_in": max(0, FLAVORS[fl]["phrase"] - self.since), "cfg": dict(self.cfg)}
