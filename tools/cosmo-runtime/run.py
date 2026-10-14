"""Development entrypoint for relocated code; no services or rules are installed."""
import os
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / 'hermes/source'
sys.path[:0] = [str(ROOT), str(SOURCE)]
if os.name == 'nt':
    sys.path.insert(0, str(ROOT / 'compat'))
os.environ['PYTHONPATH'] = os.pathsep.join([str(ROOT), str(SOURCE), *([str(ROOT / 'compat')] if os.name == 'nt' else []), os.environ.get('PYTHONPATH', '')])

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('Usage: python tools/cosmo-runtime/run.py <runtime-relative script.py> [args]')
    target = (ROOT / sys.argv[1]).resolve()
    if not target.is_relative_to(ROOT) or not target.is_file():
        raise SystemExit('Script must be an existing file in tools/cosmo-runtime')
    sys.argv = [str(target), *sys.argv[2:]]
    sys.path.insert(0, str(target.parent))
    runpy.run_path(str(target), run_name='__main__')
