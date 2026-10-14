"""Generate build-local Java constants from the external operator parameters."""
import json
from pathlib import Path
from personal_parameters import PARAMETERS as CONFIG

def generate(output):
    phone = CONFIG['phone']
    def clock(value):
        hour, minute = map(int, value.split(':'))
        return hour * 60 + minute
    fields = {'NORMAL_MINUTES': phone['normal_minutes'], 'REDUCED_MINUTES': phone['reduced_minutes'],
              'NIGHT_START': clock(phone['night_start']), 'NIGHT_END': clock(phone['night_end']),
              'TIMEZONE': CONFIG['timezone'], 'DESCRIPTION': phone['description'], 'WAKE_HINT': CONFIG['sleep']['morning']}
    lines = ['package moe.hhikr.cosmo;', 'public final class PersonalRules {']
    for key, value in fields.items():
        kind = 'String' if isinstance(value, str) else 'int'
        lines.append('public static final '+kind+' '+key+'='+json.dumps(value, ensure_ascii=False)+';')
    lines.append('}')
    target = Path(output) / 'generated/PersonalRules.java'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('\n'.join(lines)+'\n', encoding='utf-8')
    return target
