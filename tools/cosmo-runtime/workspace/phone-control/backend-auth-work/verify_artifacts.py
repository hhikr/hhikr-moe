"""Verify public APK certificate and staged association/Android declarations; no keystore reads."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent
phone=ROOT.parent
from hermes_paths import hermes_path
paths=json.loads(Path(os.environ.get('COSMO_TOOLCHAIN_PATHS') or hermes_path('/opt/hermes-hhikr/workspace/phone-control/toolchain/paths.json')).read_text())
env=dict(os.environ,JAVA_HOME=paths['java_home'],PATH=str(Path(paths['java_home'])/'bin')+os.pathsep+os.environ['PATH'])
version=ET.parse(phone/'android/AndroidManifest.xml').getroot().attrib['{http://schemas.android.com/apk/res/android}versionName']
apk=phone/('Cosmo-Focus-'+version+'.apk')
result=subprocess.run([str(Path(paths['build-tools;35.0.0'])/('apksigner.bat' if os.name == 'nt' else 'apksigner')),'verify','--verbose','--print-certs',str(apk)],check=True,capture_output=True,text=True,env=env)
digest=re.search(r'certificate SHA-256 digest: ([0-9a-f]+)',result.stdout).group(1)
gate=ROOT.parents[2].parent/'cosmo/gate'
asset=json.loads((gate/'association/assetlinks.json').read_text())
assert asset[0]['target']['sha256_cert_fingerprints'][0].replace(':','').lower()==digest
ns='{http://schemas.android.com/apk/res/android}'
manifest=ET.parse(phone/'android/AndroidManifest.xml').getroot()
assert manifest.attrib['package']==asset[0]['target']['package_name']
activity=manifest.find('application/activity')
links=[f for f in activity.findall('intent-filter') if f.attrib.get(ns+'autoVerify')=='true']
assert len(links)==1
assert links[0].find('data').attrib=={ns+'scheme':'https',ns+'host':'cosmo.hhikr.moe',ns+'path':'/android/auth/callback'}
tree=subprocess.run([str(Path(paths['build-tools;35.0.0'])/'aapt2'),'dump','xmltree','--file','AndroidManifest.xml',str(apk)],check=True,capture_output=True,text=True,env=env).stdout
assert 'autoVerify' in tree and '/android/auth/callback' in tree
badging=subprocess.run([str(Path(paths['build-tools;35.0.0'])/'aapt2'),'dump','badging',str(apk)],check=True,capture_output=True,text=True,env=env).stdout
assert "versionName='"+version+"'" in badging
assert "versionCode='"+manifest.attrib[ns+'versionCode']+"'" in badging
assert "name='"+manifest.attrib['package']+"'" in badging
expected_permissions={node.attrib[ns+'name'] for node in manifest.findall('uses-permission')}
actual_permissions=set(re.findall(r"uses-permission: name='([^']+)'",badging))
assert actual_permissions==expected_permissions, 'Actual APK permissions differ from current manifest'
source=(phone/'android/src/moe/hhikr/cosmo/BrowserAuth.java').read_text()
enabled=not version.endswith('-staged')
assert 'static final boolean AVAILABLE='+str(enabled).lower()+';' in source
if enabled:
    assert int(manifest.attrib[ns+'versionCode']) > 2
    previous=Path(hermes_path('/opt/hermes-hhikr/workspace/phone-control/Cosmo-Focus-0.2.0-staged.apk'))
    old=subprocess.run([str(Path(paths['build-tools;35.0.0'])/('apksigner.bat' if os.name == 'nt' else 'apksigner')),'verify','--print-certs',str(previous)],check=True,capture_output=True,text=True,env=env)
    assert re.search(r'certificate SHA-256 digest: ([0-9a-f]+)',old.stdout).group(1)==digest
print('Actual APK version/package/signature and exact App Link verified; same upgrade signature; browser authentication enabled='+str(enabled))
(ROOT/'APK_SHA256.txt').write_text(hashlib.sha256(apk.read_bytes()).hexdigest()+'  '+apk.name+'\n')
