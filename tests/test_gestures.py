"""Gesture behaviour: arming, relative control, rollback when the gesture changes, flip, calibration on me."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import dmx_controller as dc  # noqa: E402
import interaction as ia  # noqa: E402
from mecal import MeCalibrator  # noqa: E402


def hand(g, x=0.5, y=0.5, slot=0, **kw):
    return {"gesture": g, "palm_center": [x, y], "index_tip": [x, y - 0.1], "slot": slot, "hue": 0, "tightness": 0.5, **kw}


class Clock:
    def __init__(self):
        self.t = 100.0

    def __call__(self):
        return self.t


def rig():
    e = dc.DMXEngine()
    f = e.add_fixture(name="A", address=1, channels=["pan", "tilt", "dimmer", "shutter"], values={"dimmer": 100})
    f.snap()
    e.select(f.id)
    return e, f, ia.InteractionController(e)


def feed(c, clock, hands, dt=0.05, n=1):
    for _ in range(n):
        clock.t += dt
        with mock.patch.object(ia.time, "monotonic", clock):
            c.handle({"hands": hands}, {}, "gesture")


class TestGestures(unittest.TestCase):
    def test_arming_and_relative(self):
        e, f, c = rig()
        clk = Clock()
        feed(c, clk, [hand("dimmer", y=0.8)], n=4)          # 0.2 s: not armed yet -> nothing changes
        self.assertEqual(f.target["dimmer"], 100)
        feed(c, clk, [hand("dimmer", y=0.8)], n=4)          # armed; relative: no jump to "hand is low = dark"
        self.assertAlmostEqual(f.target["dimmer"], 100, delta=1)
        feed(c, clk, [hand("dimmer", y=0.45)], n=6)         # hand up by half the zone -> brighter
        self.assertGreater(f.target["dimmer"], 200)

    def test_rollback_when_gesture_changes(self):
        e, f, c = rig()
        clk = Clock()
        feed(c, clk, [hand("dimmer", y=0.6)], n=10)
        feed(c, clk, [hand("dimmer", y=0.6)], n=10)          # steady for a while
        steady = f.target["dimmer"]
        feed(c, clk, [hand("dimmer", y=0.9)], n=3)           # hand drops while it turns into a fist ...
        self.assertLess(f.target["dimmer"], steady - 20)
        feed(c, clk, [hand("strobe", y=0.9)], n=1)           # ... and the fist is recognised: the drop is undone
        self.assertAlmostEqual(f.target["dimmer"], steady, delta=1)

    def test_gesture_settings(self):
        e, f, c = rig()
        c.set_gesture("dimmer", on=False)
        clk = Clock()
        feed(c, clk, [hand("dimmer", y=0.2)], n=20)
        self.assertEqual(f.target["dimmer"], 100)
        c.set_gesture("dimmer", on=True, gain=2.0, target="master")
        feed(c, clk, [hand("none")], n=2)
        feed(c, clk, [hand("dimmer", y=0.6)], n=10)
        feed(c, clk, [hand("dimmer", y=0.5)], n=6)
        self.assertEqual(f.target["dimmer"], 100)            # the gesture now drives the master, not the lamp
        self.assertEqual(e.grand_master, 255)

    def test_flip(self):
        e, f, c = rig()
        e.set_position_norm(f.id, 0.9, 0.5)
        right = f.target["pan"]
        e.flip(f.id, "x")
        e.set_position_norm(f.id, 0.9, 0.5)
        self.assertGreater(right, 32768)
        self.assertTrue(f.flip_x and f.invert_pan)
        self.assertLess(f.target["pan"], 32768)

    def test_disabled_device(self):
        e, f, c = rig()
        f.target["dimmer"] = 255
        f.snap()
        e.update_fixture(f.id, enabled=False)
        e._render()
        self.assertEqual(list(e.universe[:4]), [0, 0, 0, 0])
        self.assertNotIn(f.id, e.resolve("all"))

    def test_extras_combine_effects_while_held(self):
        e, f, c = rig()

        class FX:
            def __init__(self):
                self.on = set()
                self.speed_scale = 1.0

            def start(self, kind, params=None, targets="all", duration=None, eid=None):
                self.on.add(eid)
                return eid

            def stop(self, eid):
                self.on.discard(eid)

            def state(self):
                return {"active": []}
        fx = FX()
        c.effects = fx
        c.set_gesture("strobe", target="none", extra=[{"action": "effect", "params": {"kind": "rainbow"}},
                                                        {"action": "effect", "params": {"kind": "circle"}}], extra_mode="hold")
        clk = Clock()
        feed(c, clk, [hand("strobe")], n=10)
        self.assertEqual(fx.on, {"gx-strobe-0", "gx-strobe-1"})        # two effects at once
        self.assertEqual(f.target["strobe"], 0)                         # main function switched off
        feed(c, clk, [hand("none")], n=2)
        self.assertEqual(fx.on, set())                                  # gone when the fist opens


class TestMeCal(unittest.TestCase):
    def test_thumbs_up_saves_three_spots(self):
        e, f, c = rig()
        vis = type("V", (), {"people_on": False})()
        mc = MeCalibrator(e, vis)
        c.mecal = mc
        self.assertIsNone(mc.start(spots=3))
        clk = Clock()
        person = {"people": [{"box": [0.4, 0.2, 0.2, 0.6]}]}       # no brightness reading -> falls back to thumbs
        for spot in range(3):
            for _ in range(40):                                  # stand still -> found and aimed
                clk.t += 0.05
                with mock.patch.object(ia.time, "monotonic", clk):
                    c.handle({"hands": []}, person, "gesture")
            self.assertEqual(mc.phase, "confirm")
            for _ in range(70):                                  # thumbs up 3.5 s
                clk.t += 0.05
                with mock.patch.object(ia.time, "monotonic", clk):
                    c.handle({"hands": [hand("full")]}, person, "gesture")
        self.assertFalse(mc.active)
        self.assertEqual(mc.saved, 3)
        self.assertEqual(len(f.aim_points["main"]), 1)            # same spot replaces itself (the test stands still)

    def test_thumbs_down_then_adjust(self):
        e, f, c = rig()
        mc = MeCalibrator(e, type("V", (), {"people_on": False})())
        c.mecal = mc
        mc.start()
        clk = Clock()
        person = {"people": [{"box": [0.4, 0.2, 0.2, 0.6]}]}
        for _ in range(40):
            clk.t += 0.05
            with mock.patch.object(ia.time, "monotonic", clk):
                c.handle({"hands": []}, person, "gesture")
        for _ in range(35):
            clk.t += 0.05
            with mock.patch.object(ia.time, "monotonic", clk):
                c.handle({"hands": [hand("thumbdown")]}, person, "gesture")
        self.assertEqual(mc.phase, "adjust")
        p0 = f.target["pan"]
        for x in (0.5, 0.6, 0.7):
            clk.t += 0.05
            with mock.patch.object(ia.time, "monotonic", clk):
                c.handle({"hands": [dict(hand("point"), index_tip=[x, 0.5])]}, person, "gesture")
        self.assertGreater(f.target["pan"], p0)

    def test_auto_search_finds_the_bright_spot(self):
        """The camera sees the silhouette light up only when the lamp points at the right pan / tilt."""
        e, f, c = rig()
        mc = MeCalibrator(e, type("V", (), {"people_on": False})())
        c.mecal = mc
        e2 = dc.DMXEngine()
        g = e2.add_fixture(name="B", address=1, channels=["pan", "tilt", "dimmer"])
        mc2 = None
        mc.start(spots=1)
        clk = Clock()
        e.set_position_norm(f.id, 0.5, 0.8)
        true_pan = f.target["pan"] + 0.03 * 65535                # the real hit is a bit off the guess
        true_tilt = f.target["tilt"] - 0.02 * 65535

        def lum():
            d = ((f.target["pan"] - true_pan) ** 2 + (f.target["tilt"] - true_tilt) ** 2) ** 0.5 / 65535
            lit = f.target["dimmer"] > 100
            return {"person": 60 + (40 * max(0.0, 1 - d / 0.05) if lit else 0), "frame": 50}
        for _ in range(900):
            clk.t += 0.05
            for fx in e.fixtures.values():
                fx.snap()                                       # motors arrive at once in the test
            tr = {"people": [{"box": [0.4, 0.2, 0.2, 0.6]}], "lum": lum()}
            with mock.patch.object(ia.time, "monotonic", clk), mock.patch("mecal.time.monotonic", clk):
                c.handle({"hands": []}, tr, "gesture")
            if not mc.active:
                break
        self.assertFalse(mc.active)
        self.assertEqual(mc.saved, 1)
        p = f.aim_points["main"][0]
        self.assertLess(abs(p[2] - true_pan) / 65535, 0.02)
        self.assertLess(abs(p[3] - true_tilt) / 65535, 0.02)
        self.assertIsNone(mc2)
        del g

    def test_lasers_never_calibrated_on_people(self):
        e = dc.DMXEngine()
        e.add_fixture(name="L", address=1, type="laser", channels=["laser_r", "pan", "tilt"])
        mc = MeCalibrator(e, type("V", (), {"people_on": False})())
        self.assertEqual(mc.start(), "nolamps")


if __name__ == "__main__":
    unittest.main(verbosity=2)
