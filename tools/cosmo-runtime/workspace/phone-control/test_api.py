from hermes_paths import hermes_path
import importlib.util
import tempfile
import unittest
from pathlib import Path

P=Path(hermes_path('/opt/hermes-hhikr/state/plugins/cosmo-tasks/dashboard/api.py'))

class PhoneApiTests(unittest.TestCase):
    def test_rules_are_authenticated_and_device_status_is_not_fabricated(self):
        self.assertTrue(P.exists(),'private rule sync API missing')
        from fastapi import FastAPI, Request, HTTPException
        from fastapi.testclient import TestClient
        spec=importlib.util.spec_from_file_location('cosmo_api_test',P)
        m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        app=FastAPI()
        @app.middleware('http')
        async def fixture_gate(request:Request, call_next):
            # Real route contract, but a test-only session; never reads live credentials.
            app.state.auth_required=True
            if request.headers.get('X-Test-Owner')=='owner':request.state.session={'subject':'test-owner'}
            return await call_next(request)
        app.include_router(m.router)
        with tempfile.TemporaryDirectory(dir=hermes_path('/opt/hermes-hhikr/state/cache/scratch')) as directory:
            m.DEVICE_STATUS=Path(directory)/'device.json'
            client=TestClient(app)
            self.assertEqual(401,client.get('/rules').status_code)
            result=client.get('/rules',headers={'X-Test-Owner':'owner'})
            self.assertEqual(200,result.status_code)
            self.assertTrue(result.json()['allow_background_audio'])
            self.assertEqual('awaiting_device_setup_and_verification',result.json()['enforcement_status'])
            self.assertEqual(400,client.post('/device-status',headers={'X-Test-Owner':'owner'},json={'used_seconds':-1}).status_code)

if __name__=='__main__':unittest.main()
