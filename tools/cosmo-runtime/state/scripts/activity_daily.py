from hermes_paths import hermes_path
from personal_parameters import PARAMETERS as CONFIG
"""One daily activity task with an atomic, durable per-day ledger."""
import json
import os
import tempfile
from datetime import date
from pathlib import Path

HISTORY = Path(hermes_path('/opt/hermes-hhikr/workspace/activity-coach/history'))


def save_day(record, history_dir=HISTORY):
    day = date.fromisoformat(record['date']).isoformat()
    folder = Path(history_dir)
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f'{day}.json'
    import fcntl
    with (folder / '.ledger.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        previous = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
        merged = dict(previous)
        merged.update({key: value for key, value in record.items() if value is not None})
        if previous.get('exercise_done') is True and record.get('exercise_done') is not False:
            merged['exercise_done'] = True
            if record.get('status') in (None, 'pending', 'awaiting_confirmation', 'failed'):
                merged['status'] = previous['status']
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=folder, suffix='.tmp', delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(merged, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
        return merged


def read_days(history_dir=HISTORY):
    return [json.loads(path.read_text(encoding='utf-8'))
            for path in sorted(Path(history_dir).glob('????-??-??.json'))]


def trend_summary(history_dir=HISTORY):
    rows = read_days(history_dir)
    exercised = [row for row in rows if row.get('exercise_done') is True]
    measured = [row for row in exercised if row.get('activity', {}).get('actual_duration_seconds') is not None]
    return {
        'tracked_days': len(rows),
        'exercise_days': len(exercised),
        'confirmed_no_exercise_days': sum(row.get('exercise_done') is False for row in rows),
        'unconfirmed_days': sum(row.get('exercise_done') is None for row in rows),
        'total_duration_seconds': sum(row['activity']['actual_duration_seconds'] for row in measured),
        'total_distance_km': round(sum(row.get('activity', {}).get('distance_km') or 0 for row in exercised), 6),
        'measured_workouts': len(measured),
        'trend_status': 'baseline_only' if len(measured) < 3 else 'volume_observations_available_not_a_fitness_diagnosis',
        'duration_change_seconds': None if len(measured) < 3 else measured[-1]['activity']['actual_duration_seconds'] - measured[0]['activity']['actual_duration_seconds'],
        'recent_days': [
            {'date': row['date'], 'exercise_done': row.get('exercise_done'), 'status': row.get('status'),
             'duration_seconds': row.get('activity', {}).get('actual_duration_seconds'),
             'distance_km': row.get('activity', {}).get('distance_km'),
             'effort': row.get('subjective', {}).get('effort'),
             'symptoms': row.get('subjective', {}).get('symptoms'),
             'next_day_recovery': row.get('subjective', {}).get('next_day_recovery')}
            for row in rows[-7:]
        ],
    }


def sync_history(state, now, history_dir=HISTORY):
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    local = now.astimezone(ZoneInfo(state.get('timezone', CONFIG['timezone'])))
    today = local.date().isoformat()
    records_by_day = {}
    for record in state.get('records', []):
        records_by_day.setdefault(record['date'], []).append(record)
    candidates = {row['date']: dict(row) for row in state.get('daily_tasks', [])}
    for day, records in records_by_day.items():
        row = candidates.setdefault(day, {'date': day})
        row['activities'] = records
        row['activity'] = dict(records[-1])
        if len(records) > 1:
            measured = [r for r in records if r.get('actual_duration_seconds') is not None]
            row['activity']['actual_duration_seconds'] = sum(r['actual_duration_seconds'] for r in measured) if measured else None
            distances = [r['distance_km'] for r in records if r.get('distance_km') is not None]
            row['activity']['distance_km'] = round(sum(distances), 6) if distances else None
            row['activity']['aggregate_contains_missing_values'] = len(measured) != len(records)
        row['subjective'] = {key: records[-1].get(key) for key in ('effort', 'symptoms', 'pain_change', 'next_day_recovery')}
        if any(r.get('status', '').startswith('completed') for r in records):
            row['exercise_done'] = True
            row['status'] = records[-1].get('status', 'completed')
        row['reported_at'] = records[-1].get('received_at')
    plan = state.get('next_plan') or {}
    if plan.get('valid_on') and plan['valid_on'] <= today:
        candidates.setdefault(plan['valid_on'], {'date': plan['valid_on']})['prescription'] = plan
    previous = read_days(history_dir)
    start = date.fromisoformat(state.get('start_date', today))
    cursor = max(start, date.fromisoformat(previous[-1]['date']) if previous else start)
    while cursor <= local.date():
        day = cursor.isoformat()
        candidates.setdefault(day, {'date': day, 'status': 'pending'})
        cursor += timedelta(days=1)
    approved = {leave['date'] for leave in state.get('leaves', []) if leave.get('status') == 'approved'}
    for day, row in candidates.items():
        row.setdefault('id', f'daily-exercise-{day}')
        row.setdefault('title', '每日运动')
        row.setdefault('status', 'pending')
        row.setdefault('deadline', day+'T'+CONFIG['exercise']['deadline']+':00'+CONFIG['offset'])
        if day in approved and row.get('exercise_done') is not True:
            row['status'] = 'excused'
        save_day(row, history_dir)
    for row in read_days(history_dir):
        if row['date'] < today and row.get('status') not in ('completed', 'completed_pending_evaluation', 'excused', 'medical_hold', 'recovery_completed'):
            row['status'] = 'failed' if row.get('exercise_done') is False else 'awaiting_confirmation'
            save_day(row, history_dir)
    summary = trend_summary(history_dir)
    folder = Path(history_dir)
    folder.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=folder, suffix='.tmp', delete=False) as handle:
        temporary = Path(handle.name)
        json.dump(summary, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, folder / 'summary.json')
    return summary


def render(state, now, phase=None, history_dir=HISTORY):
    import sys
    from zoneinfo import ZoneInfo
    directory = str(Path(__file__).parent)
    if directory not in sys.path:
        sys.path.insert(0, directory)
    import activity_morning
    import activity_evening
    local = now.astimezone(ZoneInfo(state.get('timezone', CONFIG['timezone'])))
    day = local.date().isoformat()
    if day < state.get('start_date', day) or state.get('program_status') in ('stopped', 'paused'):
        return ''
    summary = sync_history(state, local, history_dir)
    today = next(row for row in read_days(history_dir) if row['date'] == day)
    header = f'每日运动 · {day}\n任务 ID：daily-exercise-{day}\n'
    if today.get('exercise_done') is True:
        body = '今天已完成运动并保存，不需要再运动。次日恢复反馈或补充截图可以稍后追加，不会清空今天的完成状态。'
    else:
        phase = phase or ('morning' if local.hour < 12 else 'evening')
        body = activity_morning.render(state, local) if phase == 'morning' else activity_evening.render(state, local)
        condition = (state.get('next_plan') or {}).get('conditions')
        if condition and phase == 'morning':
            body += '\n执行前提：' + condition
    tail = f"\n记录汇总：已确认运动 {summary['exercise_days']} 天；已确认未运动 {summary['confirmed_no_exercise_days']} 天；待确认 {summary['unconfirmed_days']} 天。"
    if summary['trend_status'] == 'baseline_only':
        tail += '当前记录不足，仅建立基线，不判断体能升降。'
    return header + body + tail


if __name__ == '__main__':
    from datetime import datetime
    from zoneinfo import ZoneInfo
    state = json.loads(Path(hermes_path('/opt/hermes-hhikr/workspace/activity-coach/state.json')).read_text(encoding='utf-8'))
    message = render(state, datetime.now(ZoneInfo(state['timezone'])))
    if message:
        import importlib.util
        card_path = Path(hermes_path('/opt/hermes-hhikr/source/plugins/platforms/telegram/task_cards.py'))
        spec = importlib.util.spec_from_file_location('cosmo_task_cards', card_path)
        cards = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cards)
        local = datetime.now(ZoneInfo(state['timezone']))
        today = next(row for row in read_days() if row['date'] == local.date().isoformat())
        phase = 'morning' if local.hour < 12 else 'evening'
        print(cards.encode_card(cards.card_payload(state, today, phase)))
