from hermes_paths import hermes_path
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


class DailyTaskTests(unittest.TestCase):
    def test_completion_survives_reload_and_late_feedback(self):
        path = Path(hermes_path('/opt/hermes-hhikr/state/scripts/activity_daily.py'))
        self.assertTrue(path.exists(), 'unified daily task implementation is missing')
        spec = importlib.util.spec_from_file_location('activity_daily', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            folder = Path(directory)
            module.save_day({'date': '2026-10-12', 'status': 'completed_pending_evaluation',
                             'exercise_done': True, 'activity': {'actual_duration_seconds': 610,
                                                                'distance_km': 0.99}}, folder)
            module.save_day({'date': '2026-10-12', 'status': 'pending', 'exercise_done': None}, folder)
            row = json.loads((folder / '2026-10-12.json').read_text(encoding='utf-8'))
            self.assertTrue(row['exercise_done'])
            self.assertEqual('completed_pending_evaluation', row['status'])
            self.assertEqual(610, row['activity']['actual_duration_seconds'])
            module.save_day({'date': '2026-10-12', 'subjective': {'effort': 2}}, folder)
            row = json.loads((folder / '2026-10-12.json').read_text(encoding='utf-8'))
            self.assertTrue(row['exercise_done'])
            self.assertEqual(2, row['subjective']['effort'])


    def test_trends_keep_missing_days_unknown(self):
        path = Path(hermes_path('/opt/hermes-hhikr/state/scripts/activity_daily.py'))
        spec = importlib.util.spec_from_file_location('activity_daily', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(hasattr(module, 'trend_summary'), 'persistent trend aggregation is missing')
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            folder = Path(directory)
            module.save_day({'date': '2026-10-10', 'exercise_done': True, 'status': 'completed',
                             'activity': {'actual_duration_seconds': 610, 'distance_km': 0.99}}, folder)
            module.save_day({'date': '2026-10-11', 'exercise_done': None, 'status': 'awaiting_confirmation'}, folder)
            module.save_day({'date': '2026-10-12', 'exercise_done': False, 'status': 'failed'}, folder)
            result = module.trend_summary(folder)
            self.assertEqual(1, result['exercise_days'])
            self.assertEqual(1, result['confirmed_no_exercise_days'])
            self.assertEqual(1, result['unconfirmed_days'])
            self.assertEqual(610, result['total_duration_seconds'])
            self.assertEqual(0.99, result['total_distance_km'])
            self.assertEqual('baseline_only', result['trend_status'])

    def test_two_reminders_use_one_dated_task_and_keep_completed_history(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo
        path = Path(hermes_path('/opt/hermes-hhikr/state/scripts/activity_daily.py'))
        spec = importlib.util.spec_from_file_location('activity_daily', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(hasattr(module, 'render'), 'unified reminder dispatch is missing')
        state = {'timezone': 'Asia/Taipei', 'start_date': '2026-10-12', 'program_status': 'active',
                 'next_plan': {'kind': 'walk', 'valid_on': '2026-10-13', 'minutes': 10,
                               'effort_max': 3, 'reason': '保持首日负荷'},
                 'daily_tasks': [{'date': '2026-10-12', 'exercise_done': True, 'status': 'completed'}],
                 'records': [{'date': '2026-10-12', 'actual_duration_seconds': 610, 'distance_km': 0.99,
                              'effort': 3, 'status': 'completed'}], 'leaves': []}
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            folder = Path(directory)
            morning = module.render(state, datetime(2026, 10, 13, 8, tzinfo=ZoneInfo('Asia/Taipei')), history_dir=folder)
            current = json.loads((folder / '2026-10-13.json').read_text(encoding='utf-8'))
            self.assertEqual('pending', current.get('status'))
            evening = module.render(state, datetime(2026, 10, 13, 20, tzinfo=ZoneInfo('Asia/Taipei')), history_dir=folder)
            self.assertIn('每日运动', morning)
            self.assertIn('daily-exercise-2026-10-13', morning)
            self.assertIn('daily-exercise-2026-10-13', evening)
            self.assertIn('22:59', evening)
            self.assertIn('10 分钟', morning)
            module.render(state, datetime(2026, 10, 14, 8, tzinfo=ZoneInfo('Asia/Taipei')), history_dir=folder)
            previous = json.loads((folder / '2026-10-12.json').read_text(encoding='utf-8'))
            missing = json.loads((folder / '2026-10-13.json').read_text(encoding='utf-8'))
            self.assertTrue(previous['exercise_done'])
            self.assertEqual('completed', previous['status'])
            self.assertEqual('awaiting_confirmation', missing['status'])
            self.assertIsNone(missing.get('exercise_done'))
            summary = json.loads((folder / 'summary.json').read_text(encoding='utf-8'))
            self.assertEqual(1, summary['exercise_days'])

    def test_future_prescription_does_not_count_as_an_unconfirmed_day(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo
        spec = importlib.util.spec_from_file_location('activity_daily', hermes_path('/opt/hermes-hhikr/state/scripts/activity_daily.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        state = {'timezone': 'Asia/Taipei', 'start_date': '2026-10-12', 'program_status': 'active',
                 'next_plan': {'kind': 'walk', 'valid_on': '2026-10-13', 'minutes': 10,
                               'effort_max': 3, 'reason': '维持'},
                 'daily_tasks': [{'date': '2026-10-12', 'exercise_done': True, 'status': 'completed'}],
                 'records': [], 'leaves': []}
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            folder = Path(directory)
            module.render(state, datetime(2026, 10, 12, 23, tzinfo=ZoneInfo('Asia/Taipei')), history_dir=folder)
            self.assertFalse((folder / '2026-10-13.json').exists())
            self.assertEqual(1, module.trend_summary(folder)['tracked_days'])

if __name__ == '__main__':
    unittest.main()
