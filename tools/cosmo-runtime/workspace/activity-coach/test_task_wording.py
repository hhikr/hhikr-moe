from hermes_paths import hermes_path
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(hermes_path('/opt/hermes-hhikr/source/plugins/platforms/telegram'))

def load(name):
    spec = importlib.util.spec_from_file_location('wording_' + name, ROOT / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

class TaskWordingTests(unittest.TestCase):
    def test_recovery_card_says_what_to_reply_without_policy_footer(self):
        cards = load('task_cards')
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            row = {'id':'daily-exercise-2026-10-14','date':'2026-10-14','status':'pending'}
            payload = cards.card_payload({'next_plan':{'valid_on':'2026-10-13'}}, row, 'morning', Path(directory))
            text = payload['text']
            self.assertIn('酸痛', text)
            self.assertIn('睡', text)
            self.assertIn('22:59', text)
            self.assertNotIn('没有当天有效训练处方', text)
            self.assertNotIn('不自动加量', text)
            self.assertNotIn('体感反馈与任务完成分别记录', text)
            self.assertNotIn('发送运动记录', text)
            self.assertEqual(6, sum(len(group) for group in payload['buttons']))

    def test_walk_card_retains_training_details_and_deadline(self):
        cards = load('task_cards')
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            row = {'id':'daily-exercise-2026-10-14','date':'2026-10-14','status':'pending'}
            plan = {'valid_on':row['date'],'kind':'walk','minutes':10,'effort_max':3}
            text = cards.card_payload({'next_plan':plan}, row, 'morning', Path(directory))['text']
            for value in ('10','3/10','平坦','19:00','22:59'):
                self.assertIn(value,text)

    def test_feedback_retains_ledger_semantics_without_negation_tail(self):
        cards = load('task_cards')
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            path = Path(directory) / '2026-10-14.json'
            path.write_text(json.dumps({'id':'daily-exercise-2026-10-14','date':'2026-10-14','status':'pending'}))
            text = cards.record_feedback('daily-exercise-2026-10-14','easy','synthetic-event','synthetic-user',Path(directory))
            self.assertIn('恢复',text)
            self.assertNotIn('不代替完成记录',text)
            self.assertEqual('pending',json.loads(path.read_text())['status'])
            self.assertIsNot(json.loads(path.read_text()).get('exercise_done'),True)

    def test_sleep_reminder_is_about_tonight_not_a_proof_disclaimer(self):
        store = load('task_store')
        row={'id':'daily-sleep-2026-10-15','date':'2026-10-15','status':'pending','started':True}
        text=store.sleep_card(row,'night')['text']
        for value in ('22:30','00:00','00:40','音频'):
            self.assertIn(value,text)
        self.assertNotIn('不证明真实入睡',text)
        self.assertNotIn('前一晚与次晨属于同一任务',text)

if __name__ == '__main__':
    unittest.main()
