from hermes_paths import hermes_path
from personal_parameters import PARAMETERS as CONFIG
"""Three stages of one sleep Todo. Non-due cron combinations stay silent."""
import importlib.util
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

SETTINGS=Path(hermes_path('/opt/hermes-hhikr/workspace/sleep-plan/settings.json'))


def load(name):
    path=Path(hermes_path('/opt/hermes-hhikr/source/plugins/platforms/telegram'))/(name+'.py')
    spec=importlib.util.spec_from_file_location('cosmo_'+name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def render(now,root=None,start_night=None):
    local=now.astimezone(ZoneInfo(CONFIG['timezone']))
    settings=json.loads(SETTINGS.read_text(encoding='utf-8')) if SETTINGS.exists() else {}
    start_night=start_night or settings.get('start_night_date',local.date().isoformat())
    phase=None
    if local.hour==int(CONFIG['sleep']['night'][:2]) and int(CONFIG['sleep']['night'][3:])<=local.minute<int(CONFIG['sleep']['night'][3:])+15 and local.date().isoformat()>=start_night:phase='night'
    if local.hour==int(CONFIG['sleep']['morning'][:2]) and int(CONFIG['sleep']['morning'][3:])<=local.minute<int(CONFIG['sleep']['morning'][3:])+15 and local.date().isoformat()>start_night:phase='morning'
    if local.hour==int(CONFIG['sleep']['report'][:2]) and int(CONFIG['sleep']['report'][3:])<=local.minute<int(CONFIG['sleep']['report'][3:])+15 and local.date().isoformat()>start_night:phase='review'
    if phase is None:return '[SILENT]'
    store=load('task_store');cards=load('task_cards')
    root=Path(root) if root is not None else store.ROOT
    row=store.sleep_instance(local,root)
    def start(current):
        current['started']=True
        current.setdefault('started_at',local.isoformat())
        return current
    row=store.mutate(row['id'],start,root)
    if phase=='review':
        store.finalize(local,root);row=store.read(row['id'],root)
        if row.get('status') in ('completed','medical_hold','excused'):return '[SILENT]'
    return cards.encode_card(store.sleep_card(row,phase))


if __name__=='__main__':
    print(render(datetime.now(ZoneInfo(CONFIG['timezone']))))
