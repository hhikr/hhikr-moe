from hermes_paths import hermes_path
from personal_parameters import PARAMETERS as CONFIG
"""Bounded, revocable Bilibili rules; evaluation is not device enforcement."""
import json
from datetime import date, timedelta
from pathlib import Path

HISTORY = Path(hermes_path('/opt/hermes-hhikr/workspace/activity-coach/history'))


def evaluate(day, outcomes):
    today = date.fromisoformat(day)
    previous = (today - timedelta(days=1)).isoformat()
    reasons = [row for row in outcomes if row.get('date') == previous
               and row.get('status') == 'failed'
               and row.get('reason') == 'unexcused_incomplete']
    return {
        'date': today.isoformat(), 'timezone': CONFIG['timezone'],
        'restricted_apps': CONFIG['phone']['restricted_apps'],
        'restriction_scope': 'visible_screen_use_only',
        'allow_background_audio': True,
        'force_stop_app': False,
        'daily_limit_minutes': CONFIG['phone']['reduced_minutes'] if reasons else CONFIG['phone']['normal_minutes'],
        'blocked_window': {'start': CONFIG['phone']['night_start'], 'end': CONFIG['phone']['night_end'], 'crosses_midnight': True},
        'penalty_applied': bool(reasons),
        'penalty_sources': [row.get('id', row.get('task_id')) for row in reasons],
        'penalty_expires_at': (today + timedelta(days=1)).isoformat() + 'T00:00:00'+CONFIG['offset'],
        'penalties_stack': False, 'owner_can_revoke': True,
        'enforcement_status': 'awaiting_device_setup_and_verification',
    }


def access_decision(at, used_seconds, *, screen_interactive, unlocked, bilibili_visible, outcomes=()):
    """Evaluate a device observation; this function does not operate the phone.
    Visible includes fullscreen, split-screen and PiP; background audio is not a visible surface.
    """
    from datetime import datetime, time
    from zoneinfo import ZoneInfo
    instant = datetime.fromisoformat(at)
    if instant.tzinfo is None or used_seconds < 0:
        raise ValueError('An aware timestamp and nonnegative usage are required')
    local = instant.astimezone(ZoneInfo(CONFIG['timezone']))
    rules = evaluate(local.date().isoformat(), outcomes)
    visible = bool(screen_interactive and unlocked and bilibili_visible)
    clock = local.time().replace(tzinfo=None)
    night = clock >= time.fromisoformat(CONFIG['phone']['night_start']) or clock < time.fromisoformat(CONFIG['phone']['night_end'])
    quota_exhausted = used_seconds >= rules['daily_limit_minutes'] * 60
    blocked = visible and (night or quota_exhausted)
    return {
        'block_visible_ui': blocked,
        'count_screen_time': visible and not blocked,
        'allow_background_audio': True,
        'force_stop_app': False,
        'reason': ('night_schedule' if night else 'daily_quota') if blocked else 'allowed',
        'enforcement_status': rules['enforcement_status'],
    }


def current_rules(day):
    outcomes = [json.loads(p.read_text(encoding='utf-8')) for p in HISTORY.glob('????-??-??.json')]
    # No reason is invented for old records: a missing unexcused verdict must not punish.
    return evaluate(day, outcomes)


if __name__ == '__main__':
    from datetime import datetime
    from zoneinfo import ZoneInfo
    print(json.dumps(current_rules(datetime.now(ZoneInfo(CONFIG['timezone'])).date().isoformat()),
                     ensure_ascii=False, indent=2))
