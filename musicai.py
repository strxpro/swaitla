"""
musicai.py
==========
What is playing?  Local AI listening + optional song recognition.

* **Local, offline, free**: Google's YAMNet sound classifier (AudioSet, 521 classes)
  through MediaPipe.  The browser sends the live input as 16 kHz mono PCM; every
  second the last two seconds are classified.  Slow and fast averages of the scores
  give the genre family (electronic, rock, pop, urban, film, jazz, folk, latin,
  festive, ambient), the mood (happy, sad, tender, exciting, angry, scary), vocals,
  instruments, applause / cheering, speech and silence.
* **New song**: silence followed by music, or a lasting change of what the model
  hears (a DJ mix), starts a new song (``song_seq`` + 1) - the director then
  designs a new look for it.
* **Title (optional, internet)**: with an AudD API key (dashboard.audd.io) eight
  seconds of a new song are sent to api.audd.io; the answer gives artist, title,
  album and the genres from Apple Music, which then win over the model's guess.

Nothing here touches the lights; effects / director read :meth:`MusicAI.state`.
"""

from __future__ import annotations

import io
import json
import logging
import math
import threading
import time
import urllib.request
import uuid
import wave
from pathlib import Path
from typing import Any

import numpy as np

log = logging.getLogger("musicai")

MODEL_PATH = Path(__file__).resolve().parent / "models" / "yamnet.tflite"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite"
SR = 16000
MAGIC = b"LMA1"                         # binary WebSocket frame: MAGIC + int16 little-endian PCM, 16 kHz mono
AUDD_URL = "https://api.audd.io/"

# YAMNet class -> (key, family, Polish, Italian)
GENRES: dict[str, tuple[str, str, str, str]] = {
    "Pop music": ("pop", "pop", "Pop", "Pop"),
    "Hip hop music": ("hiphop", "urban", "Hip-hop", "Hip hop"),
    "Rock music": ("rock", "rock", "Rock", "Rock"),
    "Heavy metal": ("metal", "rock", "Metal", "Metal"),
    "Punk rock": ("punk", "rock", "Punk", "Punk"),
    "Grunge": ("grunge", "rock", "Grunge", "Grunge"),
    "Progressive rock": ("progrock", "rock", "Rock progresywny", "Rock progressivo"),
    "Rock and roll": ("rocknroll", "rock", "Rock and roll", "Rock and roll"),
    "Psychedelic rock": ("psych", "rock", "Rock psychodeliczny", "Rock psichedelico"),
    "Rhythm and blues": ("rnb", "urban", "R&B", "R&B"),
    "Soul music": ("soul", "urban", "Soul", "Soul"),
    "Reggae": ("reggae", "latin", "Reggae", "Reggae"),
    "Country": ("country", "folk", "Country", "Country"),
    "Swing music": ("swing", "jazz", "Swing", "Swing"),
    "Bluegrass": ("bluegrass", "folk", "Bluegrass", "Bluegrass"),
    "Funk": ("funk", "urban", "Funk", "Funk"),
    "Folk music": ("folk", "folk", "Folk", "Folk"),
    "Middle Eastern music": ("mideast", "folk", "Muzyka orientalna", "Musica orientale"),
    "Jazz": ("jazz", "jazz", "Jazz", "Jazz"),
    "Disco": ("disco", "electronic", "Disco", "Disco"),
    "Classical music": ("classical", "cinematic", "Muzyka klasyczna", "Musica classica"),
    "Opera": ("opera", "cinematic", "Opera", "Opera"),
    "Electronic music": ("electronic", "electronic", "Elektronika", "Elettronica"),
    "House music": ("house", "electronic", "House", "House"),
    "Techno": ("techno", "electronic", "Techno", "Techno"),
    "Dubstep": ("dubstep", "electronic", "Dubstep", "Dubstep"),
    "Drum and bass": ("dnb", "electronic", "Drum and bass", "Drum and bass"),
    "Electronica": ("electronica", "electronic", "Electronica", "Electronica"),
    "Electronic dance music": ("edm", "electronic", "EDM", "EDM"),
    "Ambient music": ("ambient", "ambient", "Ambient", "Ambient"),
    "Trance music": ("trance", "electronic", "Trance", "Trance"),
    "Music of Latin America": ("latin", "latin", "Muzyka latynoska", "Musica latina"),
    "Salsa music": ("salsa", "latin", "Salsa", "Salsa"),
    "Flamenco": ("flamenco", "latin", "Flamenco", "Flamenco"),
    "Blues": ("blues", "jazz", "Blues", "Blues"),
    "New-age music": ("newage", "ambient", "New age", "New age"),
    "Music of Africa": ("africa", "latin", "Muzyka afrykańska", "Musica africana"),
    "Afrobeat": ("afrobeat", "latin", "Afrobeat", "Afrobeat"),
    "Gospel music": ("gospel", "urban", "Gospel", "Gospel"),
    "Music of Bollywood": ("bollywood", "pop", "Bollywood", "Bollywood"),
    "Ska": ("ska", "latin", "Ska", "Ska"),
    "Soundtrack music": ("soundtrack", "cinematic", "Muzyka filmowa", "Colonna sonora"),
    "Theme music": ("theme", "cinematic", "Motyw muzyczny", "Sigla"),
    "Video game music": ("game", "electronic", "Muzyka z gier", "Musica da videogiochi"),
    "Christmas music": ("christmas", "festive", "Muzyka świąteczna", "Musica natalizia"),
    "Wedding music": ("wedding", "jazz", "Muzyka weselna", "Musica nuziale"),
    "Dance music": ("dance", "electronic", "Muzyka taneczna", "Musica dance"),
    "Lullaby": ("lullaby", "ambient", "Kołysanka", "Ninna nanna"),
}
FAMILY_NAMES = {"electronic": ("Elektronika", "Elettronica"), "rock": ("Rock", "Rock"), "pop": ("Pop", "Pop"),
                "urban": ("Hip-hop i R&B", "Hip hop e R&B"), "cinematic": ("Muzyka filmowa i klasyczna", "Cinema e classica"),
                "jazz": ("Jazz i blues", "Jazz e blues"), "folk": ("Folk i country", "Folk e country"),
                "latin": ("Rytmy latynoskie", "Ritmi latini"), "festive": ("Świąteczna", "Festiva"),
                "ambient": ("Ambient i chill", "Ambient e chill")}
MOODS = {"Happy music": ("happy", "radosny", "allegro"), "Sad music": ("sad", "smutny", "triste"),
         "Tender music": ("tender", "czuły", "tenero"), "Exciting music": ("exciting", "porywający", "travolgente"),
         "Angry music": ("angry", "ostry", "aggressivo"), "Scary music": ("scary", "mroczny", "cupo")}
INSTRUMENTS = {"Electric guitar": ("gitara elektryczna", "chitarra elettrica"), "Acoustic guitar": ("gitara akustyczna", "chitarra acustica"),
               "Bass guitar": ("gitara basowa", "basso"), "Piano": ("fortepian", "pianoforte"), "Synthesizer": ("syntezator", "sintetizzatore"),
               "Drum machine": ("automat perkusyjny", "drum machine"), "Drum kit": ("perkusja", "batteria"),
               "Orchestra": ("orkiestra", "orchestra"), "String section": ("smyczki", "archi"), "Brass instrument": ("blacha", "ottoni"),
               "Saxophone": ("saksofon", "sassofono"), "Trumpet": ("trąbka", "tromba"), "Violin, fiddle": ("skrzypce", "violino"),
               "Organ": ("organy", "organo"), "Accordion": ("akordeon", "fisarmonica"), "Choir": ("chór", "coro"),
               "Scratching (performance technique)": ("scratch DJ", "scratch"), "Rapping": ("rap", "rap")}
# Apple Music genre words -> family (a recognised song knows its genre better than the model)
APPLE_FAMILY = (("christmas", "festive"), ("holiday", "festive"), ("dance", "electronic"), ("electronic", "electronic"),
                ("house", "electronic"), ("techno", "electronic"), ("trance", "electronic"), ("hip-hop", "urban"),
                ("rap", "urban"), ("r&b", "urban"), ("soul", "urban"), ("metal", "rock"), ("rock", "rock"),
                ("alternative", "rock"), ("punk", "rock"), ("soundtrack", "cinematic"), ("classical", "cinematic"),
                ("jazz", "jazz"), ("blues", "jazz"), ("latin", "latin"), ("reggae", "latin"), ("reggaeton", "latin"),
                ("afro", "latin"), ("country", "folk"), ("folk", "folk"), ("singer/songwriter", "folk"),
                ("ambient", "ambient"), ("new age", "ambient"), ("pop", "pop"))


def apple_family(genres: list[str]) -> str | None:
    for g in genres:
        low = g.lower()
        for word, fam in APPLE_FAMILY:
            if word in low:
                return fam
    return None


def wav_bytes(pcm: np.ndarray, sr: int = SR) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.astype("<i2").tobytes())
    return buf.getvalue()


class MusicAI:
    BUFFER_S = 12.0
    SILENCE_RMS = 0.006

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.buf = np.zeros(int(self.BUFFER_S * SR), np.int16)
        self.filled = 0                         # samples written in total
        self.analysed = 0                       # samples already classified (by count)
        self.fed_at = 0.0
        self.cfg: dict[str, Any] = {"listen": True, "recognize": False, "audd_token": ""}
        self.status = "off"                     # off | loading | listening | idle | error
        self.error = ""
        self._clf: Any = None
        self._names: list[str] = []
        self._short: np.ndarray | None = None   # ~4 s average of the scores
        self._long: np.ndarray | None = None    # ~25 s average (genre, mood)
        self.song_seq = 0
        self.song: dict[str, Any] | None = None
        self.song_started = 0.0
        self._silent_since: float | None = None
        self._was_silent = True
        self._change_since: float | None = None
        self._recog_tries = 0
        self._recog_next = 0.0
        self.recog_status = ""
        self.result: dict[str, Any] = {}
        self._running = True
        self._wake = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="music-ai", daemon=True)
        self._thread.start()

    # ---- settings -----------------------------------------------------------------
    def configure(self, **cfg: Any) -> None:
        with self.lock:
            for k in ("listen", "recognize"):
                if cfg.get(k) is not None:
                    self.cfg[k] = bool(cfg[k])
            if cfg.get("audd_token") is not None and str(cfg["audd_token"]).strip():
                self.cfg["audd_token"] = str(cfg["audd_token"]).strip()[:120]
            if self.cfg["recognize"] and self.song and not self.song.get("title"):
                self._recog_next = 0.0              # key just added: try the current song now

    def to_config(self) -> dict[str, Any]:
        return dict(self.cfg)

    def stop(self) -> None:
        self._running = False
        self._wake.set()

    # ---- input ----------------------------------------------------------------------
    def feed(self, data: bytes) -> None:
        """One binary frame from the browser (MAGIC + int16 PCM, 16 kHz mono)."""
        if not data.startswith(MAGIC) or not self.cfg["listen"]:
            return
        pcm = np.frombuffer(data[len(MAGIC):len(MAGIC) + (len(data) - len(MAGIC)) // 2 * 2], "<i2")
        if not len(pcm):
            return
        with self.lock:
            n = len(pcm)
            if n >= len(self.buf):
                self.buf[:] = pcm[-len(self.buf):]
            else:
                self.buf = np.roll(self.buf, -n)
                self.buf[-n:] = pcm
            self.filled += n
            self.fed_at = time.monotonic()
        if self.filled - self.analysed >= SR:
            self._wake.set()

    def _last(self, seconds: float) -> np.ndarray:
        with self.lock:
            n = min(int(seconds * SR), self.filled, len(self.buf))
            return self.buf[len(self.buf) - n:].copy()

    # ---- model ------------------------------------------------------------------------
    def _load(self) -> bool:
        if self._clf is not None:
            return True
        self.status = "loading"
        try:
            if not MODEL_PATH.exists():
                log.info("Downloading YAMNet → %s", MODEL_PATH)
                MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
                with urllib.request.urlopen(MODEL_URL, timeout=30) as r:
                    data = r.read()
                if len(data) < 1_000_000:
                    raise RuntimeError("model download incomplete")
                MODEL_PATH.write_bytes(data)
            from mediapipe.tasks import python as mp_python
            from mediapipe.tasks.python import audio as mp_audio
            opts = mp_audio.AudioClassifierOptions(
                base_options=mp_python.BaseOptions(model_asset_buffer=MODEL_PATH.read_bytes()),
                max_results=-1, running_mode=mp_audio.RunningMode.AUDIO_CLIPS)
            self._clf = mp_audio.AudioClassifier.create_from_options(opts)
            self.status = "listening"
            return True
        except Exception as e:                 # no model / no mediapipe: the rest of Lumo keeps working
            self.status, self.error = "error", str(e)
            log.warning("music AI unavailable: %s", e)
            return False

    def classify(self, pcm: np.ndarray) -> np.ndarray:
        """Mean scores of all classes for a clip of int16 PCM at 16 kHz."""
        from mediapipe.tasks.python.components.containers import audio_data as ad
        x = pcm.astype(np.float32) / 32768.0
        res = self._clf.classify(ad.AudioData.create_from_array(x, SR))
        if not self._names:
            cats = sorted(res[0].classifications[0].categories, key=lambda c: c.index)
            self._names = [c.category_name for c in cats]
        out = np.zeros(len(self._names), np.float32)
        for r in res:
            for c in r.classifications[0].categories:
                out[c.index] += c.score
        return out / max(1, len(res))

    # ---- worker ------------------------------------------------------------------------
    def _loop(self) -> None:
        while self._running:
            self._wake.wait(1.0)
            self._wake.clear()
            if not self._running:
                break
            if not self.cfg["listen"] or self.filled - self.analysed < SR or time.monotonic() - self.fed_at > 3.0:
                if time.monotonic() - self.fed_at > 3.0 and self.status == "listening":
                    self.status = "idle"
                continue
            if not self._load():
                time.sleep(20)
                continue
            self.analysed = self.filled
            self.status = "listening"
            try:
                self.step(self._last(2.0), time.monotonic())
            except Exception:
                log.exception("music AI step failed")

    def step(self, pcm: np.ndarray, now: float, scores: np.ndarray | None = None) -> None:
        """Classify one clip and update the averages, the song and the result (also used by tests)."""
        rms = float(np.sqrt(np.mean((pcm.astype(np.float32) / 32768.0) ** 2))) if len(pcm) else 0.0
        silent = rms < self.SILENCE_RMS
        if silent:
            self._silent_since = self._silent_since or now
        else:
            self._silent_since = None
        if scores is None:
            if silent:
                self._publish(now, silent=True)
                return
            scores = self.classify(pcm)
        if self._short is None or self._long is None:
            self._short, self._long = scores.copy(), scores.copy()
        self._short = self._short * 0.75 + scores * 0.25
        self._long = self._long * 0.96 + scores * 0.04
        idx = {n: i for i, n in enumerate(self._names)}
        music = float(self._short[idx["Music"]]) if "Music" in idx else 0.0
        # ---- a new song: music after a silence, or what we hear changed for good (a DJ mix)
        new_song = False
        if self._was_silent and music > 0.3:
            new_song = True
            self._was_silent = False
        elif self.song_started and now - self.song_started > 40:
            g = np.array([idx[n] for n in GENRES if n in idx])
            a, b = self._short[g], self._long[g]
            cos = float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
            if cos < 0.55:
                self._change_since = self._change_since or now
                new_song = now - self._change_since > 8.0
            else:
                self._change_since = None
        if new_song:
            self.song_seq += 1
            self.song_started = now
            self.song = {"title": None, "artist": None}
            self._long = self._short.copy()
            self._change_since = None
            self._recog_tries = 0
            self._recog_next = now + 8.0               # recognise once 8 s of the song are in the buffer
        self._publish(now, silent=False)
        if (self.cfg["recognize"] and self.cfg["audd_token"] and self.song and not self.song.get("title")
                and music > 0.4 and now >= self._recog_next and self._recog_tries < 3):
            self._recog_tries += 1
            self._recog_next = now + 25.0
            threading.Thread(target=self._recognize, args=(self._last(8.0), self.song_seq),
                             name="music-id", daemon=True).start()

    def _publish(self, now: float, silent: bool) -> None:
        if silent:
            if self._silent_since and now - self._silent_since > 2.0:
                self._was_silent = True
            self.result = {**self.result, "music": 0.0, "silent": True}
            return
        idx = {n: i for i, n in enumerate(self._names)}
        sc = lambda n, v: float(v[idx[n]]) if n in idx else 0.0          # noqa: E731
        fam: dict[str, float] = {}
        best_genre, best_g = None, 0.0
        for n, (key, family, *_l) in GENRES.items():
            s = sc(n, self._long)
            fam[family] = fam.get(family, 0.0) + s
            if s > best_g:
                best_genre, best_g = n, s
        total = sum(fam.values()) + 1e-6
        family = max(fam, key=fam.get) if fam else None
        fconf = fam.get(family, 0.0) / total if family else 0.0
        if family and fam[family] < 0.02:
            family = None
        mood_name = max(MOODS, key=lambda n: sc(n, self._long))
        mood_s = sc(mood_name, self._long)
        mood_total = sum(sc(n, self._long) for n in MOODS) + 1e-6
        instr = sorted(((sc(n, self._long), n) for n in INSTRUMENTS), reverse=True)
        song = dict(self.song) if self.song else None
        if song and song.get("family"):
            family, fconf = song["family"], 1.0
        g = GENRES.get(best_genre) if best_genre else None
        self.result = {
            "silent": False,
            "music": round(sc("Music", self._short), 2),
            "speech": round(sc("Speech", self._short), 2),
            "vocals": round(max(sc("Singing", self._short), sc("Rapping", self._short)), 2),
            "crowd": round(max(sc("Applause", self._short), sc("Cheering", self._short), sc("Crowd", self._short)), 2),
            "family": family, "family_conf": round(fconf, 2),
            "family_pl": FAMILY_NAMES[family][0] if family else None,
            "family_it": FAMILY_NAMES[family][1] if family else None,
            "genre_key": g[0] if g and best_g > 0.03 else None,
            "genre_pl": g[2] if g and best_g > 0.03 else None,
            "genre_it": g[3] if g and best_g > 0.03 else None,
            "mood": MOODS[mood_name][0] if mood_s > 0.02 else None,
            "mood_pl": MOODS[mood_name][1] if mood_s > 0.02 else None,
            "mood_it": MOODS[mood_name][2] if mood_s > 0.02 else None,
            "mood_conf": round(mood_s / mood_total, 2),
            "instruments": [{"pl": INSTRUMENTS[n][0], "it": INSTRUMENTS[n][1]} for s, n in instr[:3] if s > 0.05],
        }

    # ---- song title (AudD) ---------------------------------------------------------------
    def _recognize(self, pcm: np.ndarray, seq: int) -> None:
        self.recog_status = "asking"
        try:
            ans = self.audd(wav_bytes(pcm), self.cfg["audd_token"])
        except Exception as e:
            self.recog_status = f"error: {e}"
            log.warning("song recognition failed: %s", e)
            return
        if ans.get("status") != "success":
            err = (ans.get("error") or {}).get("error_message") or "error"
            self.recog_status = f"error: {err}"
            if "token" in err.lower() or "limit" in err.lower():
                self._recog_tries = 99                   # bad key / no requests left: stop asking for this song
            return
        res = ans.get("result")
        if not res:
            self.recog_status = "unknown"
            return
        am = res.get("apple_music") or {}
        genres = list(am.get("genreNames") or [])
        art = ((am.get("artwork") or {}).get("url") or "").replace("{w}", "300").replace("{h}", "300")
        song = {"title": res.get("title"), "artist": res.get("artist"), "album": res.get("album"),
                "year": (res.get("release_date") or "")[:4] or None,
                "genres": [g for g in genres if g.lower() != "music"][:3], "art": art or None,
                "link": res.get("song_link")}
        song["family"] = apple_family(song["genres"])
        if seq == self.song_seq:
            self.song = song
            self.recog_status = "ok"
            log.info("Now playing: %s - %s", song["artist"], song["title"])

    @staticmethod
    def audd(wav: bytes, token: str) -> dict[str, Any]:
        boundary = uuid.uuid4().hex
        body = b""
        for name, val in (("api_token", token), ("return", "apple_music")):
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{val}\r\n'.encode()
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="clip.wav"\r\n'
                 f"Content-Type: audio/wav\r\n\r\n").encode() + wav + f"\r\n--{boundary}--\r\n".encode()
        req = urllib.request.Request(AUDD_URL, data=body, method="POST", headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "Lumo/5"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode("utf-8"))

    # ---- UI / director --------------------------------------------------------------------
    def state(self) -> dict[str, Any]:
        live = time.monotonic() - self.fed_at < 3.0
        out = {**self.result} if live else {"music": 0.0, "silent": True}
        out.update(status=self.status if live or self.status in ("error", "loading") else "off",
                   error=self.error, song_seq=self.song_seq,
                   song=self.song if self.song and self.song.get("title") else None,
                   recognize=bool(self.cfg["recognize"] and self.cfg["audd_token"]),
                   has_token=bool(self.cfg["audd_token"]), recog_status=self.recog_status,
                   listen=self.cfg["listen"])
        return out


def _demo() -> None:                            # python musicai.py file.wav  → what the model hears
    import sys
    ai = MusicAI()
    with wave.open(sys.argv[1]) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, ch).mean(axis=1)
    x = np.interp(np.arange(0, len(x), sr / SR), np.arange(len(x)), x).astype(np.int16)
    ai._load()
    for i in range(0, len(x) - 2 * SR, SR):
        ai.step(x[i:i + 2 * SR], i / SR)
    print(json.dumps({**ai.result, "song_seq": ai.song_seq}, ensure_ascii=False, indent=1))
    ai.stop()


if __name__ == "__main__":
    _demo()
