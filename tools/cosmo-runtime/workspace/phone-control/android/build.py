from hermes_paths import hermes_path
"""Compile, dex, align, sign and verify the Android artifact; no system install."""
import json
import base64
import hashlib
import os
from pathlib import Path
import secrets
import subprocess
import zipfile
import xml.etree.ElementTree as ET

ROOT=Path(hermes_path('/opt/hermes-hhikr/workspace/phone-control/android'))
from generate_parameters import generate
paths=json.loads(Path(os.environ.get('COSMO_TOOLCHAIN_PATHS') or hermes_path('/opt/hermes-hhikr/workspace/phone-control/toolchain/paths.json')).read_text())
keys=Path(os.environ.get('COSMO_SIGNING_DIR') or hermes_path('/opt/hermes-hhikr/workspace/phone-control/android/signing'))
password_file=keys/'password';store=keys/'release.jks'
if not password_file.is_file() or not store.is_file():
    raise RuntimeError('Existing external release signing files are required')
JAVA=Path(paths['java_home']);TOOLS=Path(paths['build-tools;35.0.0']);ANDROID=Path(paths['platforms;android-35'])
OUT=ROOT/'build';OUT.mkdir(exist_ok=True)
env=dict(os.environ,JAVA_HOME=str(JAVA),PATH=str(JAVA/'bin')+os.pathsep+os.environ['PATH'])

def run(*args):
    args = list(map(str, args))
    if os.name == 'nt':
        binary = Path(args[0])
        if binary.name in ('d8', 'apksigner'):
            args[0] += '.bat'
        elif binary.name in ('aapt2', 'zipalign', 'javac', 'keytool'):
            args[0] += '.exe'
    subprocess.run(args,check=True,env=env)

run(TOOLS/'aapt2','compile','--dir',ROOT/'res','-o',OUT/'resources.zip')
run(TOOLS/'aapt2','link','-I',ANDROID,'--manifest',ROOT/'AndroidManifest.xml','--min-sdk-version','26','--target-sdk-version','35',
    '-o',OUT/'base.apk',OUT/'resources.zip')
classes=OUT/'classes';classes.mkdir(exist_ok=True)
sources=[p for p in (ROOT/'src').rglob('*.java') if not p.name.endswith('Test.java')]
sources.append(generate(OUT))
run(JAVA/'bin/javac','-encoding','UTF-8','--release','8','-classpath',ANDROID,'-d',classes,*sources)
dex=OUT/'dex';dex.mkdir(exist_ok=True)
run(TOOLS/'d8','--lib',ANDROID,'--min-api','26','--output',dex,*classes.rglob('*.class'))
with zipfile.ZipFile(OUT/'base.apk','a') as archive:
    for file in dex.glob('*.dex'):archive.write(file,file.name)
run(TOOLS/'zipalign','-f','4',OUT/'base.apk',OUT/'aligned.apk')
env['COSMO_SIGNING_PASSWORD']=password_file.read_text()
version=ET.parse(ROOT/'AndroidManifest.xml').getroot().attrib['{http://schemas.android.com/apk/res/android}versionName']
artifact=ROOT.parent/('Cosmo-Focus-'+version+'.apk')
run(TOOLS/'apksigner','sign','--ks',store,'--ks-key-alias','cosmo-focus','--ks-pass','env:COSMO_SIGNING_PASSWORD',
    '--key-pass','env:COSMO_SIGNING_PASSWORD','--out',artifact,OUT/'aligned.apk')
run(TOOLS/'apksigner','verify','--verbose','--print-certs',artifact)
run(TOOLS/'aapt2','dump','badging',artifact)
print('APK:',artifact)
# Only the public, signed APK is exported; signing material stays in its original directory.
payload=artifact.read_bytes()
transfer=artifact.with_suffix('.transfer.json')
transfer.write_text(json.dumps({'filename':artifact.name,'sha256':hashlib.sha256(payload).hexdigest(),
    'base64':base64.b64encode(payload).decode('ascii')}),encoding='utf-8')
print('Public artifact transfer:',transfer.name)
