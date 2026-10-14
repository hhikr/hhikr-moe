from hermes_paths import hermes_path
import importlib.util
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

P=Path(hermes_path('/opt/hermes-hhikr/state/scripts/sleep_daily.py'))

class SleepDispatchTests(unittest.TestCase):
    def test_only_due_phases_emit_cards_and_night_belongs_to_next_day(self):
        self.assertTrue(P.exists(),'sleep task dispatcher missing')
        spec=importlib.util.spec_from_file_location('sleep_dispatch_test',P)
        m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            folder=Path(directory)
            self.assertEqual('[SILENT]',m.render(datetime.fromisoformat('2026-10-13T18:00:00+08:00'),folder,'2026-10-13'))
            card=m.render(datetime.fromisoformat('2026-10-13T22:30:00+08:00'),folder,'2026-10-13')
            self.assertIn('daily-sleep-2026-10-14',card)
            self.assertIn('22',card)
            morning=m.render(datetime.fromisoformat('2026-10-14T07:15:00+08:00'),folder,'2026-10-13')
            self.assertIn('daily-sleep-2026-10-14',morning)
            self.assertIn('已离床',morning)

if __name__=='__main__':unittest.main()
