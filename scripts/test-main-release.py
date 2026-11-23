import importlib.util
import sys
sys.dont_write_bytecode = True
from pathlib import Path, PurePosixPath
import re
import unittest

spec = importlib.util.spec_from_file_location('packager', Path(__file__).with_name('package-main-release.py'))
pkg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pkg)

class BackupPackageTest(unittest.TestCase):
    def test_backup_entry_and_local_imports_are_shipped(self):
        members = pkg.build_specs()['website']['members']
        pending = ['scripts/backup.mjs']
        visited = set()
        while pending:
            item = pending.pop()
            if item in visited:
                continue
            visited.add(item)
            self.assertTrue(item in members, f'missing backup runtime file: {item}')
            text = (pkg.ROOT / item).read_text(encoding='utf-8')
            for rel in re.findall(r"(?:from\s+|import\s*)['\"]([^'\"]+)['\"]", text):
                if rel.startswith('.'):
                    resolved = (pkg.ROOT / PurePosixPath(item).parent / rel).resolve()
                    pending.append(resolved.relative_to(pkg.ROOT).as_posix())

if __name__ == '__main__':
    unittest.main(verbosity=2)
