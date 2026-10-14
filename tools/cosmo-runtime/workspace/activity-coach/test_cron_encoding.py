from hermes_paths import hermes_path
"""Run with the actual Hermes launcher to exercise its parent decoding."""
import unittest
from cron.scheduler_script import _run_job_script


class CronEncodingTests(unittest.TestCase):
    def test_real_cron_pipe_preserves_chinese(self):
        ok, output = _run_job_script(
            'activity_encoding_probe.py',
            workdir=hermes_path('/opt/hermes-hhikr/workspace/activity-coach'),
        )
        self.assertTrue(ok, output)
        self.assertEqual('中文测试：活动提醒 5 分钟，截止 22:59。', output)


if __name__ == '__main__':
    unittest.main()
