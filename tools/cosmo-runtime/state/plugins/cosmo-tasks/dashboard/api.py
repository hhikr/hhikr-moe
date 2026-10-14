from hermes_paths import hermes_path
from personal_parameters import PARAMETERS as CONFIG
from datetime import datetime
import importlib.util
import json
import math
import os
from pathlib import Path
import tempfile
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Request

BASE=Path(hermes_path('/opt/hermes-hhikr/workspace/phone-control'))
DEVICE_STATUS=Path(hermes_path('/opt/hermes-hhikr/workspace/phone-control/device-status.json'))
spec=importlib.util.spec_from_file_location('cosmo_phone_policy',hermes_path('/opt/hermes-hhikr/workspace/phone-control/policy.py'))
policy=importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)


def require_owner(request:Request):
    from hermes_cli.web_server import _require_token
    _require_token(request)

router=APIRouter(dependencies=[Depends(require_owner)])


def _store():
    from plugins.platforms.telegram import task_store
    return task_store


@router.get('/rules')
def rules():
    now=datetime.now(ZoneInfo(CONFIG['timezone']))
    records=_store().list_records()
    result=policy.evaluate(now.date().isoformat(),records)
    result['client_schema_version']=1
    if DEVICE_STATUS.exists():
        device=json.loads(DEVICE_STATUS.read_text(encoding='utf-8'))
        result['device_last_seen']=device.get('received_at')
        if device.get('device_test_passed') and device.get('enabled') and device.get('service_active'):
            age=(now-datetime.fromisoformat(device['received_at'])).total_seconds()
            if 0<=age<=1800:result['enforcement_status']='owner_verified_device_report'
    return result


@router.get('/download')
def download():
    from fastapi.responses import FileResponse
    path=BASE/'Cosmo-Focus-0.1.0.apk'
    if not path.is_file():raise HTTPException(503,'安装包尚未完成构建')
    return FileResponse(path,filename=path.name,media_type='application/vnd.android.package-archive')


@router.get('/tasks')
def tasks():
    return {'tasks':_store().list_records()}


@router.get('/sleep/current')
def sleep_current():
    row=_store().sleep_instance(datetime.now(ZoneInfo(CONFIG['timezone'])))
    return {'task':row}


@router.post('/sleep/report')
async def sleep_report(request:Request):
    body=await request.json()
    try:
        row=_store().report_sleep(body['instance_id'],body,datetime.now(ZoneInfo(CONFIG['timezone'])))
    except FileNotFoundError:
        raise HTTPException(404,'当日作息任务尚未创建，请先查看任务通知')
    except (ValueError,KeyError,TypeError):
        raise HTTPException(400,'时间须为 HH:MM，精神状态为 1–5；实例必须有效')
    return {'saved':True,'task':row}


@router.post('/device-status')
async def device_status(request:Request):
    body=await request.json()
    used=body.get('used_seconds')
    if isinstance(used,bool) or not isinstance(used,(int,float)) or not math.isfinite(used) or not 0<=used<=86400:
        raise HTTPException(400,'Invalid usage')
    target=body.get('target_package','')
    if not isinstance(target,str) or len(target)>150 or (target and 'bili' not in target.lower()):
        raise HTTPException(400,'Only the selected Bilibili package is supported')
    fields=('client_version','date','used_seconds','enabled','service_active','rules_applied','device_test_passed','target_package')
    row={key:body.get(key) for key in fields}
    for key in ('enabled','service_active','rules_applied','device_test_passed'):
        if type(row.get(key)) is not bool:raise HTTPException(400,'Boolean state required')
    row['received_at']=datetime.now(ZoneInfo(CONFIG['timezone'])).isoformat()
    row['evidence_level']='client_report_and_owner_attestation'
    DEVICE_STATUS.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=DEVICE_STATUS.parent,delete=False) as handle:
        json.dump(row,handle,ensure_ascii=False,indent=2);handle.flush();os.fsync(handle.fileno());temporary=handle.name
    os.replace(temporary,DEVICE_STATUS)
    return {'saved':True,'enforcement_verified':bool(row['enabled'] and row['service_active'] and row['device_test_passed'])}
