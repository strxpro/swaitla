"""Regression checks for live input loss, tempo, groups and expanding a rig."""
import unittest
from unittest.mock import patch

from test_music import rig
from interaction import InteractionController


class LiveShowTests(unittest.TestCase):
    def test_rgb_fixture_without_dimmer_obeys_intensity(self):
        e, _, _, fx = rig()
        par = e.add_fixture(channels=['red', 'green', 'blue'], type='par')
        par.target.update(red=255, green=100, blue=50, dimmer=0)
        par.snap()
        e._render()
        start = par.address - 1
        self.assertEqual(list(e.universe[start:start + 3]), [0, 0, 0])
        par.target['dimmer'] = 128
        par.snap()
        e._render()
        self.assertEqual(list(e.universe[start:start + 3]), [128, 50, 25])

    def test_silence_and_connection_loss_fade_and_recover(self):
        e, lamp, _, fx = rig()
        with patch('effects.time.monotonic', return_value=100.0) as clock:
            fx._audio_tick = 100.0
            fx.set_autopilot(on=True, mood='auto')
            fx.audio(1)
            for i in range(1, 81):
                clock.return_value = 100 + i * 0.05
                fx.apply()
            self.assertLess(lamp.target['dimmer'], 5)
            self.assertFalse(fx.state()['autopilot']['signal'])
            for i in range(81, 101):
                clock.return_value = 100 + i * 0.05
                fx.audio(1)
                fx.apply()
            self.assertGreater(lamp.target['dimmer'], 70)
            self.assertTrue(fx.state()['autopilot']['signal'])

    def test_quiet_section_changes_style_without_beats(self):
        e, lamp, _, fx = rig()
        fx.set_autopilot(on=True, mood='auto')
        for _ in range(40):
            fx.beat(1, False, 150)
        start = fx._audio_tick
        with patch('effects.time.monotonic') as clock:
            for i in range(1, 101):
                clock.return_value = start + i * 0.05
                fx.audio(0)
                fx.apply()
        self.assertEqual(fx._cur_mood(), 'calm')
        self.assertNotIn('ap-hit', fx.effects)
        self.assertLess(lamp.target['dimmer'], 5)

    def test_new_light_joins_and_center_order_works(self):
        e, lamp, _, fx = rig()
        fx.start('static_color', {'color_a': [25, 75, 125], 'order': 'center'})
        other = e.add_fixture(channels=['dimmer', 'red', 'green', 'blue'])
        fx.apply()
        self.assertEqual(other.target['blue'], 125)

    def test_tempo_change_preserves_movement_phase(self):
        e, lamp, _, fx = rig()
        fx.bpm = 120
        fx.start('circle', {'beats': 8}, eid='ap-move')
        eff = fx.effects['ap-move']
        with patch('effects.time.monotonic', return_value=eff.t0 + 9):
            fx.apply()
            before = lamp.target['pan']
            fx.bpm = 170
            fx.apply()
            self.assertEqual(before, lamp.target['pan'])

    def test_alternating_lamps(self):
        e, lamp, _, fx = rig()
        other = e.add_fixture(channels=['dimmer'])
        fx.set_autopilot(on=True, mood='dance')
        fx.beat(1, False, 120)
        eff = fx.effects['ap-hit']
        with patch('effects.time.monotonic', return_value=eff.t0 + 0.001):
            fx.apply()
        self.assertGreater(abs(other.target['dimmer'] - lamp.target['dimmer']), 150)

    def test_selected_gestures_exclude_lasers_disabled_and_empty(self):
        e, lamp, laser, fx = rig()
        disabled = e.add_fixture(enabled=False)
        controller = InteractionController(e)
        controller.scope = 'sel'
        e.selection = [lamp.id, laser.id, disabled.id]
        self.assertEqual(controller._targets(), [lamp.id])
        e.selection = []
        self.assertEqual(controller._targets(), [])

    def test_auto_address_fits_holes_and_rejects_full_universe(self):
        e, lamp, _, fx = rig()
        extra = e.add_fixture(channels=['dimmer', 'red', 'green'])
        self.assertEqual(extra.address, 7)
        e.fixtures.clear()
        e.add_fixture(address=1, channels=['dimmer'] * 512)
        with self.assertRaises(ValueError):
            e.add_fixture(channels=['dimmer'])
        self.assertEqual(len(e.fixtures), 1)

    def test_manual_dimmer_not_attenuated_by_live_silence(self):
        e, lamp, _, fx = rig()
        fx.audio(0)
        fx.audio_gain = 0
        fx.start('static_color', {'color_a': [255, 0, 0]})
        lamp.target['dimmer'] = 173
        fx.apply()
        self.assertEqual(lamp.target['dimmer'], 173)


if __name__ == '__main__':
    unittest.main()
