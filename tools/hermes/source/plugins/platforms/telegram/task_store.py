from hermes_paths import hermes_path
from personal_parameters import PARAMETERS as CONFIG
"""Task-instance ledger; sleep and exercise have separate keys and storage."""
import fcntl
import json
import os
import re
import tempfile
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(hermes_path('/opt/hermes-hhikr/workspace/task-ledger'))
EXERCISE=Path(hermes_path('/opt/hermes-hhikr/workspace/activity-coach/history'))
ZONE=ZoneInfo(CONFIG['timezone'])


def _path(instance_id, root):
    if not re.fullmatch(r'daily-sleep-\d{4}-\d{2}-\d{2}',instance_id):
        raise ValueError('Unsupported task instance')
    datetime.fromisoformat(instance_id[-10:])
    return Path(root)/(instance_id+'.json')


def read(instance_id, root=ROOT):
    if instance_id.startswith('daily-exercise-'):
        day=instance_id[-10:]
        datetime.fromisoformat(day)
        row=json.loads((EXERCISE/(day+'.json')).read_text(encoding='utf-8'))
        if row.get('id')!=instance_id:raise ValueError('Instance mismatch')
        return row
    return json.loads(_path(instance_id,root).read_text(encoding='utf-8'))


def mutate(instance_id, fn, root=ROOT):
    folder=Path(root);folder.mkdir(parents=True,exist_ok=True)
    target=_path(instance_id,folder)
    with (folder/'.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        row=json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
        result=fn(row)
        with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=folder,delete=False) as handle:
            json.dump(result,handle,ensure_ascii=False,indent=2);handle.write('\n');handle.flush();os.fsync(handle.fileno())
            temporary=handle.name
        os.replace(temporary,target)
        return result


def sleep_instance(now, root=ROOT):
    local=now.astimezone(ZONE)
    day=(local.date()+timedelta(days=1) if local.hour>=12 else local.date()).isoformat()
    instance='daily-sleep-'+day
    return mutate(instance, lambda row: row or {'id':instance,'task_type':'sleep','title':'规律作息','date':day,
        'status':'pending','started':False,'events':[], 'evidence_level':'self_report',
        'prepare_deadline':day+'T'+CONFIG['sleep']['prepare']+':00'+CONFIG['offset'],'wake_deadline':day+'T'+CONFIG['sleep']['wake']+':00'+CONFIG['offset'],
        'deadline':day+'T'+CONFIG['sleep']['report']+':00'+CONFIG['offset']}, root)


def _assess(row, now):
    if not row.get('started'):
        return row
    events=row.get('events',[])
    prepared=[e for e in events if e['action']=='prepare']
    awake=[e for e in events if e['action']=='awake']
    if row.get('status') in ('excused','medical_hold','failed'):
        return row
    prepare_ok=bool(prepared and prepared[0]['at']<=row['prepare_deadline'])
    awake_ok=bool(awake and awake[0]['at']<=row['wake_deadline'])
    report_ok=bool(row.get('sleep_report') and row.get('reported_at','')<=row['deadline'])
    if prepare_ok and awake_ok and report_ok:
        row['status']='completed'
        row['completed_at']=now.isoformat()
    elif now.isoformat()>row['deadline'] and row.get('status')!='completed':
        row['status']='awaiting_confirmation'
        row['review_reason']='睡前准备、离床或晨间报告未完整记录；需要核实实际行为和例外'
    return row


def apply_event(instance_id, action, event_id, now, root=ROOT):
    if action not in ('prepare','awake','not_sleepy','delay','unwell','unexcused_failure'):
        raise ValueError('Unsupported event')
    local=now.astimezone(ZONE)
    def change(row):
        if row is None:raise FileNotFoundError(instance_id)
        if action=='awake' and local.date().isoformat()!=row['date']:
            raise ValueError('Morning check-in belongs to the wake date')
        row['started']=True
        if not any(e['id']==event_id for e in row['events']):
            row['events'].append({'id':event_id,'action':action,'at':local.isoformat()})
        if action=='unwell' and row['status']!='completed':row['status']='medical_hold'
        if action=='unexcused_failure' and row['status']!='completed':
            row.update(status='failed',reason='unexcused_incomplete',confirmed_at=local.isoformat())
        return _assess(row,local)
    return mutate(instance_id,change,root)


def report_sleep(instance_id, report, now, root=ROOT):
    cleaned={}
    for key in ('sleep_time','wake_time'):
        value=report.get(key,'')
        if not re.fullmatch(r'\d{2}:\d{2}',str(value)):raise ValueError('Time must be HH:MM')
        time.fromisoformat(value);cleaned[key]=value
    energy=int(report.get('energy',3))
    if not 1<=energy<=5:raise ValueError('Energy must be 1..5')
    cleaned['energy']=energy
    cleaned['notes']=str(report.get('notes',''))[:600]
    local=now.astimezone(ZONE)
    def change(row):
        if row is None:raise FileNotFoundError(instance_id)
        if local.date().isoformat()<row['date']:
            raise ValueError('Sleep report cannot describe a future morning')
        row['sleep_report']=cleaned;row['reported_at']=local.isoformat()
        return _assess(row,local)
    return mutate(instance_id,change,root)


def list_records(root=ROOT):
    rows=[json.loads(p.read_text(encoding='utf-8')) for p in Path(root).glob('daily-sleep-*.json')]
    rows.extend(json.loads(p.read_text(encoding='utf-8')) for p in EXERCISE.glob('????-??-??.json'))
    return sorted(rows,key=lambda r:(r.get('date',''),r.get('id','')))


def finalize(now,root=ROOT):
    for path in Path(root).glob('daily-sleep-*.json'):
        mutate(path.stem,lambda row:_assess(row,now.astimezone(ZONE)),root)


def sleep_card(row, phase):
    complete=row.get('status')=='completed'
    status='已完成' if complete else ('进行中' if row.get('started') else '今晚开始')
    text=f"<b>🌙 规律作息</b>\n{row['date']} · {status}\n\n"
    if complete:
        text+='昨晚的记录齐了。今天留意一下精神怎么样，有变化再告诉我。\n'
    elif row.get('status') in ('medical_hold','excused'):
        text+='今天先照顾身体，原来的安排放一放。等舒服些，再告诉我昨晚睡得怎么样。\n'
    elif phase=='night':
        text+=CONFIG['sleep']['night_text']
    elif phase=='review':
        text+='昨晚的记录还有些没收到：大概几点睡着、几点离床，现在精神怎么样？直接告诉我就好。\n'
    else:
        text+=CONFIG['sleep']['morning_text']
    text+='\n<i>Cosmo</i>'
    groups=([ [('📵 已开始准备','prepare'),('🌙 还不困','not_sleepy')],
              [('📱 仍在刷／申请延后','delay'),('😴 不舒服','unwell')], [('📊 查看进度','progress')] ]
            if phase=='night' else
            [ [('☀️ 已离床','awake'),('📝 提交睡眠记录','sleep_report')],
              [('😴 不舒服','unwell'),('📊 查看进度','progress')] ])
    return {'instance_id':row['id'],'date':row['date'],'text':text,
        'buttons':[[{'text':title,'callback_data':f"tc:{row['id']}:{action}"} for title,action in group] for group in groups]}
