from hermes_paths import hermes_path
from personal_parameters import PARAMETERS as CONFIG
"""Small reusable Telegram Todo cards and durable task-instance feedback.
Uses existing dated records; does not create a second task or infer completion.
"""
import fcntl
import html
import json
import os
import re
import tempfile
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

PREFIX = 'CHRONOS_TASK_CARD_V1\n'
HISTORY = Path(hermes_path('/opt/hermes-hhikr/workspace/activity-coach/history'))
LABELS = {'easy': '太轻松', 'okay': '刚好', 'hard': '太累', 'pain': '有不适'}


def record_feedback(instance_id, action, event_id, user_id, history_dir=HISTORY):
    if action not in LABELS or not re.fullmatch(r'[a-z0-9-]{1,48}', instance_id):
        raise ValueError('无效任务反馈')
    day = date.fromisoformat(instance_id[-10:]).isoformat()
    folder = Path(history_dir)
    path = folder / f'{day}.json'
    with (folder / '.ledger.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        row = json.loads(path.read_text(encoding='utf-8'))
        if row.get('id') != instance_id:
            raise ValueError('任务实例不匹配')
        feedback = row.setdefault('task_feedback', {})
        events = feedback.setdefault('events', [])
        if not any(e['id'] == event_id for e in events):
            at = datetime.now(ZoneInfo(CONFIG['timezone'])).isoformat()
            events.append({'id': event_id, 'action': action, 'user_id': str(user_id), 'at': at})
            feedback['events'] = events[-100:]
            if action == 'pain':
                feedback['symptoms_reported'] = True
            else:
                feedback['difficulty'] = action
            feedback['review_required'] = True
            feedback['updated_at'] = at
            with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=folder, delete=False) as handle:
                json.dump(row, handle, ensure_ascii=False, indent=2)
                handle.write('\n')
                handle.flush()
                os.fsync(handle.fileno())
                temporary = handle.name
            os.replace(temporary, path)
    if action == 'pain':
        return f'{day} 的不适记下了，今天先休息。告诉我哪里不舒服、什么时候开始、现在有多严重。如果有胸痛、明显气短或快要晕倒，请及时就医。'
    messages = {
        'easy': '轻松这点记下了。明天再看看酸痛和疲劳的恢复情况，再定下一次的量。',
        'okay': '这个强度刚好，记下了。明天告诉我恢复得怎么样。',
        'hard': '这次有点累，记下了。先休息，下次结合恢复情况把量调低。',
    }
    return f"{day}：{messages[action]}"


def planning_context(history_dir=HISTORY):
    observations = []
    for p in sorted(Path(history_dir).glob('????-??-??.json'))[-7:]:
        row = json.loads(p.read_text(encoding='utf-8'))
        fb = row.get('task_feedback', {})
        if fb.get('difficulty') in LABELS:
            observations.append(f"{row['date']}：{LABELS[fb['difficulty']]}")
        if fb.get('symptoms_reported'):
            observations.append(f"{row['date']}：报告不适，需先确认恢复")
    return '；'.join(observations) + ('。下一次的量结合实际运动和恢复情况来定。' if observations else '')


def card_payload(state, row, phase, history_dir=HISTORY):
    day = row['date']
    done = row.get('exercise_done') is True
    plan = state.get('next_plan') or {}
    active_plan = plan.get('valid_on') == day
    leaves = [x for x in state.get('leaves', []) if x.get('date') == day and x.get('status') == 'approved']
    paused = state.get('program_status') == 'medical_hold' or bool(leaves)
    needs_recovery = any(json.loads(p.read_text(encoding='utf-8')).get('task_feedback', {}).get('symptoms_reported')
                         for p in sorted(Path(history_dir).glob('????-??-??.json'))[-2:])
    status = '已完成' if done else ('先休息，看看恢复情况' if paused or needs_recovery else '进行中')
    lines = [f"<b>🚶 {html.escape(row.get('title', '每日运动'))}</b>", f'{day} · {status}', '']
    if done:
        lines.extend(['今天的运动记录收到了。', '接下来休息就好，明天告诉我酸痛和疲劳有没有变化。'])
    elif paused or needs_recovery:
        lines.extend(['今天先休息。告诉我现在的酸痛、疲劳和其他不适怎么样，缓过来再安排活动。'])
    elif active_plan and plan.get('kind') == 'walk':
        lead = '今晚记得把步行记录发我。' if phase == 'evening' else '今天安排轻松步行。'
        lines.extend([lead,
                      f"走 {html.escape(str(plan['minutes']))} 分钟，选平坦的路，开头和结尾慢一点。用力控制在 {html.escape(str(plan['effort_max']))}/10 以内，走的时候能完整说话就好。",
                      '走完把记录发我，再说说累不累、酸痛有没有变化。',
                      '如果酸痛或疲劳明显加重，先停下来休息，告诉我情况。'])
    else:
        lines.extend(['今天先看看恢复得怎么样：起床后酸痛、疲劳比昨天轻还是重？昨晚睡得如何？',
                      '告诉我这些，再一起定今天走多少。'])
    if not done:
        timing = '今天的记录截止到 {deadline}，走完或需要调整都可以直接告诉我。'.format(deadline=CONFIG['exercise']['deadline']) if phase == 'evening' else '{evening} 再提醒你，今天的记录截止到 {deadline}。'.format(**CONFIG['exercise'])
        lines.extend(['', timing])
    lines.extend(['', '<i>Cosmo</i>'])
    actions = [[('📸 提交记录', 'record'), ('📊 查看进度', 'progress')],
               [('🙂 太轻松', 'easy'), ('👌 刚好', 'okay'), ('😮‍💨 太累', 'hard')],
               [('⚠️ 反馈不适', 'pain')]]
    return {'instance_id': row['id'], 'date': day, 'text': '\n'.join(lines),
            'buttons': [[{'text': title, 'callback_data': f"tc:{row['id']}:{action}"} for title, action in group] for group in actions]}


def encode_card(payload):
    return PREFIX + json.dumps(payload, ensure_ascii=False)


def decode_card(content):
    if not content.startswith(PREFIX):
        return None
    payload = json.loads(content[len(PREFIX):])
    if len(payload['text']) > 3800:
        raise ValueError('Task card exceeds single-message limit')
    for group in payload['buttons']:
        for button in group:
            if len(button['callback_data'].encode('utf-8')) > 64:
                raise ValueError('Task callback is too long')
    return payload


async def send_card(adapter, chat_id, payload, metadata=None):
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    from gateway.platforms.base import SendResult
    keyboard = InlineKeyboardMarkup([[InlineKeyboardButton(**b) for b in group] for group in payload['buttons']])
    msg = await adapter._send_control_message(chat_id, payload['text'], parse_mode='HTML',
                                              thread_id=(metadata or {}).get('thread_id'),
                                              metadata=metadata, reply_markup=keyboard)
    return SendResult(success=True, message_id=str(msg.message_id))


def progress_text(row, history_dir=HISTORY):
    done = row.get('exercise_done') is True
    status = '✅ 已完成' if done else {
        'pending': '⏳ 进行中', 'failed': '🔴 已判定失败',
        'awaiting_confirmation': '🟡 待核实', 'paused': '⏸ 已暂停'
    }.get(row.get('status'), '🟡 待核实')
    feedback = row.get('task_feedback', {})
    difficulty = LABELS.get(feedback.get('difficulty'), '尚未反馈')
    deadline = str(row.get('deadline') or '').partition('T')[2][:5] or CONFIG['exercise']['deadline']
    rows = [json.loads(p.read_text(encoding='utf-8')) for p in Path(history_dir).glob('????-??-??.json')]
    completed = sum(r.get('exercise_done') is True for r in rows)
    lines = [f"**📊 {row.get('title', '任务')} · {row['date']}**", status, '',
             '运动记录：' + ('已收到' if done else '还没收到运动记录'),
             '这次的感受：' + difficulty,
             f'已记录运动 {completed} 天。']
    if feedback.get('symptoms_reported'):
        lines.extend(['', '你提到的不适也记下了。今天先休息，告诉我现在怎么样。'])
    elif done:
        lines.extend(['', '今天的记录齐了，明天告诉我恢复得怎么样。'])
    else:
        lines.extend(['', f'今天的记录截止到 {deadline}，{CONFIG["exercise"]["evening"]} 会再提醒你。',
                      '如果已经走完，直接发截图或告诉我时长，再说说累不累、有哪里不舒服。'])
    if feedback.get('difficulty') == 'easy':
        lines.extend(['', '你选了“太轻松”，我记着。下一次的量结合这次的运动和恢复来定。'])
    elif feedback.get('difficulty') == 'hard':
        lines.extend(['', '你选了“太累”，先休息，下次看看怎么减量。'])
    return '\n'.join(lines)


async def handle_callback(adapter, query, data, cb):
    # The adapter applies its existing user/chat authorization before dispatch.
    parts = data.split(':')
    if len(parts) != 3:
        await query.answer(text='无效任务按钮')
        return
    _, instance_id, action = parts
    try:
        if not re.fullmatch(r'[a-z0-9-]{1,48}', instance_id):
            raise ValueError('无效任务实例')
        day = date.fromisoformat(instance_id[-10:]).isoformat()
        if instance_id.startswith('daily-sleep-'):
            from . import task_store
            row = task_store.read(instance_id)
            now = datetime.now(ZoneInfo(CONFIG['timezone']))
            if action == 'progress':
                labels={'pending':'进行中' if row.get('started') else '未启动（预告）','completed':'已完成','awaiting_confirmation':'待核实','medical_hold':'恢复优先','failed':'已确认失败'}
                events=row.get('events',[])
                prepared=next((e['at'].partition('T')[2][:5] for e in events if e['action']=='prepare'),'还没记')
                awake=next((e['at'].partition('T')[2][:5] for e in events if e['action']=='awake'),'还没记')
                response=f"**🌙 规律作息 · {row['date']}**\n{labels.get(row.get('status'),'待核实')}\n\n开始准备：{prepared}\n离床：{awake}\n昨晚的睡眠记录：{'已收到' if row.get('sleep_report') else '还没收到'}\n\n{CONFIG['sleep']['rest']} 开始休息，准备时间暂时放宽到 {CONFIG['sleep']['prepare']}；早上 {CONFIG['sleep']['morning']} 起床、最迟 {CONFIG['sleep']['wake']} 离床，{CONFIG['sleep']['report']} 前把睡眠记录发我。"
            elif action == 'sleep_report':
                response='直接告诉我昨晚大概几点睡着、今天几点离床，现在精神怎么样就好。比如：“一点左右睡着，八点二十起床，还是有点累。”'
            else:
                task_store.apply_event(instance_id,action,query.id,now)
                prompts={'prepare':'记下了，开始收尾吧。助眠音频选好后关屏听，早点休息。',
                    'awake':'起床时间记下了。昨晚大概几点睡着，现在精神怎么样？',
                    'not_sleepy':'还不困的话，先做点安静的事，等有睡意再休息。明早告诉我大概几点睡着。',
                    'delay':'先把 Bilibili 关掉吧。是什么事情耽搁了，预计还需要多久？',
                    'unwell':'今天先照顾身体。哪里不舒服、现在有多严重？',
                    'unexcused_failure':'这次的漏做记下了。按约定，明天 Bilibili 额度是 {limit} 分钟；实际执行情况可以在手机状态页查看。'.format(limit=CONFIG['phone']['reduced_minutes'])}
                response=prompts[action]
        else:
            row = json.loads((HISTORY / f'{day}.json').read_text(encoding='utf-8'))
            if row.get('id') != instance_id:
                raise ValueError('任务实例不匹配')
            if action == 'record':
                response = f'直接发 {day} 的运动截图，或告诉我走了多久、累不累、酸痛有没有变化就好。'
            elif action == 'progress':
                response = progress_text(row)
            else:
                response = record_feedback(instance_id, action, query.id, query.from_user.id)
        await query.answer(text='已处理' if action in ('record', 'progress', 'sleep_report') else '反馈已保存')
        reply_metadata = {'thread_id': str(cb['thread_id'])} if cb.get('thread_id') is not None else None
        await adapter.send(str(query.message.chat_id), response, metadata=reply_metadata)
    except (ValueError, FileNotFoundError, KeyError, json.JSONDecodeError):
        await query.answer(text='任务已失效或数据不完整，请直接回复 Cosmo')
