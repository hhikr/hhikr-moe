"""Source integration checks for the ColorOS permission-entry fix."""
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parent
NS = '{http://schemas.android.com/apk/res/android}'
class PermissionSetupTests(unittest.TestCase):
    def test_manifest_has_only_required_runtime_permission(self):
        manifest = ET.parse(ROOT / 'AndroidManifest.xml').getroot()
        permissions = {p.attrib[NS+'name'] for p in manifest.findall('uses-permission')}
        self.assertIn('android.permission.POST_NOTIFICATIONS', permissions)
        self.assertEqual(permissions, {'android.permission.INTERNET', 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', 'android.permission.POST_NOTIFICATIONS'})
        service = manifest.find('application/service')
        self.assertEqual(service.attrib[NS+'permission'], 'android.permission.BIND_ACCESSIBILITY_SERVICE')
    def test_permission_prompt_and_result_are_wired_to_activity(self):
        helper = ROOT / 'src/moe/hhikr/cosmo/PermissionSetup.java'
        self.assertTrue(helper.exists(), 'runtime permission setup UI is missing')
        source = helper.read_text(encoding='utf-8')
        main = (ROOT / 'src/moe/hhikr/cosmo/MainActivity.java').read_text(encoding='utf-8')
        self.assertIn('PermissionSetup.open(this)', main)
        self.assertIn('PermissionSetup.onResult(this,', main)
        self.assertIn('activity.requestPermissions(', source)
        self.assertIn('PermissionSetupPolicy.mode(', source)
        self.assertIn('Settings.ACTION_APPLICATION_DETAILS_SETTINGS', source)
        self.assertIn('Settings.ACTION_APP_NOTIFICATION_SETTINGS', source)
        self.assertIn('Settings.ACTION_ACCESSIBILITY_SETTINGS', source)
        self.assertIn('解除所有授权限制', source)
        self.assertIn('权限管理', source)
        self.assertIn('NotificationChannel', source)
        self.assertIn('NotificationManager.IMPORTANCE_LOW', source)
        self.assertIn('PendingIntent.FLAG_IMMUTABLE', source)
        self.assertIn('已请求通知权限', source)
if __name__ == '__main__':
    unittest.main()
