"""HTTP test harness around actual task routes and imported Hermes auth functions."""
import ast, hmac, importlib.util, os, sys, tempfile, types
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[4]
sys.path[:0]=[str(ROOT),str(ROOT.parent/'hermes/source')]
if os.name=='nt':sys.path.insert(0,str(ROOT/'compat'))
os.environ['COSMO_RULES_FILE']=str(ROOT/'tests/rules.synthetic.json')
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
source=ROOT.parent/'hermes/source/hermes_cli/web_server.py'
module=types.ModuleType('hermes_cli.web_server')
module.__dict__.update(Request=Request,HTTPException=HTTPException,hmac=hmac,_SESSION_TOKEN='synthetic-private-hermes-key',_SESSION_HEADER_NAME='X-Hermes-Session-Token')
for name in ['_has_valid_session_token','_require_token']:
    node=next(n for n in ast.parse(source.read_text(encoding='utf-8')).body if isinstance(n,ast.FunctionDef) and n.name==name)
    exec(compile(ast.Module(body=[node],type_ignores=[]),str(source),'exec'),module.__dict__)
sys.modules['hermes_cli.web_server']=module
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def handle_request(self):
        if self.path=='/':
            self.send_response(200);self.end_headers();self.wfile.write(b'<script>window.__HERMES_SESSION_TOKEN__="synthetic-private-hermes-key"</script>');return
        if self.headers.get('Transfer-Encoding', '').lower() == 'chunked':
            chunks=[]
            while True:
                size=int(self.rfile.readline().strip().split(b';',1)[0],16)
                if not size:
                    self.rfile.readline();break
                chunks.append(self.rfile.read(size));self.rfile.read(2)
            body=b''.join(chunks)
        else:
            body=self.rfile.read(int(self.headers.get('Content-Length',0)))
        response=self.server.client.request(self.command,self.path,headers=dict(self.headers),content=body)
        self.send_response(response.status_code)
        for name,value in response.headers.items():self.send_header(name,value)
        self.end_headers();self.wfile.write(response.content)
    do_GET=handle_request
    do_POST=handle_request
if __name__=='__main__':
    with tempfile.TemporaryDirectory(prefix='cosmo-loopback-') as temporary:
        os.environ['COSMO_DATA_ROOT']=temporary
        path=ROOT/'state/plugins/cosmo-tasks/dashboard/api.py'
        spec=importlib.util.spec_from_file_location('existing_task_api',path)
        api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
        api._store=lambda:types.SimpleNamespace(list_records=lambda:[])
        app=FastAPI();app.state.auth_required=False
        app.include_router(api.router,prefix='/api/plugins/cosmo-tasks')
        with TestClient(app) as client:
            server=ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1])),Handler)
            server.client=client
            server.serve_forever()
