from hermes_paths import hermes_path
import importlib.util
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

P = Path(hermes_path('/opt/hermes-hhikr/source/plugins/platforms/telegram/task_store.py'))

class SleepTaskTests(unittest.TestCase):
    def load(self):
        self.assertTrue(P.exists(), 'generic task instance store is missing')
        spec=importlib.util.spec_from_file_location('task_store_test',P)
        m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        return m

    def test_sleep_report_cannot_complete_before_morning_or_ignore_report_deadline(self):
        m=self.load()
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            root=Path(directory)
            row=m.sleep_instance(datetime.fromisoformat('2026-10-13T22:30:00+08:00'),root)
            with self.assertRaises(ValueError):
                m.apply_event(row['id'],'awake','too-early',datetime.fromisoformat('2026-10-13T23:40:00+08:00'),root)
            m.apply_event(row['id'],'prepare','p',datetime.fromisoformat('2026-10-13T23:45:00+08:00'),root)
            m.apply_event(row['id'],'awake','w',datetime.fromisoformat('2026-10-14T07:16:00+08:00'),root)
            result=m.report_sleep(row['id'],{'sleep_time':'00:10','wake_time':'07:15','energy':3},datetime.fromisoformat('2026-10-14T09:00:00+08:00'),root)
            self.assertEqual('awaiting_confirmation',result['status'])

    def test_night_and_morning_share_one_instance_and_do_not_touch_exercise(self):
        m=self.load()
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            root=Path(directory)
            night=m.sleep_instance(datetime.fromisoformat('2026-10-13T22:30:00+08:00'),root)
            morning=m.sleep_instance(datetime.fromisoformat('2026-10-14T07:15:00+08:00'),root)
            self.assertEqual(night['id'],morning['id'])
            self.assertEqual('daily-sleep-2026-10-14',night['id'])
            self.assertFalse((root/'2026-10-14.json').exists())
            m.apply_event(night['id'],'prepare','e1',datetime.fromisoformat('2026-10-13T23:45:00+08:00'),root)
            m.apply_event(night['id'],'awake','e2',datetime.fromisoformat('2026-10-14T07:16:00+08:00'),root)
            row=m.report_sleep(night['id'],{'sleep_time':'00:10','wake_time':'07:15','energy':3},datetime.fromisoformat('2026-10-14T07:25:00+08:00'),root)
            self.assertEqual('completed',row['status'])
            self.assertEqual('self_report',row['evidence_level'])

if __name__=='__main__':unittest.main()
