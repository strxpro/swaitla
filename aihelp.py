"""Lumo — Pomocnik AI: an optional chat about the lights and the party.

Several keys can be added; a question goes to the first one, and when that service is busy, out of its
free quota or offline the next one answers.  The kind is read from the key itself:
  Google Gemini  (free)  aistudio.google.com/apikey     keys "AIza…" or the newer "AQ.…"
  Groq           (free)  console.groq.com/keys          keys "gsk_…"
  OpenRouter     (free)  openrouter.ai/keys             keys "sk-or-…"   (its free models)
  Cerebras       (free)  cloud.cerebras.ai              keys "csk-…"
  Claude         (paid)  console.anthropic.com          keys "sk-ant-…"
The keys live only in ai_key.txt next to the program (one per line): never in config.json, the backups
or git.

Every question goes out with what Lumo knows right now (the lights with their ids and channels, the
show, the song), so the answer is about this rig.  The answer may end with [[verb:arg]] tags; the
browser turns them into buttons: open a page, point at a button on the screen, or do a setting -
always only after the user clicks.
"""
from __future__ import annotations

import json
import logging
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

log = logging.getLogger("lumo.aihelp")

CLAUDE_MODEL = "claude-opus-5-5"
# the alias first, then fixed names (a model may be closed for new projects, busy or out of free quota: the next)
GEMINI_MODELS = ("gemini-flash-latest", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent"
# OpenAI-compatible services: base URL, then the models we like best (the list is read from the service,
# because free models change every few months)
OPENAI_LIKE = {
    "groq": ("https://api.groq.com/openai/v1", ("gpt-oss-120b", "llama-3.3-70b", "llama-4", "qwen3", "gpt-oss-20b", "llama-3.1-8b")),
    "openrouter": ("https://openrouter.ai/api/v1", ("openrouter/free",)),
    "cerebras": ("https://api.cerebras.ai/v1", ("gpt-oss-120b", "qwen-3-235b", "llama-3.3-70b", "qwen-3-32b", "llama3.1-8b")),
}
SKIP_MODELS = ("whisper", "tts", "guard", "embed", "audio", "image", "vision", "compound", "playai", "speech", "moderation")
PROVIDERS = ("gemini", "groq", "openrouter", "cerebras", "claude")
NAMES = {"gemini": "Google Gemini", "groq": "Groq", "openrouter": "OpenRouter", "cerebras": "Cerebras", "claude": "Claude"}
LEGACY = {"rig": "go:rig", "add": "go:add", "cal": "go:cal", "sync": "go:sync", "manual": "go:manual",
          "scenes": "go:scenes", "moments": "go:moments", "show": "go:show", "dmx": "go:setup/dmx", "midi": "go:setup/keys"}
MAX_TURNS = 6
UA = "Lumo/5 (+local lighting app)"

GUIDE = """You are the helper inside Lumo, a DMX lighting program on a laptop. The person asking is not
technical: a musician / host running the lights at a party (often a wedding) with cheap moving heads,
PAR lights, effect lights and lasers bought on AliExpress, usually without manuals. Answer in the
language of the question (Polish by default, Italian if they write Italian). Be short and practical:
at most about 8 sentences or a short numbered list, plain words, no jargon without a short
explanation. Use the names of the buttons exactly as below (Polish UI). Do not invent features.

What Lumo has (Polish UI names):
- Top bar tabs: "Pokaz" (show), "Scena" (3-D view), "Dłoń" (hand gestures), "Światła" (faders per
  lamp and channel, groups), "Kamera sceny", "Muzyka", "Ustawienia". A status pill shows whether the
  DMX cable works. "Pomoc" opens this helper. Key B = blackout. Bottom bar: every lamp as a chip
  (click = select, Ctrl+click = select several, right click = menu: settings, blink, channels,
  detect channels, "Nie świeci?", calibrate, add one more of the same, change model, on/off, delete),
  "Jasność" (grand master), "Lasery wyłączone/uzbrojone", "Blackout". Right click in the 3-D scene
  gives the same lamp menu, or "Dodaj światło" / aim all heads here / views.
- Pokaz page: checklist "Co dalej?"; the big button "Zacznij pokaz" (music in → AI director runs the
  lights in rhythm); styles: Auto AI, Kino, Koncert, Klub, Chill, Elegancja, Rave; sliders for
  intensity and smoothness; "Synchronizacja" (flashes early/late, ms); "Momenty": Kolacja, Pierwszy
  taniec, Parkiet, Szaleństwo, Tort / toast, Wyciszenie; "Sceny" (saved looks put on top of the
  running show, "Puść wszystko" gives the lamps back); "Reflektor ręczny" (top view: click where a
  person stands, the chosen heads aim there and stay - dragging the mouse moves them live; colour,
  brightness, "Ruch wokół osoby", "Obracające się gobo", "Zapisz jako scenę"; "Rozstaw lampy" = drag
  lamps to where they hang; "Popraw celowanie" = a lamp that misses: pick it, move its light with
  the arrows onto the spot, "Zapisz poprawkę" - done at 2-3 spots (middle, left, right) it aims
  right everywhere).
- "Efekty" on the Pokaz page: tabs Ruch / Kolor / Jasność / Specjalne; pick the lamps with the lamp
  buttons inside the Efekty section ("Lampy", or "Wszystkie"), click an effect tile and it plays at once on those lamps only (they leave the show
  for that layer, the rest keeps playing); Tempo wolno/średnio/szybko, size of the movement,
  colours; "Grają teraz" list with ✕ per effect, "Zatrzymaj wszystkie (oddaj pokazowi)", "Zapisz jako
  scenę" (saves the lamps' look AND the running effects; clicking the scene brings them back).
  Scenes: right click = Włącz / Nadpisz tym, co teraz świeci / Zmień nazwę / Usuń.
- "Moje światła": lights with an address map and conflicts; per light: name, address, "Mrugnij",
  "Kanały" (what each DMX channel does, with sliders to test), "Rozpoznaj" (step by step: Lumo
  raises one channel at a time, the user clicks what the lamp does), "Nie świeci?" (finds the
  shutter value), "Ustaw laser" (finds the CH1 mode value of a laser), "Usuń"; "Dodaj światło"
  wizard: type → model search (offline library ~2400 profiles) or "Nie znam modelu" (channel count)
  → address, count, side, mount, height. "Zmień model" keeps the lamp, its place and scenes.
- The show plays every channel role: movement (pan/tilt), colour (RGBW or colour wheel), dimmer,
  strobe/shutter, gobo, lasers (only when armed, on fast parts / loud choruses / drops), and effect
  lights: rotation "spin" turns with the energy of the music and changes direction on lively music,
  lens tilt "beam" sways in rhythm, extra strobes "aux1/aux2" flash on the bar in loud parts.
- Identical lamps: on the SAME address they always do exactly the same (add them once as "×N").
  Separate addresses (e.g. 1, 12, 23 for 11-channel heads) let the show play waves, chases and
  fans between them - better for a show. Left and right groups should differ in address anyway.
- Music: line input or microphone; BPM, downbeats and song parts are tracked; YAMNet (offline) finds
  genre/mood; the song title (AudD) is optional with its own key.
- A DMX console cannot be read through a simple USB-DMX cable; a USB MIDI controller can drive Lumo.
- Typical lamp problems: lamp in Sound/Auto/Master/Slave instead of DMX; wrong address (d001/A001);
  cable computer → DMX IN of the first lamp → DMX OUT → IN of the next; wrong channel mode (9CH vs
  11CH); the lamp only lights at a specific shutter value.

Channel roles Lumo knows (use exactly these words): pan, pan_fine, tilt, tilt_fine, dimmer,
shutter (strobe/shutter), red, green, blue, white, cwheel (colour wheel), gobo, speed (pan/tilt motor
speed), spin (continuous rotation of an effect light), beam (lens tilt of a bar), laser, laser_r,
laser_g (laser colours), strip, strip_speed (LED strip programs), macro (auto/sound programs; on a
laser: the mode channel), aux1, aux2 (extra white/gold strobes), none (unused). Several heads in one
unit: give every head's channel the same role (e.g. tilt, tilt, tilt, tilt) - they move together.

Buttons under your answer - end the answer with up to 4 tags on the last line (no explanation):
- Open a page: [[go:show]] [[go:scene]] [[go:mixer]] [[go:music]] [[go:hand]] [[go:stagecam]]
  [[go:setup]] [[go:rig]] (Moje światła) [[go:add]] (Dodaj światło) [[go:cal]] (Kalibracja świateł)
  [[go:sync]] [[go:manual]] [[go:scenes]] [[go:moments]] [[go:effects]] [[go:fix]] [[go:help]]
  [[go:setup/dmx]] [[go:setup/library]] [[go:setup/dmxcal]] [[go:setup/keys]] (MIDI and keys)
  [[go:setup/diag]] (what works) [[go:setup/backup]] [[go:setup/lampcal]] [[go:setup/stage]]
- Point at a button on the screen: [[show:start]] [[show:styles]] [[show:moments]] [[show:scenes]]
  [[show:manual]] [[show:effects]] [[show:fix]] [[show:sync]] [[show:blackout]] [[show:lasers]] [[show:master]] [[show:lamps]]
  [[show:status]] [[show:help]]
- Do it for the user (they confirm with a click): [[do:moment=dinner|first|floor|party|cake|calm]]
  [[do:style=auto|cinema|concert|club|chill|elegant|rave]] [[do:show=start|stop]]
  [[do:intensity=0-100]] [[do:master=0-100]] [[do:blackout=on|off]] [[do:lasers=on|off]]
  [[do:scene=Name]] [[do:release]] [[do:blink=ID]]
  [[do:fx=EFFECT|ID,ID or all]] with EFFECT one of: circle figure8 sweep tilt_wave fan ballyhoo
  searchlight crossfire rainbow chase two_color static_color gradient fire ocean aurora police wave beat
  chase_beat breathe pulse sparkle strobe gobo_spin gobo_shake motors [[do:rename=ID|New name]] [[do:address=ID|N]]
  [[do:enable=ID|on|off]] [[do:channels=ID|role,role,...]] (one role per DMX channel, in order,
  as many roles as the lamp has channels) [[do:type=ID|moving_head|par|bar|derby|strobe|laser]].
  ID is the lamp id from the list below. Only suggest a "do" when the user asked for that change or
  clearly needs it; for channels, only when you know (from the user or the manual) what each channel does."""


def provider_of(key: str) -> str | None:
    key = (key or "").strip()
    if not key or any(c.isspace() for c in key):
        return None
    if key.startswith("sk-ant-"):
        return "claude"
    if key.startswith("gsk_"):
        return "groq"
    if key.startswith("sk-or-"):
        return "openrouter"
    if key.startswith("csk-"):
        return "cerebras"
    if len(key) >= 20:                                       # Google: "AIza…", "AQ.…" (and newer formats)
        return "gemini"
    return None


class _Fail(Exception):
    """A known problem: the browser shows a translated message for it."""


class AIHelper:
    def __init__(self, key_path: Path) -> None:
        self.key_path = key_path
        self.items: list[tuple[str, str]] = []                 # (provider, key)
        self.installing = False
        self._models: dict[str, tuple[float, list[str]]] = {}  # provider → (when, model ids we may use)
        self.last_provider: str | None = None
        try:
            for line in key_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                prov, _, key = line.partition(":") if line.split(":", 1)[0] in PROVIDERS else ("", "", line)
                prov = prov or provider_of(key)
                if prov and key:
                    self.items.append((prov, key.strip()))
        except OSError:
            pass

    # ---- the keys --------------------------------------------------------------------------
    @property
    def key(self) -> str:
        return self.items[0][1] if self.items else ""

    @property
    def provider(self) -> str | None:
        return self.items[0][0] if self.items else None

    def state(self) -> dict[str, Any]:
        def mask(k: str) -> str:
            return f"{k[:4]}…{k[-4:]}" if len(k) > 12 else "…"
        return {"on": bool(self.items), "provider": self.provider, "installing": self.installing,
                "masked": mask(self.key) if self.items else "",
                "keys": [{"i": i, "provider": p, "name": NAMES[p], "masked": mask(k)} for i, (p, k) in enumerate(self.items)]}

    def _write(self) -> None:
        if self.items:
            self.key_path.write_text("".join(f"{p}:{k}\n" for p, k in self.items), encoding="utf-8")
        elif self.key_path.exists():
            self.key_path.unlink()

    def add_key(self, key: str, provider: str | None = None) -> dict[str, Any]:
        key = (key or "").strip()
        prov = provider if provider in PROVIDERS else provider_of(key)
        if not key or not prov or any(c.isspace() for c in key):
            raise ValueError("bad_key")
        self.items = [(p, k) for p, k in self.items if k != key] + [(prov, key)]
        self._write()
        if prov == "claude":
            self._ensure_sdk(background=True)
        return self.state()

    def remove_key(self, index: int | None = None) -> dict[str, Any]:
        if index is None:
            self.items = []
        elif 0 <= index < len(self.items):
            self.items.pop(index)
        self._write()
        return self.state()

    def set_key(self, key: str) -> dict[str, Any]:
        """Old single-key call: "" removes every key, a key is added."""
        return self.add_key(key) if (key or "").strip() else self.remove_key(None)

    def _ensure_sdk(self, background: bool = False) -> bool:
        """The Claude module is installed on first use (it is not needed for the free services)."""
        try:
            import anthropic  # noqa: F401
            return True
        except ImportError:
            pass
        if background:
            if not self.installing:
                threading.Thread(target=self._ensure_sdk, daemon=True).start()
            return False
        self.installing = True
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "anthropic"], capture_output=True, timeout=600)
            import anthropic  # noqa: F401,F811
            return True
        except Exception as e:                      # no internet / pip blocked
            log.warning("cannot install the Claude module: %s", e)
            return False
        finally:
            self.installing = False

    # ---- asking ----------------------------------------------------------------------------
    def ask(self, question: str, history: list[dict[str, Any]], context: str) -> dict[str, Any]:
        """Blocking (run in a thread). → {text, actions, provider} or {error}."""
        question = (question or "").strip()[:2000]
        if not question:
            return {"error": "empty"}
        if not self.items:
            return {"error": "no_key"}
        turns: list[dict[str, str]] = []
        for h in (history or [])[-2 * MAX_TURNS:]:
            role = "assistant" if h.get("role") == "assistant" else "user"
            text = str(h.get("text") or "").strip()[:3000]
            if not text:
                continue
            if turns and turns[-1]["role"] == role:
                turns[-1]["text"] += "\n\n" + text
            else:
                turns.append({"role": role, "text": text})
        while turns and turns[0]["role"] != "user":
            turns.pop(0)
        if turns and turns[-1]["role"] == "user":
            turns.pop()
        turns.append({"role": "user", "text": question})
        system = f"{GUIDE}\n\nWhat Lumo knows right now about this rig and the show:\n{context}"
        errors: list[str] = []
        for prov, key in list(self.items):                     # the first that answers wins
            try:
                if prov == "claude":
                    text = self._claude(key, system, turns)
                elif prov == "gemini":
                    text = self._gemini(key, system, turns)
                else:
                    text = self._openai_like(prov, key, system, turns)
            except _Fail as e:
                log.info("AI helper: %s → %s, trying the next one", prov, e)
                errors.append(str(e))
                continue
            except Exception as e:                  # never let the helper break the show
                log.exception("AI helper (%s)", prov)
                errors.append("other")
                continue
            self.last_provider = prov
            return {**split_actions(text), "provider": NAMES[prov]}
        for code in ("limit", "server", "offline", "no_credit", "refused", "no_module", "bad_key"):
            if code in errors:
                if code == "bad_key" and len(set(errors)) > 1:
                    continue
                return {"error": code}
        return {"error": errors[0] if errors else "other"}

    @staticmethod
    def _post(url: str, body: dict[str, Any], headers: dict[str, str], timeout: float = 60) -> dict[str, Any]:
        req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST",
                                     headers={"Content-Type": "application/json", "User-Agent": UA, **headers})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))

    @staticmethod
    def _http_fail(e: urllib.error.HTTPError, where: str) -> tuple[str, str]:
        msg = e.read().decode("utf-8", "replace")[:500]
        e.close()
        log.warning("%s %s: %s", where, e.code, msg)
        low = msg.lower()
        if e.code == 401 or "api_key" in low or "api key" in low or "invalid key" in low:
            return "bad_key", msg
        if e.code == 402 or "credit" in low:
            return "no_credit", msg
        if e.code == 429:
            return "limit", msg
        if e.code >= 500:
            return "server", msg
        return "other", msg

    def _gemini(self, key: str, system: str, turns: list[dict[str, str]]) -> str:
        body = {"systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "model" if t["role"] == "assistant" else "user", "parts": [{"text": t["text"]}]}
                             for t in turns]}
        last = "other"
        for model in GEMINI_MODELS:
            try:
                data = self._post(GEMINI_URL.format(model), body, {"x-goog-api-key": key}, timeout=60)
            except urllib.error.HTTPError as e:
                code, _ = self._http_fail(e, f"Gemini {model}")
                if code in ("bad_key", "no_credit"):
                    raise _Fail(code)
                last = code if code != "other" or last == "other" else last
                continue                              # gone / closed / busy / quota: the next model
            except (urllib.error.URLError, TimeoutError, OSError):
                last = "offline"
                continue
            cands = data.get("candidates") or []
            parts = ((cands[0].get("content") or {}).get("parts") or []) if cands else []
            text = "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
            if text:
                return text
            last = "refused"
        raise _Fail(last)

    def _models_for(self, prov: str, key: str) -> list[str]:
        base, prefs = OPENAI_LIKE[prov]
        when, cached = self._models.get(prov, (0.0, []))
        if cached and time.monotonic() - when < 6 * 3600:
            return cached
        ids: list[str] = []
        try:
            req = urllib.request.Request(f"{base}/models", headers={"Authorization": f"Bearer {key}", "User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read().decode("utf-8"))
            for m in data.get("data") or []:
                mid = str(m.get("id") or "")
                if not mid or any(s in mid.lower() for s in SKIP_MODELS):
                    continue
                if prov == "openrouter":                   # only the free ones
                    price = m.get("pricing") or {}
                    if not (mid.endswith(":free") or (str(price.get("prompt")) in ("0", "0.0") and str(price.get("completion")) in ("0", "0.0"))):
                        continue
                ids.append(mid)
        except urllib.error.HTTPError as e:
            code, _ = self._http_fail(e, f"{prov} models")
            if code == "bad_key":
                raise _Fail("bad_key")
        except (urllib.error.URLError, TimeoutError, OSError):
            raise _Fail("offline")
        except ValueError:
            pass
        ranked = [p for p in prefs if "/" in p and prov == "openrouter"]      # the free router first
        for p in prefs:
            ranked += [m for m in ids if p in m and m not in ranked]
        ranked += [m for m in ids if m not in ranked]
        ranked = ranked[:4] or list(prefs[:2])
        self._models[prov] = (time.monotonic(), ranked)
        return ranked

    def _openai_like(self, prov: str, key: str, system: str, turns: list[dict[str, str]]) -> str:
        base, _ = OPENAI_LIKE[prov]
        headers = {"Authorization": f"Bearer {key}"}
        if prov == "openrouter":
            headers["X-Title"] = "Lumo"
        msgs = [{"role": "system", "content": system}] + [{"role": t["role"], "content": t["text"]} for t in turns]
        last = "other"
        for model in self._models_for(prov, key):
            try:
                data = self._post(f"{base}/chat/completions", {"model": model, "messages": msgs, "max_tokens": 1500},
                                  headers, timeout=60)
            except urllib.error.HTTPError as e:
                code, _ = self._http_fail(e, f"{prov} {model}")
                if code in ("bad_key", "no_credit"):
                    raise _Fail(code)
                last = code if code != "other" or last == "other" else last
                continue
            except (urllib.error.URLError, TimeoutError, OSError):
                last = "offline"
                continue
            choice = (data.get("choices") or [{}])[0]
            text = str(((choice.get("message") or {}).get("content")) or "").strip()
            text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()      # reasoning models
            if text:
                return text
            last = "refused"
        raise _Fail(last)

    def _claude(self, key: str, system: str, turns: list[dict[str, str]]) -> str:
        if not self._ensure_sdk():
            raise _Fail("no_module")
        import anthropic
        client = anthropic.Anthropic(api_key=key, timeout=90.0, max_retries=1)
        try:
            resp = client.beta.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=16000,
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",                    # a declined question is retried on another model
                output_config={"effort": "low"},        # short practical answers
                system=system,
                messages=[{"role": t["role"], "content": t["text"]} for t in turns],
            )
        except anthropic.AuthenticationError:
            raise _Fail("bad_key")
        except anthropic.PermissionDeniedError:
            raise _Fail("bad_key")
        except anthropic.RateLimitError:
            raise _Fail("limit")
        except anthropic.APIConnectionError:
            raise _Fail("offline")
        except anthropic.APIStatusError as e:
            if e.status_code == 400 and "credit" in str(e).lower():
                raise _Fail("no_credit")
            raise _Fail("server" if e.status_code >= 500 else "other")
        if resp.stop_reason == "refusal":
            raise _Fail("refused")
        return "".join(b.text for b in resp.content if b.type == "text").strip()


TAG = re.compile(r"\[\[\s*([a-z]+)(?::([^\]\n]{1,300}))?\s*\]\]")


def split_actions(text: str) -> dict[str, Any]:
    """'… [[go:rig]] [[do:moment=party]]' → the text without the tags + the actions ("verb:arg")."""
    acts: list[str] = []
    for verb, arg in TAG.findall(text):
        a = LEGACY.get(verb) if not arg else f"{verb}:{arg.strip()}" if verb in ("go", "show", "do") else None
        if a and a not in acts:
            acts.append(a)
    clean = TAG.sub("", text).strip()
    clean = re.sub(r"\n{3,}", "\n\n", clean)
    return {"text": clean, "actions": acts[:5]}


def rig_context(snap: dict[str, Any], fx: dict[str, Any], director: dict[str, Any], music: dict[str, Any],
                looks: list[dict[str, Any]]) -> str:
    """A compact text about the rig for the model (no keys, no personal data)."""
    lines = []
    fixtures = snap.get("fixtures") or []
    if not fixtures:
        lines.append("No lights added yet.")
    for f in fixtures:
        chans = ", ".join(f"{i + 1}:{c}" for i, c in enumerate(f.get("channels") or []))
        lines.append(f"- id {f.get('id')} \"{f.get('name')}\" type {f.get('type')}, model {f.get('model') or 'unknown'}, "
                     f"DMX address {f.get('address')} ({f.get('footprint')} ch: {chans}), mount {f.get('mount')}"
                     + ("" if f.get("enabled", True) else ", DISABLED"))
    dmx = snap.get("dmx") or {}
    conf = dmx.get("conflicts") or []
    lines.append(f"DMX output: {dmx.get('label') or dmx.get('backend')} - {'working' if dmx.get('ok') else 'NOT connected / not working'}.")
    if conf:
        lines.append(f"Address conflicts: {json.dumps(conf, ensure_ascii=False)[:400]}")
    lines.append(f"Lasers armed: {'yes' if snap.get('lasers_enabled') else 'no (locked)'}. Blackout: {'on' if snap.get('blackout') else 'off'}.")
    ap = fx.get("autopilot") or {}
    lines.append(f"Show (AI director): {'running' if ap.get('on') else 'stopped'}; style {director.get('flavor')} "
                 f"(settings {json.dumps(director.get('cfg') or {}, ensure_ascii=False)}); current look {director.get('look_pl')}.")
    clock = fx.get("clock") or {}
    if fx.get("bpm"):
        lines.append(f"Music tempo: {round(float(fx.get('bpm') or 0))} BPM, locked: {clock.get('locked', clock.get('lock'))}; "
                     f"song part: {(fx.get('section') or {}).get('name')}.")
    if music and not music.get("silent"):
        song = music.get("song") or {}
        lines.append(f"Listening: genre {music.get('genre_pl') or music.get('family_pl') or '?'}, mood {music.get('mood_pl') or '?'}"
                     + (f", song \"{song.get('title')}\" - {song.get('artist')}" if song.get("title") else "") + ".")
    else:
        lines.append("No music is coming in right now.")
    held = snap.get("held") or []
    if held:
        names = [f.get("name") for f in fixtures if f.get("id") in held]
        lines.append(f"Held by hand (scene / hand-run spot): {', '.join(map(str, names))}.")
    if looks:
        lines.append("Saved scenes: " + ", ".join(f"\"{lk.get('name')}\"" for lk in looks[:30]) + ".")
    return "\n".join(lines)
