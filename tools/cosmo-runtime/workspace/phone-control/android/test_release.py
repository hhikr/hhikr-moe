"""Compile current Java client and run release-mode assertions, no Android device required."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / 'test_permission_setup.py')], check=True)
from hermes_paths import hermes_path
from generate_parameters import generate
paths = json.loads(Path(os.environ.get('COSMO_TOOLCHAIN_PATHS') or hermes_path('/opt/hermes-hhikr/workspace/phone-control/toolchain/paths.json')).read_text())
java = Path(paths['java_home']) / 'bin'
android = paths['platforms;android-35']
output = ROOT / 'test-classes'
output.mkdir(exist_ok=True)
sources = sorted((ROOT / 'src').rglob('*.java'))
sources.append(generate(output))
subprocess.run([str(java / 'javac'), '-encoding', 'UTF-8', '--release', '8', '-classpath', android, '-d', str(output), *map(str, sources)], check=True)
classpath = str(output) + os.pathsep + android
for name in ['RuleEngineTest', 'LoginPolicyTest', 'BrowserAuthPolicyTest', 'BrowserAuthDisabledTest', 'PermissionSetupPolicyTest']:
    args = ['enabled'] if name == 'BrowserAuthDisabledTest' else []
    subprocess.run([str(java / 'java'), '-cp', classpath, 'moe.hhikr.cosmo.' + name, *args], check=True)
print('All five current-source Java release groups and permission integration checks passed')
