"""Run relocated regressions with synthetic data and actual imported auth functions."""
import ast
import hmac
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from fastapi import HTTPException, Request

ROOT = Path(__file__).resolve().parents[1]
os.environ['COSMO_RULES_FILE'] = str(ROOT / 'tests/rules.synthetic.json')
source = ROOT.parent / 'hermes/source/hermes_cli/web_server.py'
module = types.ModuleType('hermes_cli.web_server')
module.__dict__.update(Request=Request, HTTPException=HTTPException, hmac=hmac,
                      _SESSION_TOKEN='synthetic-test-only', _SESSION_HEADER_NAME='X-Hermes-Session-Token')
tree = ast.parse(source.read_text(encoding='utf-8'))
for name in ('_has_valid_session_token', '_require_token'):
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(source), 'exec'), module.__dict__)
sys.modules['hermes_cli.web_server'] = module
telegram = types.ModuleType('plugins.platforms.telegram')
telegram.__path__ = [str(ROOT.parent / 'hermes/source/plugins/platforms/telegram')]
sys.modules['plugins.platforms.telegram'] = telegram
with tempfile.TemporaryDirectory(prefix='cosmo-tests-') as temporary:
    os.environ['COSMO_DATA_ROOT'] = temporary
    os.environ['HERMES_HOME'] = str(Path(temporary) / 'state')
    import shutil
    scripts = Path(temporary) / 'state/scripts'
    scripts.mkdir(parents=True)
    shutil.copyfile(ROOT / 'state/scripts/activity_encoding_probe.py', scripts / 'activity_encoding_probe.py')
    scratch = Path(temporary) / 'state/cache/scratch'
    scratch.mkdir(parents=True)
    for rel in ('workspace/task-ledger', 'workspace/activity-coach/history'):
        (Path(temporary) / rel).mkdir(parents=True)
    from datetime import datetime
    from personal_parameters import PARAMETERS
    from zoneinfo import ZoneInfo
    day = datetime.now(ZoneInfo(PARAMETERS['timezone'])).date().isoformat()
    state = {'timezone': PARAMETERS['timezone'], 'start_date':day, 'program_status':'active',
             'records': [], 'leaves': [], 'consequences':{'enabled':False},
             'next_plan':{'kind':'walk','valid_on':day,'minutes':4,'effort_max':2,'reason':'synthetic test'}}
    (Path(temporary) / 'workspace/activity-coach/state.json').write_text(json.dumps(state),encoding='utf-8')
    suite = unittest.TestSuite()
    for folder in ['workspace/phone-control', 'workspace/activity-coach', 'workspace/phone-control/backend-auth-work/tests', 'tests']:
        suite.addTests(unittest.defaultTestLoader.discover(str(ROOT / folder), pattern='test_*.py', top_level_dir=str(ROOT / folder)))
    success = unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful()
    raise SystemExit(0 if success else 1)
