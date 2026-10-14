"""Verify copied source completeness and approved relocation/extraction changes."""
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
manifest = json.loads((ROOT / 'SOURCE_MANIFEST.json').read_text())
adaptations = json.loads((ROOT / 'ADAPTATIONS.json').read_text())
expected = {row['repository_path']: row for row in adaptations['files']}
for row in manifest['files']:
    relative = row['repository_path']
    target = (REPO / relative).resolve()
    assert target.is_relative_to(REPO), relative
    assert target.is_file(), 'Missing source: '+relative
    digest = hashlib.sha256(target.read_bytes().replace(b'\r\n',b'\n')).hexdigest()
    assert digest == expected[relative]['exported_text_sha256'], 'Changed since review: '+relative
    if digest != row['source_text_sha256']:
        assert expected[relative]['reason'] != 'unchanged', 'Unexplained source change: '+relative
for row in manifest['excluded']:
    assert row['reason']
    assert not (ROOT / row['path']).exists(), 'Excluded staged code accidentally imported'
print('Verified', len(manifest['files']), 'source mappings and', len(manifest['excluded']), 'explicit historical exclusions')
