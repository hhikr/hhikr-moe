from hermes_paths import hermes_path
import importlib.util
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

class ReminderTests(unittest.TestCase):
    def test_morning_uses_prescribed_walk_without_inventing_progress(self):
        path = Path(hermes_path('/opt/hermes-hhikr/state/scripts/activity_morning.py'))
        self.assertTrue(path.exists(), 'morning reminder implementation is missing')
        spec = importlib.util.spec_from_file_location('activity_morning', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        state = {
            'program_status': 'trial',
            'next_plan': {'kind': 'walk', 'valid_on': '2026-10-13', 'minutes': 5, 'effort_max': 2, 'reason': '尚无训练记录'},
            'records': [], 'leaves': [], 'consequences': {'enabled': False},
        }
        result = module.render(state, datetime(2026, 10, 13, 8, tzinfo=ZoneInfo('Asia/Taipei')))
        self.assertIn('5 分钟', result)
        self.assertIn('尚无训练记录', result)
        self.assertNotIn('惩罚', result)
        self.assertIn('22:59', result)

    def test_tonight_has_no_past_evening_deadline(self):
        path = Path(hermes_path('/opt/hermes-hhikr/state/scripts/activity_morning.py'))
        spec = importlib.util.spec_from_file_location('activity_morning', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        state = {'next_plan': {'kind': 'walk', 'valid_on': '2026-10-12', 'minutes': 5, 'effort_max': 2,
                              'reason': '首次试行',
                              'feedback_instructions': '今晚走完后反馈即可；当天截止 22:59，不为任务推迟睡眠。'}}
        result = module.render(state, datetime(2026, 10, 12, 22, tzinfo=ZoneInfo('Asia/Taipei')))
        self.assertIn('今晚走完后反馈即可', result)
        self.assertNotIn('20 点回报', result)

    def test_morning_does_not_prescribe_when_plan_ineligible(self):
        import copy
        path = Path(hermes_path('/opt/hermes-hhikr/state/scripts/activity_morning.py'))
        spec = importlib.util.spec_from_file_location('activity_morning', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        now = datetime(2026, 10, 13, 8, tzinfo=ZoneInfo('Asia/Taipei'))
        base = {'timezone': 'Asia/Taipei', 'start_date': '2026-10-12',
                'program_status': 'active', 'leaves': [],
                'next_plan': {'kind': 'walk', 'valid_on': '2026-10-13',
                              'minutes': 5, 'effort_max': 2, 'reason': '轻松试行'}}
        cases = [
            ('before_start', {'start_date': '2026-10-14'}),
            ('stopped', {'program_status': 'stopped'}),
            ('medical', {'program_status': 'medical_hold'}),
            ('no_plan', {'next_plan': None}),
            ('expired', {'next_plan': dict(base['next_plan'], valid_on='2026-10-12')}),
            ('future', {'next_plan': dict(base['next_plan'], valid_on='2026-10-14')}),
            ('leave', {'leaves': [{'date': '2026-10-13', 'status': 'approved', 'reason': '生病'}]}),
            ('recovery', {'next_plan': {'kind': 'recovery', 'valid_on': '2026-10-13', 'reason': '等待恢复反馈'}}),
        ]
        for name, change in cases:
            with self.subTest(name=name):
                state = copy.deepcopy(base)
                state.update(change)
                result = module.render(state, now)
                self.assertNotIn('步行 5 分钟', result)
                self.assertNotIn('跑步 5 分钟', result)
                self.assertNotIn('惩罚', result)

    def test_evening_checks_feedback_without_a_false_deadline(self):
        path = Path(hermes_path('/opt/hermes-hhikr/state/scripts/activity_evening.py'))
        self.assertTrue(path.exists(), 'evening reminder implementation is missing')
        spec = importlib.util.spec_from_file_location('activity_evening', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        now = datetime(2026, 10, 13, 20, tzinfo=ZoneInfo('Asia/Taipei'))
        base = {'timezone': 'Asia/Taipei', 'start_date': '2026-10-12',
                'program_status': 'active', 'records': [], 'leaves': []}
        result = module.render(base, now)
        self.assertIn('22:59', result)
        self.assertIn('尚未收到', result)
        self.assertNotIn('逾期', result)
        self.assertNotIn('惩罚', result)
        result = module.render(dict(base, records=[{'date': '2026-10-13', 'status': 'completed',
                                                  'effort': 2}]), now)
        self.assertIn('已收到', result)
        self.assertNotIn('再做', result)
        result = module.render(dict(base, records=[{'date': '2026-10-12', 'status': 'completed'}]), now)
        self.assertIn('尚未收到', result)
        result = module.render(dict(base, leaves=[{'date': '2026-10-13', 'status': 'approved'}]), now)
        self.assertIn('已批准请假', result)
        self.assertNotIn('赶快', result)
        self.assertEqual('', module.render(dict(base, program_status='stopped'), now))
        self.assertEqual('', module.render(dict(base, start_date='2026-10-14'), now))

if __name__ == '__main__':
    unittest.main()
