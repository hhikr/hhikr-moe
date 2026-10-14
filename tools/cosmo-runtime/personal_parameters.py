"""Personal values are supplied by the operator, never embedded here."""
import json
import os
from pathlib import Path

path = os.environ.get('COSMO_RULES_FILE')
if not path:
    raise RuntimeError('Set COSMO_RULES_FILE to an external rules JSON; tests use tests/rules.synthetic.json')
PARAMETERS = json.loads(Path(path).read_text(encoding='utf-8'))
