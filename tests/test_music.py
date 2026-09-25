"""Music: white-only autopilot, flash on every beat, lasers pulse on the beat in fast parts (only when armed)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import dmx_controller as dc  # noqa: E402
import effects as fxm  # noqa: E402


def rig():
    e = dc.DMXEngine()
    lamp = e.add_fixture(name="Spot", address=1, channels=["pan", "tilt", "dimmer", "red", "green", "blue"])
    laser = e.add_fixture(name="Laser", address=10, type="laser", channels=["laser_r", "laser_g"])
    fx = fxm.EffectEngine(e)
    return e, lamp, laser, fx


class TestMusic(unittest.TestCase):
    def test_white_only_hits(self):
        e, lamp, laser, fx = rig()
        fx.palette = [[255, 0, 0], [0, 0, 255]]
        fx.set_autopilot(on=True, mood="hits", white=True)
        fx.bpm = 120
        fx.apply()
        self.assertEqual((lamp.target["red"], lamp.target["green"], lamp.target["blue"]), (255, 255, 255))

    def test_beat_flash_goes_dark_between_beats(self):
        e, lamp, laser, fx = rig()
        fx.bpm = 120                                       # 0.5 s per beat
        fx.start("beat", {}, "all", None, "b")
        t0 = fx.effects["b"].t0
        with mock.patch("effects.time.monotonic", lambda: t0 + 0.001):
            fx.apply()
        self.assertGreater(lamp.target["dimmer"], 240)     # on the beat: full
        with mock.patch("effects.time.monotonic", lambda: t0 + 0.45):
            fx.apply()
        self.assertLess(lamp.target["dimmer"], 10)         # just before the next beat: dark

    def test_lasers_only_when_armed_and_fast(self):
        e, lamp, laser, fx = rig()
        fx.set_autopilot(on=True, mood="rave")
        fx.beat(1.0, False, 150)                           # fast, but lasers are not armed
        self.assertNotIn("ap-laser", fx.effects)
        e.lasers_enabled = True
        fx.beat(0.5, False, 100)                           # armed, but slow and soft
        self.assertNotIn("ap-laser", fx.effects)
        fx.beat(1.0, False, 150)                           # armed + fast -> lasers pulse on the beat
        self.assertIn("ap-laser", fx.effects)
        self.assertEqual(list(fx.effects["ap-laser"].base), [laser.id])   # the lamp is never touched
        t0 = fx.effects["ap-laser"].t0
        with mock.patch("effects.time.monotonic", lambda: t0 + 0.01):
            fx.apply()
        e._render()
        self.assertEqual(e.universe[9], 255)
        e.lasers_enabled = False
        e._render()
        self.assertEqual(e.universe[9], 0)                 # the safety gate still wins

    def test_blackout_darkens_everything(self):
        e, lamp, laser, fx = rig()
        par = e.add_fixture(name="PAR", address=20, type="par", channels=["red", "green", "blue", "macro"])
        par.target.update(red=255, green=128, blue=0, macro=200)
        par.snap()
        lamp.target.update(dimmer=255, pan=40000)
        lamp.snap()
        e.lasers_enabled = True
        e.blackout = True
        e._render()
        self.assertEqual(list(e.universe[19:23]), [0, 0, 0, 0])        # PAR without a dimmer: dark too
        self.assertEqual(e.universe[2], 0)                               # lamp dimmer
        self.assertEqual(e.universe[9], 0)                               # laser
        self.assertEqual(e.universe[0], 40000 >> 8)                      # the head keeps its position
        e.blackout = False
        e.grand_master = 128
        e._render()
        self.assertEqual(e.universe[19], 128)                            # master dims colour-only lamps

    def test_auto_style_follows_the_music(self):
        e, lamp, laser, fx = rig()
        fx.set_autopilot(on=True, mood="auto")
        for _ in range(40):
            fx.beat(0.15, False, 90)
        self.assertEqual(fx._cur_mood(), "calm")
        for _ in range(40):
            fx.beat(0.95, False, 145)
        self.assertIn(fx._cur_mood(), ("rave", "hits"))
        self.assertGreaterEqual(len(set(fx._recent)), 4)                  # variety: not the same thing over and over


class TestSpotlight(unittest.TestCase):
    def test_manual_place(self):
        import spotlight
        e, lamp, laser, fx = rig()
        sp = spotlight.Spotlight(e, None, None, None)
        sp.stop()
        sp.place([0.8, 0.9])
        sp.set(True)
        sp.tick()
        pan, tilt = e.direct_pt(lamp, 0.8, 0.9)
        self.assertAlmostEqual(lamp.target["pan"], pan, delta=1)
        self.assertEqual(lamp.target["dimmer"], 255)
        self.assertEqual(sp.source, "manual")


if __name__ == "__main__":
    unittest.main(verbosity=2)
