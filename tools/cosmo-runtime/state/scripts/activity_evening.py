from hermes_paths import hermes_path
from personal_parameters import PARAMETERS as CONFIG
"""Evening reminder: receipt check only, not a verdict or extra workout."""
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

STATE = Path(hermes_path('/opt/hermes-hhikr/workspace/activity-coach/state.json'))


def render(state, now):
    day = now.astimezone(ZoneInfo(state.get('timezone', CONFIG['timezone']))).date().isoformat()
    if day < state.get('start_date', day) or state.get('program_status') in ('stopped', 'paused'):
        return ''
    header = f'Cosmo · {day} 晚间反馈提醒\n'
    timing = CONFIG['exercise']['evening_text']
    if state.get('program_status') == 'medical_hold':
        return header + '训练仍暂停，只需反馈今天症状和恢复情况；按需要就医。\n' + timing
    leave = next((x for x in state.get('leaves', []) if x.get('date') == day and x.get('status') == 'approved'), None)
    if leave:
        return header + '今天已批准请假，不需要补练；如果方便，报一下恢复情况。\n' + timing
    records = [x for x in state.get('records', []) if x.get('date') == day]
    if records:
        return header + '已收到今天的反馈，不追加运动。明早补充睡眠、酸痛和疲劳变化，再确定下一次安排。\n' + timing
    return (
        header + '尚未收到今天的反馈，仍在当日时间内，这不代表你没完成。\n' + timing
        + '已完成：发送运动详情截图，加上用力程度、酸痛变化和不舒服的症状。\n'
        + '尚未完成：先核对早间任务和当前状态，安全时在方便的时间完成；有客观阻碍或明显不适就回复说明。\n'
        + '截图或设备出问题：如实告诉我实际活动和时长；我会核实，不要求重新运动。'
    )


if __name__ == '__main__':
    state = json.loads(STATE.read_text(encoding='utf-8'))
    message = render(state, datetime.now(ZoneInfo(state['timezone'])))
    if message:
        print(message)
