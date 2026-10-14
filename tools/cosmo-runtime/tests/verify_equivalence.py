"""Optional relocation parity check against an operator's external original source."""
import importlib.util, itertools, json, os, subprocess, sys, tempfile
from pathlib import Path
from datetime import datetime, timedelta
from personal_parameters import PARAMETERS as CONFIG
ROOT=Path(__file__).resolve().parents[1]
original=Path(sys.argv[1]).resolve()
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module
old=load('original_phone_policy',original/'workspace/phone-control/policy.py')
new=load('relocated_phone_policy',ROOT/'workspace/phone-control/policy.py')
rows=[[],[{'date':'2030-01-01','status':'failed','reason':'unexcused_incomplete','id':'fixture'}],
      [{'date':'2030-01-01','status':'failed','reason':'illness'}]]
checks=0
for day in ['2030-01-01','2030-01-02','2030-01-03']:
    for records in rows:
        assert old.evaluate(day,records)==new.evaluate(day,records);checks+=1
for minute,used,flags in itertools.product(range(1440),[0,CONFIG['phone']['reduced_minutes']*60,CONFIG['phone']['normal_minutes']*60],itertools.product([False,True],repeat=3)):
    at=(datetime.fromisoformat('2030-01-02T00:00:00'+CONFIG['offset'])+timedelta(minutes=minute)).isoformat()
    kw=dict(screen_interactive=flags[0],unlocked=flags[1],bilibili_visible=flags[2],outcomes=rows[1])
    assert old.access_decision(at,used,**kw)==new.access_decision(at,used,**kw);checks+=1
print('Python original/relocated behavior identical:',checks,'comparisons')
paths=json.loads(Path(os.environ.get('COSMO_TOOLCHAIN_PATHS') or original/'workspace/phone-control/toolchain/paths.json').read_text())
java=Path(paths['java_home'])/'bin'
sys.path.insert(0,str(ROOT/'workspace/phone-control/android'))
from generate_parameters import generate
probe='''package moe.hhikr.cosmo;
public class EquivalenceProbe {
 public static void main(String[] args) {
  int normal=Integer.parseInt(args[0]),reduced=Integer.parseInt(args[1]);
  StringBuilder result=new StringBuilder();
  for(int minute=0;minute<1440;minute++) for(int limit:new int[]{normal,reduced})
   for(long used:new long[]{0,(normal-1)*60L,normal*60L,(reduced-1)*60L,reduced*60L}) for(int flags=0;flags<16;flags++) {
    RuleEngine.Decision d=RuleEngine.decide(minute/60,minute%60,used,limit,(flags&1)!=0,(flags&2)!=0,(flags&4)!=0,(flags&8)!=0);
    result.append(d.block?'1':'0').append(d.count?'1':'0').append(d.forceStop?'1':'0');
   }
  for(int saved:new int[]{normal,reduced,1}) result.append(RuleEngine.dailyLimit("2030-01-02","2030-01-01",saved)).append(RuleEngine.dailyLimit("2030-01-02","2030-01-02",saved));
  System.out.print(result);
 }
}'''
with tempfile.TemporaryDirectory(prefix='cosmo-parity-') as temporary:
    work=Path(temporary); test=work/'EquivalenceProbe.java';test.write_text(probe,encoding='utf-8')
    outputs=[]
    for index,base in enumerate([original,ROOT]):
        classes=work/str(index);classes.mkdir()
        sources=[base/'workspace/phone-control/android/src/moe/hhikr/cosmo/RuleEngine.java',test]
        if index:sources.append(generate(classes))
        subprocess.run([str(java/'javac'),'--release','8','-encoding','UTF-8','-d',str(classes),*map(str,sources)],check=True)
        outputs.append(subprocess.check_output([str(java/'java'),'-cp',str(classes),'moe.hhikr.cosmo.EquivalenceProbe',str(CONFIG['phone']['normal_minutes']),str(CONFIG['phone']['reduced_minutes'])]))
    assert outputs[0]==outputs[1]
    print('Java original/relocated behavior identical:',1440*2*5*16,'decision cases plus quota date checks')
