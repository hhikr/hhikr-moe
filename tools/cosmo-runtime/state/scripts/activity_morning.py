from hermes_paths import hermes_path
from personal_parameters import PARAMETERS as CONFIG
"""Render the dated prescription, without inference or automatic progression."""
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

STATE = Path(hermes_path('/opt/hermes-hhikr/workspace/activity-coach/state.json'))


def render(state, now):
    day = now.astimezone(ZoneInfo(state.get('timezone', CONFIG['timezone']))).date().isoformat()
    if day < state.get('start_date', day) or state.get('program_status') in ('stopped', 'paused'):
        return ''
    header = f'Cosmo · {day} 活动任务\n'
    timing = CONFIG['exercise']['morning_text']
    if state.get('program_status') == 'medical_hold':
        return header + '训练已暂停。今天只反馈症状和恢复情况，并按需要就医。\n' + timing
    leave = next((x for x in state.get('leaves', []) if x.get('date') == day and x.get('status') == 'approved'), None)
    if leave:
        return header + f"今天已批准请假：{leave.get('reason', '按已审核安排休息')}。不补练；请反馈恢复情况。\n" + timing
    plan = state.get('next_plan')
    if not plan or plan.get('valid_on') != day:
        return header + '今天尚无经过评估的新训练处方，不重复过期任务，也不自动加量。请先反馈上次活动、今早酸痛、疲劳和睡眠，今天先做恢复确认。\n' + timing
    if plan.get('kind') in ('recovery', 'rest'):
        return header + f"今天是恢复日，不加练。安排依据：{plan.get('reason', '观察恢复')}。请反馈酸痛、疲劳及异常症状。\n" + timing
    if plan.get('kind') != 'walk':
        return header + '当前训练类型尚未接入提醒脚本，请联系 Cosmo 核实处方；暂不自行加量。\n' + timing
    return (
        header
        + f"平地轻松步行 {plan['minutes']} 分钟（含开头、结尾慢走）。\n"
        + f"主观用力不超过 {plan['effort_max']}/10，能轻松说完整句子；不追配速或距离，不跑步。\n"
        + f"安排依据：{plan['reason']}\n"
        + '运动前先看今天状态；如明显不适或环境不安全，回复说明情况，先暂停。'
        + '胸痛、明显气短、头晕近晕或异常心悸时停止，并及时求助就医。\n'
        + '完成后发送 Keep/B5 运动详情截图（可裁掉路线），加上用力程度、酸痛变化和异常症状；设备故障可以如实报告，不必补练。\n'
        + plan.get('feedback_instructions', timing)
    )


if __name__ == '__main__':
    state = json.loads(STATE.read_text(encoding='utf-8'))
    message = render(state, datetime.now(ZoneInfo(state['timezone'])))
    if message:
        print(message)
