"""Java regression entrypoint uses synthetic rules, never the personal rules file."""
import os
from pathlib import Path
import runpy
import sys
ROOT = Path(__file__).resolve().parents[1]
os.environ['COSMO_RULES_FILE'] = str(ROOT / 'tests/rules.synthetic.json')
android = ROOT / 'workspace/phone-control/android'
sys.path.insert(0, str(android))
runpy.run_path(str(android / 'test_release.py'), run_name='__main__')
