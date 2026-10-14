from hermes_paths import hermes_path
import importlib.util
import unittest
from pathlib import Path

P = Path(hermes_path('/opt/hermes-hhikr/workspace/phone-control/policy.py'))

class PhonePolicyTests(unittest.TestCase):
    def load(self):
        self.assertTrue(P.exists(), 'phone policy evaluator missing')
        spec = importlib.util.spec_from_file_location('phone_policy', P)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        return m

    def test_confirmed_failure_reduces_only_next_day_and_does_not_stack(self):
        m = self.load()
        rows = [{'date':'2026-10-13','status':'failed','reason':'unexcused_incomplete'},
                {'date':'2026-10-13','status':'failed','reason':'unexcused_incomplete'}]
        self.assertEqual(40, m.evaluate('2026-10-14', rows)['daily_limit_minutes'])
        self.assertEqual(80, m.evaluate('2026-10-15', rows)['daily_limit_minutes'])
        self.assertEqual(80, m.evaluate('2026-10-13', rows)['daily_limit_minutes'])

    def test_unknown_medical_and_delivery_failures_do_not_trigger_penalty(self):
        m = self.load()
        for status, reason in [('pending',None),('awaiting_confirmation',None),('failed','delivery_failure'),
                               ('failed','illness'),('excused','approved_leave')]:
            self.assertEqual(80, m.evaluate('2026-10-14',[{'date':'2026-10-13','status':status,'reason':reason}])['daily_limit_minutes'])

    def test_background_audio_is_allowed_without_counting_screen_quota(self):
        m = self.load()
        self.assertTrue(hasattr(m, 'access_decision'), 'foreground-only restriction is missing')
        result = m.access_decision('2026-10-14T00:15:00+08:00', 99999,
                                   screen_interactive=False, unlocked=False, bilibili_visible=False)
        self.assertTrue(result['allow_background_audio'])
        self.assertFalse(result['count_screen_time'])
        self.assertFalse(result['block_visible_ui'])
        self.assertFalse(result['force_stop_app'])

    def test_visible_video_is_blocked_at_night_but_audio_is_not_force_stopped(self):
        m = self.load()
        self.assertTrue(hasattr(m, 'access_decision'), 'foreground-only restriction is missing')
        result = m.access_decision('2026-10-14T00:15:00+08:00', 0,
                                   screen_interactive=True, unlocked=True, bilibili_visible=True)
        self.assertTrue(result['block_visible_ui'])
        self.assertFalse(result['force_stop_app'])

    def test_without_verified_device_it_never_claims_enforcement(self):
        m = self.load()
        rule = m.evaluate('2026-10-14',[])
        self.assertEqual('awaiting_device_setup_and_verification', rule['enforcement_status'])
        self.assertEqual(['bilibili'],rule['restricted_apps'])

if __name__ == '__main__':
    unittest.main()
