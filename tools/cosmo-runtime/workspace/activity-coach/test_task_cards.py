from hermes_paths import hermes_path
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE = Path(hermes_path('/opt/hermes-hhikr/source/plugins/platforms/telegram/task_cards.py'))

class TaskCardTests(unittest.TestCase):
    def load(self):
        self.assertTrue(MODULE.exists(), 'task card and feedback implementation is missing')
        spec = importlib.util.spec_from_file_location('task_cards_tested', MODULE)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        return m

    def test_progress_is_a_readable_summary_not_an_internal_status_word(self):
        m = self.load()
        self.assertTrue(hasattr(m, 'progress_text'), 'readable task progress summary is missing')
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            row = {'id':'daily-exercise-2026-10-13','title':'每日运动','date':'2026-10-13',
                   'deadline':'2026-10-13T22:59:00+08:00','status':'pending',
                   'task_feedback':{'difficulty':'easy'}}
            text = m.progress_text(row, Path(directory))
            self.assertIn('进行中', text)
            self.assertIn('22:59', text)
            self.assertIn('太轻松', text)
            self.assertIn('还没收到运动记录', text)
            self.assertNotIn('pending', text)

    def test_task_script_emits_a_compact_card_with_six_working_actions(self):
        import subprocess
        import sys
        from plugins.platforms.telegram.task_cards import PREFIX, decode_card
        script = hermes_path('/opt/hermes-hhikr/state/scripts/activity_daily.py')
        run = subprocess.run([sys.executable, script], capture_output=True, text=True, check=True)
        self.assertTrue(run.stdout.startswith(PREFIX), 'task script still emits the old wall of text')
        payload = decode_card(run.stdout.strip())
        self.assertEqual(6, sum(len(group) for group in payload['buttons']))
        self.assertIn('<b>', payload['text'])
        self.assertNotIn('Cronjob Response', payload['text'])
        self.assertIn('22:59', payload['text'])

    def test_easy_feedback_is_saved_without_marking_done_and_used_for_planning(self):
        m = self.load()
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            folder = Path(directory)
            p = folder / '2026-10-13.json'
            p.write_text(json.dumps({'id':'daily-exercise-2026-10-13', 'date':'2026-10-13', 'status':'pending'}))
            result = m.record_feedback('daily-exercise-2026-10-13', 'easy', 'test-click', '123', folder)
            row = json.loads(p.read_text())
            self.assertEqual('easy', row['task_feedback']['difficulty'])
            self.assertEqual('pending', row['status'])
            self.assertIsNot(row.get('exercise_done'), True)
            self.assertIn('恢复', result)
            self.assertIn('轻松', m.planning_context(folder))
            m.record_feedback('daily-exercise-2026-10-13', 'easy', 'test-click', '123', folder)
            self.assertEqual(1, len(json.loads(p.read_text())['task_feedback']['events']))

class TelegramIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_standalone_cron_sender_renders_card_instead_of_leaking_json(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch
        from tools.send_message_senders import _send_telegram
        from plugins.platforms.telegram.task_cards import encode_card
        bot = SimpleNamespace(send_message=AsyncMock(return_value=SimpleNamespace(message_id=78)))
        payload = {'instance_id':'daily-exercise-2026-10-13','text':'<b>任务</b>\n轻松步行 10 分钟',
                   'buttons':[[{'text':'太轻松','callback_data':'tc:daily-exercise-2026-10-13:easy'}]]}
        with patch('tools.send_message_senders._telegram_bot', return_value=bot):
            result = await _send_telegram('fixture-not-a-real-token', '123', encode_card(payload))
        self.assertTrue(result.get('success'), result)
        kwargs = bot.send_message.call_args.kwargs
        self.assertEqual(payload['text'], kwargs['text'], 'internal JSON reached Telegram')
        self.assertEqual('HTML', kwargs['parse_mode'])
        self.assertEqual('太轻松', kwargs['reply_markup'].inline_keyboard[0][0].text)

    async def test_card_dispatch_uses_html_and_real_inline_markup(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock
        from plugins.platforms.telegram.adapter import TelegramAdapter
        from plugins.platforms.telegram.task_cards import encode_card
        from gateway.platforms.base import SendResult
        a = object.__new__(TelegramAdapter)
        a._send_flood_cooldown_remaining = lambda _: None
        a._chat_outbound_slot_remaining = lambda _: 0
        a._hold_chat_outbound_slot = lambda _: None
        a._telegram_error_types = lambda: (Exception, Exception, Exception)
        a._should_attempt_rich = lambda *args, **kw: False
        a._send_control_message = AsyncMock(return_value=SimpleNamespace(message_id=77))
        a._send_chunks = AsyncMock(return_value=SendResult(success=True, message_id='plain'))
        payload = {'instance_id':'daily-exercise-2026-10-13','text':'<b>任务</b>',
                   'buttons':[[{'text':'太轻松','callback_data':'tc:daily-exercise-2026-10-13:easy'}]]}
        result = await a._send_text_locked('123', encode_card(payload), None, None)
        self.assertTrue(result.success)
        a._send_control_message.assert_awaited_once()
        self.assertEqual('HTML', a._send_control_message.call_args.kwargs['parse_mode'])
        self.assertEqual('太轻松', a._send_control_message.call_args.kwargs['reply_markup'].inline_keyboard[0][0].text)

    async def test_authorized_button_roundtrip_persists_and_acknowledges(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch
        from plugins.platforms.telegram.adapter import TelegramAdapter
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            folder = Path(directory)
            file = folder / '2026-10-13.json'
            file.write_text(json.dumps({'id':'daily-exercise-2026-10-13','date':'2026-10-13','status':'completed','exercise_done':True}))
            a = object.__new__(TelegramAdapter)
            a._accept_update = lambda: None
            a._callback_authorized = AsyncMock(return_value=True)
            a.send = AsyncMock()
            query = SimpleNamespace(id='roundtrip-1',data='tc:daily-exercise-2026-10-13:easy',
                from_user=SimpleNamespace(id=123,first_name='owner'),message=SimpleNamespace(chat_id=123),answer=AsyncMock())
            with patch('plugins.platforms.telegram.task_cards.HISTORY', folder), patch('plugins.platforms.telegram.task_cards.record_feedback', wraps=lambda i,a,e,u: self._record(i,a,e,u,folder)):
                await a._handle_callback_query(SimpleNamespace(callback_query=query), None)
            row = json.loads(file.read_text())
            self.assertEqual('easy', row['task_feedback']['difficulty'])
            self.assertTrue(row['exercise_done'])
            self.assertEqual('completed', row['status'])
            query.answer.assert_awaited_once_with(text='反馈已保存')
            a.send.assert_awaited_once()

    @staticmethod
    def _record(instance, action, event, user, folder):
        from plugins.platforms.telegram.task_cards import record_feedback
        # Importing under a wrapped mock would recurse; use the independently loaded real module.
        spec = importlib.util.spec_from_file_location('task_cards_roundtrip', MODULE)
        real = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(real)
        return real.record_feedback(instance, action, event, user, folder)

    async def test_sleep_buttons_use_the_generic_instance_not_exercise_history(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch
        from plugins.platforms.telegram.adapter import TelegramAdapter
        a=object.__new__(TelegramAdapter)
        a._accept_update=lambda:None
        a._callback_authorized=AsyncMock(return_value=True)
        a.send=AsyncMock()
        query=SimpleNamespace(id='sleep-view',data='tc:daily-sleep-2026-10-14:progress',
            from_user=SimpleNamespace(id=123,first_name='owner'),
            message=SimpleNamespace(chat_id=123,message_thread_id=42),answer=AsyncMock())
        row={'id':'daily-sleep-2026-10-14','date':'2026-10-14','title':'规律作息','task_type':'sleep','status':'pending','events':[]}
        with patch('plugins.platforms.telegram.task_store.read',return_value=row):
            await a._handle_callback_query(SimpleNamespace(callback_query=query),None)
        a.send.assert_awaited_once()
        self.assertIn('规律作息',a.send.call_args.args[1])
        self.assertEqual('42',a.send.call_args.kwargs['metadata']['thread_id'])

    async def test_callback_reply_stays_in_notification_topic(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch
        from plugins.platforms.telegram.adapter import TelegramAdapter
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            folder = Path(directory)
            (folder/'2026-10-13.json').write_text(json.dumps({'id':'daily-exercise-2026-10-13','date':'2026-10-13','status':'pending'}))
            a = object.__new__(TelegramAdapter)
            a._accept_update = lambda: None
            a._callback_authorized = AsyncMock(return_value=True)
            a.send = AsyncMock()
            query = SimpleNamespace(id='topic-test',data='tc:daily-exercise-2026-10-13:progress',
                from_user=SimpleNamespace(id=123,first_name='owner'),
                message=SimpleNamespace(chat_id=123,message_thread_id=42),answer=AsyncMock())
            with patch('plugins.platforms.telegram.task_cards.HISTORY', folder):
                await a._handle_callback_query(SimpleNamespace(callback_query=query), None)
            self.assertEqual('42', a.send.call_args.kwargs.get('metadata', {}).get('thread_id'),
                             'task callback polluted the ordinary chat')

    async def test_task_callback_runs_existing_authorization_gate(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock
        from plugins.platforms.telegram.adapter import TelegramAdapter
        a = object.__new__(TelegramAdapter)
        a._accept_update = lambda: None
        a._callback_authorized = AsyncMock(return_value=False)
        query = SimpleNamespace(data='tc:daily-exercise-2026-10-13:easy',
                                from_user=SimpleNamespace(id=999,first_name='stranger'),
                                message=SimpleNamespace(chat_id=123),answer=AsyncMock())
        await a._handle_callback_query(SimpleNamespace(callback_query=query), None)
        a._callback_authorized.assert_awaited_once()

if __name__ == '__main__':
    unittest.main()
