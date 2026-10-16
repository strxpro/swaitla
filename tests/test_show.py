"""Live show: beat clock, beat-locked effects, morphs, the AI director and the music AI."""

from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path
from unittest import mock

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import dmx_controller as dc  # noqa: E402
import effects as fxm  # noqa: E402
import musicai  # noqa: E402
from rhythm import RhythmClock  # noqa: E402


class Clock:
    """One fake monotonic time for effects, rhythm and director."""
    def __init__(self, t: float = 1000.0) -> None:
        self.t = t

    def __enter__(self):
        self.p = [mock.patch("effects.time.monotonic", lambda: self.t), mock.patch("rhythm.time.monotonic", lambda: self.t)]
        for p in self.p:
            p.start()
        return self

    def __exit__(self, *a):
        for p in self.p:
            p.stop()


def rig(n: int = 4):
    e = dc.DMXEngine()
    lamps = [e.add_fixture(name=f"L{i}", channels=["pan", "tilt", "dimmer", "red", "green", "blue"], pos=[i - n / 2, 5, -2])
             for i in range(n)]
    return e, lamps, fxm.EffectEngine(e)


class TestRhythmClock(unittest.TestCase):
    def test_beats_fire_on_time_and_ahead_by_the_offset(self):
        c = RhythmClock()
        c.offset = 0.04
        c.update(120, 0.3, 0, 1.0, now=10.0)              # audio beat at 10.30 → light at 10.26
        fired = []
        t = 10.0
        while t < 12.0:
            for b in c.tick(t):
                fired.append((round(t, 2), b))
            t += 0.01
        times = [f[0] for f in fired]
        self.assertAlmostEqual(times[0], 10.26, delta=0.011)
        self.assertTrue(all(abs((b - a) - 0.5) < 0.011 for a, b in zip(times, times[1:])))
        self.assertEqual([f[1][1] for f in fired[:4]], [0, 1, 2, 3])          # bar position from the tracker

    def test_small_drift_is_slewed_never_double_fired(self):
        c = RhythmClock()
        c.offset = 0.0
        c.update(120, 0.25, None, 1.0, now=0.0)
        beats, t = [], 0.0
        while t < 6.0:
            if abs((t * 100) % 25) < 1e-6:                  # 4 reports a second, the music is a hair slower
                nxt = 0.25 + 0.5 * math.ceil((t - 0.25) / 0.5004) * 1.0008 - t
                c.update(119.9, max(0.0, nxt), None, 1.0, now=t)
            beats += [b for b, _ in c.tick(t)]
            t = round(t + 0.01, 2)
        self.assertEqual(beats, list(range(beats[0], beats[0] + len(beats))))   # every beat once, in order
        self.assertGreaterEqual(len(beats), 11)

    def test_lets_go_after_the_hold_time(self):
        c = RhythmClock()
        c.update(128, 0.1, None, 1.0, now=0.0)
        self.assertTrue(c.alive(1.0))
        self.assertFalse(c.alive(0.0 + RhythmClock.HOLD_BEATS * 60 / 128 + 0.1))
        self.assertEqual(c.tick(100.0), [])


class TestBeatLockedEffects(unittest.TestCase):
    def test_effects_share_the_bar_line(self):
        e, lamps, fx = rig(1)
        with Clock() as ck:
            fx.grid(120, 0.5, 0, 1.0)
            ck.t += 0.6
            fx.start("color_morph", {"beats": 4, "colors": [[255, 0, 0], [0, 0, 255]], "hold": 0.0}, "all", None, "a")
            fx.apply()
            pos = fx._bpos
            self.assertIsNotNone(pos)
            # the cycle comes from the clock, not from when the effect started
            ck.t += 0.0
            fx.start("sweep", {"beats": 4, "size": 30}, "all", None, "b")
            fx.apply()
            self.assertAlmostEqual(fx._bpos, pos, places=6)

    def test_beat_flash_is_on_the_grid(self):
        e, lamps, fx = rig(1)
        with Clock() as ck:
            fx.clock.offset = 0.0
            fx.grid(120, 0.2, 0, 1.0)                        # beats at 1000.2, 1000.7, ...
            fx.start("beat", {"floor": 0.0, "curve": 3}, "all", None, "b")
            ck.t = 1000.21
            fx.apply()
            self.assertGreater(lamps[0].target["dimmer"], 200)
            ck.t = 1000.65
            fx.apply()
            self.assertLess(lamps[0].target["dimmer"], 20)

    def test_clock_beats_drive_the_reactions(self):
        e, lamps, fx = rig(1)
        fx.reactions["color_step"] = True
        fx.palette = [[255, 0, 0], [0, 255, 0], [0, 0, 255]]
        with Clock() as ck:
            fx.clock.offset = 0.0
            fx.grid(120, 0.05, 0, 1.0)
            seen = set()
            for _ in range(200):
                ck.t += 0.01
                fx.apply()
                seen.add((round(lamps[0].target["red"]), round(lamps[0].target["green"]), round(lamps[0].target["blue"])))
            self.assertGreaterEqual(len({c for c in seen if c in {(255, 0, 0), (0, 255, 0), (0, 0, 255)}}), 3)


class TestMorph(unittest.TestCase):
    def test_a_movement_melts_into_the_next(self):
        e, lamps, fx = rig(1)
        lamp = lamps[0]
        with Clock() as ck:
            fx.start("circle", {"speed": 0.0, "size": 40}, "all", None, "ap-move")
            fx.effects["ap-move"].t0 = ck.t
            fx.apply()
            pan_a = lamp.target["pan"]
            fx.start("tilt_wave", {"speed": 0.0, "size": 40, "morph": 1.0}, "all", None, "ap-move")
            fx.effects["ap-move"].t0 = ck.t
            self.assertTrue(any("~" in k for k in fx.effects))           # the old one keeps playing underneath
            ck.t += 0.5
            fx.apply()
            mid = lamp.target["pan"]
            ck.t += 0.6
            fx.apply()
            self.assertFalse(any("~" in k for k in fx.effects))
            end = lamp.target["pan"]
        self.assertNotAlmostEqual(pan_a, end, delta=1)
        self.assertTrue(min(pan_a, end) < mid < max(pan_a, end))

    def test_replacing_keeps_the_original_base(self):
        e, lamps, fx = rig(1)
        lamp = lamps[0]
        lamp.target["pan"] = 30000.0
        fx.start("sweep", {"speed": 0.25, "size": 40}, "all", None, "m")
        fx.effects["m"].t0 -= 1.0                                         # a quarter cycle in: far from the base
        fx.apply()
        fx.start("circle", {"speed": 0.0, "size": 0}, "all", None, "m")
        fx.apply()
        self.assertAlmostEqual(lamp.target["pan"], 30000.0, delta=1)      # no drift to where the old one was

    def test_colours_morph_through_oklab(self):
        r, g, b = fxm.mix_ok([255, 0, 0], [0, 0, 255], 0.5)
        self.assertGreater(r, 100)
        self.assertGreater(b, 100)
        self.assertEqual(tuple(round(v) for v in fxm.mix_ok([10, 20, 30], [200, 100, 50], 0.0)), (10, 20, 30))

    def test_show_home_is_the_centre_of_the_show(self):
        e, lamps, fx = rig(1)
        lamps[0].show_home = [20000.0, 40000.0]
        lamps[0].target.update(pan=0.0, tilt=0.0)
        fx.start("circle", {"speed": 0.0, "size": 0, "home": True}, "all", None, "ap-move")
        fx.apply()
        self.assertAlmostEqual(lamps[0].target["pan"], 20000.0, delta=1)
        self.assertAlmostEqual(lamps[0].target["tilt"], 40000.0, delta=1)


class TestSoloSpot(unittest.TestCase):
    def test_held_lamps_stay_while_the_show_plays_on_the_rest(self):
        e, lamps, fx = rig(2)
        solo, other = lamps
        fx.set_autopilot(on=True, mood="ai")
        e.set_params(solo.id, {"red": 255, "green": 40, "blue": 160, "pan": 12000.0})
        for grp in ("move", "color"):
            e.hold(solo.id, grp, 3600)
        self.assertEqual(e.held_long(), [solo.id])
        for _ in range(20):
            fx.apply()
        self.assertEqual((solo.target["red"], solo.target["blue"], solo.target["pan"]), (255, 160, 12000.0))
        e.release(solo.id)
        self.assertEqual(e.held_long(), [])
        fx.director.phrase(force=True)
        fx.apply()
        self.assertNotEqual((solo.target["red"], solo.target["green"], solo.target["blue"]), (255, 40, 160))

    def test_solo_movement_circles_around_the_person_while_the_show_runs(self):
        e, lamps, fx = rig(2)
        solo, other = lamps
        fx.set_autopilot(on=True, mood="ai")
        solo.target.update(pan=20000.0, tilt=30000.0)
        e.hold(solo.id, "move", 3600)
        fx.start("circle", {"speed": 0.5, "size": 6, "solo": True}, [solo.id], None, f"solo-move-{solo.id}")
        self.assertIn("ap-move", fx.effects)                      # the show keeps its movement for the others
        pans = set()
        t0 = fx.effects[f"solo-move-{solo.id}"].t0
        for k in range(8):
            with mock.patch("effects.time.monotonic", lambda: t0 + k * 0.25):
                fx.apply()
            pans.add(round(solo.target["pan"]))
            self.assertLess(abs(solo.target["pan"] - 20000.0), 6 / solo.pan_deg * 65535 + 1)   # stays around him
        self.assertGreater(len(pans), 3)
        fx.stop_solo([solo.id])
        self.assertNotIn(f"solo-move-{solo.id}", fx.effects)
        self.assertIn("ap-move", fx.effects)

    def test_scene_on_top_of_the_show(self):
        e, lamps, fx = rig(2)
        e.set_params("all", {"red": 10, "green": 20, "blue": 30, "dimmer": 99})
        look = e.look_capture([lamps[0].id])
        e.set_params("all", {"red": 0, "green": 0, "blue": 0})
        e.look_recall(look, 0.0, hold=600)
        self.assertEqual(e.held_long(), [lamps[0].id])
        self.assertEqual(lamps[0].target["red"], 10.0)
        self.assertEqual(lamps[1].target["red"], 0.0)


class TestPickedEffects(unittest.TestCase):
    """Pokaz → Efekty: an effect on chosen lamps plays on top of the show; scenes keep the effects."""

    def test_picked_effect_takes_only_its_layer_from_the_show(self):
        e, lamps, fx = rig(3)
        a, b, c = lamps
        fx.set_autopilot(on=True, mood="ai")
        eid = fx.start_mine("rainbow", {"beats": 8}, [a.id, b.id])
        self.assertTrue(eid.startswith("my-"))
        self.assertTrue(e.is_held(a.id, "color") and not e.is_held(a.id, "move"))   # the show keeps moving it
        self.assertFalse(e.is_held(c.id, "color"))                                  # c stays in the show
        self.assertIn("ap-color", fx.effects)
        eid2 = fx.start_mine("static_color", {"color_a": [255, 0, 120]}, [a.id, b.id])  # same layer, same lamps
        self.assertNotIn(eid, fx.effects)
        self.assertIn(eid2, fx.effects)
        fx.apply()
        self.assertEqual((a.target["red"], a.target["green"], a.target["blue"]), (255, 0, 120))
        fx.start_mine("circle", {"size": 20}, [a.id])                              # another layer: both play
        self.assertEqual(len(fx.mine()), 2)
        fx.stop_mine(eid2)
        self.assertFalse(e.is_held(a.id, "color"))                                  # colour back to the show
        self.assertTrue(e.is_held(a.id, "move"))
        fx.stop_mine()
        self.assertEqual(fx.mine(), [])
        self.assertFalse(e.is_held(a.id, "move"))

    def test_scene_recipe_restarts_the_effects(self):
        e, lamps, fx = rig(2)
        fx.start_mine("wave", {"beats": 2}, [lamps[0].id, lamps[1].id])
        fx.start_mine("static_color", {"color_a": [0, 0, 255]}, [lamps[1].id])
        specs = fx.mine_specs()
        self.assertEqual(sorted(s["kind"] for s in specs), ["static_color", "wave"])
        self.assertNotIn("solo", specs[0]["params"])
        only_first = fx.mine_specs([lamps[0].id])                                    # a scene of one lamp
        self.assertEqual([(x["kind"], x["ids"]) for x in only_first], [("wave", [lamps[0].id])])
        fx.stop_mine()
        for sp in specs:                                                              # what recall_look does
            fx.start_mine(sp["kind"], sp["params"], sp["ids"])
        self.assertEqual(sorted(x.kind for x in fx.mine()), ["static_color", "wave"])


class TestAimFix(unittest.TestCase):
    """Reflektor ręczny → Popraw celowanie: arrows put the beam on the spot, the correction is kept."""

    def test_correction_is_used_near_the_spot_and_softly_far_away(self):
        e = dc.DMXEngine()
        f = e.add_fixture(name="Head", channels=["pan", "pan_fine", "tilt", "tilt_fine", "dimmer"], pos=[2.0, 3.0, -2.0], mount="hang")
        spot = [0.0, 0.0, 1.0]
        e.aim(f.id, spot)
        model_pan, model_tilt = f.target["pan"], f.target["tilt"]
        e.aim(f.id, [0.3, 0.0, 1.0])                       # the arrows: the beam needed 30 cm more to the right
        real_pan, real_tilt = f.target["pan"], f.target["tilt"]
        self.assertEqual(e.aim_fix(f.id, spot), 1)
        e.aim(f.id, spot)                                  # next time the same spot is aimed: the corrected beam
        self.assertAlmostEqual(f.target["pan"], real_pan, delta=2)
        self.assertAlmostEqual(f.target["tilt"], real_tilt, delta=2)
        self.assertNotAlmostEqual(f.target["pan"], model_pan, delta=20)
        self.assertEqual(dc.Fixture.from_config(f.to_config()).aim_points["floor"][0][:2], [0.0, 1.0])   # saved
        self.assertNotIn("floor", f.to_state()["aim_err"])
        e.aim_fix(f.id, spot)                              # the same spot again: replaced, not added
        self.assertEqual(len(f.aim_points["floor"]), 1)
        e.aim_point_clear(f.id, "floor")
        e.aim(f.id, spot)
        self.assertAlmostEqual(f.target["pan"], model_pan, delta=2)


class TestDirector(unittest.TestCase):
    def run_beats(self, fx, ck, beats, bpm=128):
        period = 60.0 / bpm
        for i in range(int(beats * period / 0.02)):
            ck.t += 0.02
            if i % 12 == 0:
                fx.grid(bpm, period - ((ck.t - 1000.0) % period), None, 1.0)
            fx.audio(0.8)
            fx.apply()

    def test_looks_change_by_phrase_and_never_go_dark(self):
        e, lamps, fx = rig()
        with Clock() as ck:
            fx.set_autopilot(on=True, mood="ai")
            seen = set()
            for _ in range(8):
                self.run_beats(fx, ck, 16)
                seen.add(fx.director.look["id"])
                self.assertTrue(any(k in fx.effects for k in ("ap-dim", "ap-hit")))
        self.assertGreaterEqual(len(seen), 3)

    def test_build_and_drop(self):
        e, lamps, fx = rig()
        with Clock() as ck:
            fx.set_autopilot(on=True, mood="ai")
            fx.director.cfg["flavor"] = "club"
            self.run_beats(fx, ck, 8)
            fx.set_section("build", 0.6)
            self.assertEqual(fx.director.look["id"], "build")
            self.assertEqual(fx.effects["ap-dim"].kind, "riser")
            self.run_beats(fx, ck, 8)
            fx.set_section("drop", 1.0)
            self.assertEqual(fx.effects["ap-acc"].kind, "blinder")          # right on the drop, not a beat later
            self.assertIn("ap-drop", fx.effects)                              # club: strobe burst
            self.assertNotEqual(fx.director.look["id"], "build")
            self.assertEqual(fx.director.reason, "drop")

    def test_the_music_picks_the_flavour_and_colours(self):
        e, lamps, fx = rig()
        info = {"music": 0.9, "family": "cinematic", "mood": "sad", "mood_conf": 0.6}
        fx.director.ai = lambda: info
        with Clock():
            fx.set_autopilot(on=True, mood="ai")
        self.assertEqual(fx.director.flavor_now, "cinema")
        self.assertEqual(fx.director.palette_name, "sad")
        fx.director.cfg["ai_colors"] = False
        fx.palette = [[1, 2, 3], [4, 5, 6]]
        with Clock():
            fx.director.phrase(force=True)
        self.assertEqual(fx.director.palette, [[1, 2, 3], [4, 5, 6]])

    def test_strobe_stays_off_for_film_music(self):
        e, lamps, fx = rig()
        with Clock():
            fx.set_autopilot(on=True, mood="ai")
            fx.director.cfg["flavor"] = "cinema"
            fx.director.phrase(force=True)
            fx.set_section("drop", 1.0)
        self.assertNotIn("ap-drop", fx.effects)
        self.assertIn("ap-acc", fx.effects)


class TestMusicAI(unittest.TestCase):
    def setUp(self):
        self.ai = musicai.MusicAI.__new__(musicai.MusicAI)        # no worker thread, no model
        musicai.MusicAI.__init__.__wrapped__ if False else None
        import threading
        self.ai.lock = threading.Lock()
        self.ai.cfg = {"listen": True, "recognize": False, "audd_token": ""}
        self.ai._names = ["Music", "Speech", "Singing", "Techno", "House music", "Classical music", "Sad music", "Happy music", "Applause"]
        for k, v in dict(_short=None, _long=None, song_seq=0, song=None, song_started=0.0, _silent_since=None, _was_silent=True,
                         _change_since=None, _recog_tries=0, _recog_next=0.0, recog_status="", result={}).items():
            setattr(self.ai, k, v)

    def vec(self, **s):
        v = np.zeros(len(self.ai._names), np.float32)
        for k, val in s.items():
            v[self.ai._names.index(k.replace("_", " ").replace("music", "music") if k != "House" else "House music")] = val
        return v

    def scores(self, music=0.9, techno=0.0, classical=0.0, sad=0.0, singing=0.0):
        v = np.zeros(len(self.ai._names), np.float32)
        n = self.ai._names
        v[n.index("Music")] = music
        v[n.index("Techno")] = techno
        v[n.index("Classical music")] = classical
        v[n.index("Sad music")] = sad
        v[n.index("Singing")] = singing
        return v

    def test_genre_mood_and_new_song(self):
        loud = (np.ones(32000) * 3000).astype(np.int16)
        for i in range(10):
            self.ai.step(loud, float(i), self.scores(techno=0.4, singing=0.6))
        r = self.ai.result
        self.assertEqual(r["family"], "electronic")
        self.assertEqual(r["genre_key"], "techno")
        self.assertGreater(r["vocals"], 0.4)
        self.assertEqual(self.ai.song_seq, 1)
        quiet = np.zeros(32000, np.int16)
        for i in range(10, 14):                                  # 4 s of silence, then a sad film score
            self.ai.step(quiet, float(i))
        for i in range(14, 60):
            self.ai.step(loud, float(i), self.scores(classical=0.5, sad=0.4))
        self.assertEqual(self.ai.song_seq, 2)
        self.assertEqual(self.ai.result["family"], "cinematic")
        self.assertEqual(self.ai.result["mood"], "sad")

    def test_song_title_from_audd(self):
        self.ai.song_seq = 3
        self.ai.song = {"title": None}
        ans = {"status": "success", "result": {"artist": "Daft Punk", "title": "One More Time", "album": "Discovery",
                                               "release_date": "2000-11-13", "song_link": "https://lis.tn/x",
                                               "apple_music": {"genreNames": ["Dance", "Music", "Electronic"],
                                                               "artwork": {"url": "https://a/{w}x{h}bb.jpg"}}}}
        with mock.patch.object(musicai.MusicAI, "audd", staticmethod(lambda wav, tok: ans)):
            self.ai.cfg["audd_token"] = "x"
            self.ai._recognize(np.zeros(16000, np.int16), 3)
        self.assertEqual(self.ai.song["title"], "One More Time")
        self.assertEqual(self.ai.song["family"], "electronic")
        self.assertEqual(self.ai.song["year"], "2000")
        self.assertEqual(self.ai.song["art"], "https://a/300x300bb.jpg")
        self.assertEqual(self.ai.song["genres"], ["Dance", "Electronic"])

    def test_bad_key_stops_asking(self):
        self.ai.song_seq = 1
        self.ai.song = {"title": None}
        ans = {"status": "error", "error": {"error_code": 900, "error_message": "Wrong API token"}}
        with mock.patch.object(musicai.MusicAI, "audd", staticmethod(lambda wav, tok: ans)):
            self.ai._recognize(np.zeros(16000, np.int16), 1)
        self.assertEqual(self.ai._recog_tries, 99)
        self.assertIn("token", self.ai.recog_status)

    def test_wav_is_16k_mono(self):
        import io
        import wave
        data = musicai.wav_bytes(np.zeros(16000, np.int16))
        with wave.open(io.BytesIO(data)) as w:
            self.assertEqual((w.getnchannels(), w.getframerate(), w.getnframes()), (1, 16000, 16000))


if __name__ == "__main__":
    unittest.main()
