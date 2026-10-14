"""Resolve original paths to relocated source or explicitly external data."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HERMES_SOURCE = ROOT.parent / 'hermes/source'

def hermes_path(value):
    prefix = '/opt/hermes-hhikr'
    if value != prefix and not value.startswith(prefix + '/'):
        return value
    relative = value[len(prefix):].lstrip('/')
    candidate = ROOT / relative
    if candidate.is_file() or relative in ('workspace/phone-control/android', 'state/scripts'):
        return str(candidate)
    if relative.startswith('source/'):
        return str(HERMES_SOURCE / relative[len('source/'):])
    data = os.environ.get('COSMO_DATA_ROOT')
    if not data:
        raise RuntimeError('Set COSMO_DATA_ROOT to an external data directory')
    return str(Path(data) / relative)
