import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createAuth } from '../../../../../cosmo/gate/auth.mjs';
import { createNative, CALLBACK, CLIENT_ID } from '../../../../../cosmo/gate/native.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STATE = 's'.repeat(43), verifier = 'v'.repeat(43), challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const fakeKey = 'synthetic-website-secret-not-production-0123456789';
let siteServer, backend, child, gatePort, tmp, browser, role = 'endmin', valid = true, outage = false, siteLoggedIn = false;
let requestedReturn, forwarded, logs = '';
const issued = new Set(), grants = new Set();
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));
const origin = 'https://cosmo.hhikr.moe';
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json' });res.end(JSON.stringify(value)); }
async function gate(url, { method='GET', headers={}, body, jar=browser }={}) {
 const cookie = jar ? [...jar].map(([k,v]) => `${k}=${v}`).join('; ') : '';
 const r = await new Promise((resolve,reject)=>{
  const request=http.request({hostname:'127.0.0.1',port:gatePort,path:url,method,headers:{Host:'cosmo.hhikr.moe',...(cookie?{Cookie:cookie}:{}),...headers}},response=>{
   const chunks=[];response.on('data',b=>chunks.push(b));response.on('end',()=>{
    const text=Buffer.concat(chunks).toString();const h=new Headers();
    for(const [k,v] of Object.entries(response.headers))for(const value of [].concat(v??[]))h.append(k,value);
    resolve({status:response.statusCode,headers:h,text:async()=>text,json:async()=>JSON.parse(text)});
   });response.on('error',reject);
  });request.on('error',reject);if(body!==undefined)request.write(body);request.end();
 });
 if (jar) for (const line of r.headers.getSetCookie()) { const pair=line.split(';')[0];const at=pair.indexOf('=');if(at>=0)jar.set(pair.slice(0,at),pair.slice(at+1)); }
 return r;
}
const params = changes => new URLSearchParams({ code_challenge_method:'S256', code_challenge:challenge, state:STATE, redirect_uri:CALLBACK, ...changes });
async function walk(jar=new Map()) {
 let r=await gate('/auth/native/authorize?'+params(),{jar});assert.equal(r.status,302);
 let siteUrl=r.headers.get('location');assert.match(siteUrl,/\/api\/auth\/cosmo\?state=[A-Za-z0-9_-]{43}$/);
 r=await fetch(siteUrl,{redirect:'manual'});
 if(r.headers.get('location')?.startsWith('/login/')) {
  r=await fetch(new URL(r.headers.get('location'),siteUrl),{redirect:'manual'});
  assert.match(requestedReturn,/^\/api\/auth\/cosmo\?state=[A-Za-z0-9_-]{43}$/);
  r=await fetch(new URL(r.headers.get('location'),siteUrl),{redirect:'manual'});
 }
 assert.equal(r.status,302);const callback=new URL(r.headers.get('location'));
 r=await gate(callback.pathname+callback.search,{jar});assert.equal(r.status,302);
 assert.match(r.headers.get('location'),/^\/auth\/native\/authorize\?request=[A-Za-z0-9_-]{43}$/);
 r=await gate(r.headers.get('location'),{jar});assert.equal(r.status,302);
 const link=new URL(r.headers.get('location'));assert.equal(link.origin+link.pathname,CALLBACK);assert.equal(link.searchParams.get('state'),STATE);
 return { code:link.searchParams.get('code'), jar };
}
const token = (code, fields={}, extra={}) => gate('/auth/native/token',{ method:'POST',jar:null,headers:{'Content-Type':'application/json',...extra},body:JSON.stringify({code,code_verifier:verifier,redirect_uri:CALLBACK,client_id:CLIENT_ID,...fields}) });
async function access() { const {code,jar}=await walk();browser=jar;const r=await token(code);assert.equal(r.status,200);return (await r.json()).access_token; }

before(async()=>{
 tmp=await fs.mkdtemp(path.join(os.tmpdir(),'cosmo-auth-test-'));await fs.writeFile(path.join(tmp,'index.html'),'<html>test renderer</html>');
 siteServer=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://test');
  if(url.pathname==='/api/auth/cosmo') {
   if(!/^[A-Za-z0-9_-]{22,64}$/.test(url.searchParams.get('state')??'') || role!=='endmin')return res.writeHead(404),res.end();
   if(!siteLoggedIn)return res.writeHead(302,{Location:'/login/?return='+encodeURIComponent(url.pathname+url.search)}),res.end();
   const code=crypto.randomBytes(32).toString('base64url');issued.add(code);
   return res.writeHead(302,{Location:origin+'/auth/callback?'+new URLSearchParams({code,state:url.searchParams.get('state')})}),res.end();
  }
  if(url.pathname==='/login/') { requestedReturn=url.searchParams.get('return');siteLoggedIn=true;return res.writeHead(302,{Location:requestedReturn.startsWith('/api/auth/cosmo?')?requestedReturn:'/endmin/'}),res.end(); }
  if(url.pathname==='/api/internal/cosmo') {
   if(req.headers.authorization!==`Bearer ${fakeKey}`)return json(res,403,{});
   if(outage)return json(res,503,{});
   let text='';for await(const b of req)text+=b;const data=JSON.parse(text);
   if(data.action==='redeem') {
    if(!issued.delete(data.code)||role!=='endmin')return json(res,403,{ok:false});
    const grant=crypto.randomBytes(32).toString('base64url');grants.add(grant);return json(res,200,{ok:true,grant,user:{role:'endmin'}});
   }
   if(data.action==='check')return json(res,200,{valid:valid&&role==='endmin'&&grants.has(data.grant)});
   if(data.action==='revoke'){grants.delete(data.grant);return json(res,200,{ok:true});}
  }
  res.writeHead(404);res.end();
 });
 const sitePort=await listen(siteServer);
 backend=http.createServer(async(req,res)=>{
  if(req.url==='/')return res.end('<script>window.__HERMES_SESSION_TOKEN__="synthetic-private-hermes-key"</script>');
  let text='';for await(const b of req)text+=b;
  forwarded={path:req.url,headers:req.headers,body:text};
  if(req.headers['x-hermes-session-token']!=='synthetic-private-hermes-key')return json(res,401,{});
  return json(res,200,{ok:true,date:'2026-10-13',daily_limit_minutes:60,saved:true});
 });
 const backendPort=await listen(backend);
 const probe=http.createServer();gatePort=await listen(probe);await close(probe);
 child=spawn(process.execPath,[path.resolve(root,'../../../../cosmo/gate/server.mjs')],{cwd:tmp,env:{PATH:process.env.PATH,COSMO_AUTH:'site',COSMO_LISTEN:`127.0.0.1:${gatePort}`,COSMO_PUBLIC_ORIGIN:origin,COSMO_SITE_PUBLIC:`http://127.0.0.1:${sitePort}`,COSMO_SITE_INTERNAL:`http://127.0.0.1:${sitePort}`,COSMO_HERMES:`http://127.0.0.1:${backendPort}`,COSMO_GATE_SECRET:fakeKey,COSMO_STATIC_DIR:tmp}});
 child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let i=0;i<100;i++){try{const r=await gate('/.well-known/assetlinks.json',{jar:null});if(r.status===200)break;}catch{}await new Promise(r=>setTimeout(r,20));}
 browser=new Map();
});
after(async()=>{ if(child){child.kill();await new Promise(r=>child.once('exit',r));}await close(siteServer);await close(backend);await fs.rm(tmp,{recursive:true,force:true}); });

test('actual staged gate: website state/return -> gate -> Android PKCE -> private Hermes forwarding',async()=>{
 const {code}=await walk();const r=await token(code);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const data=await r.json();assert.deepEqual(Object.keys(data).sort(),['access_token','expires_at','token_type']);assert.equal(data.token_type,'Bearer');
 for(const [method,p] of [['GET','/api/plugins/cosmo-tasks/rules'],['POST','/api/plugins/cosmo-tasks/device-status'],['POST','/api/plugins/cosmo-tasks/sleep/report']]) {
  const response=await gate(p,{method,jar:null,headers:{Authorization:`Bearer ${data.access_token}`,Origin:origin,...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?'{}':undefined});
  assert.equal(response.status,200);assert.equal(forwarded.headers.authorization,undefined);assert.equal(forwarded.headers.cookie,undefined);
  assert.equal(forwarded.headers['x-hermes-session-token'],'synthetic-private-hermes-key');assert.equal((await response.text()).includes('synthetic-private-hermes-key'),false);
 }
 assert.equal((await token(code)).status,400);
});
test('bearer scope denies broader API/admin and ignores browser-cookie fallback',async()=>{
 const bt=await access();
 for(const p of ['/api/config','/api/plugins/cosmo-tasks/tasks','/admin/api/plugins/cosmo-tasks/rules','/api/plugins/cosmo-tasks/rules?token=bad'])assert.equal((await gate(p,{headers:{Authorization:`Bearer ${bt}`},jar:null})).status,403);
 assert.equal((await gate('/api/plugins/cosmo-tasks/rules',{headers:{Authorization:'Bearer invalid'},jar:browser})).status,401);
});
test('wrong PKCE or client binding consumes authorization',async()=>{
 for(const field of [{code_verifier:'x'.repeat(43)},{code_verifier:''},{code_verifier:verifier+'\n'},{client_id:'wrong'},{redirect_uri:'https://evil.test/cb'}]) {
  const {code}=await walk();assert.equal((await token(code,field)).status,400);assert.equal((await token(code)).status,400);
 }
});
test('concurrent token exchange has exactly one winner',async()=>{
 const {code}=await walk();const responses=await Promise.all(Array.from({length:5},()=>token(code)));
 assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===400).length,4);
});
test('website revoke/role change invalidates native token, outage fails closed',async()=>{
 let bt=await access();outage=true;
 assert.equal((await gate('/api/plugins/cosmo-tasks/rules',{jar:null,headers:{Authorization:`Bearer ${bt}`}})).status,503);
 outage=false;assert.equal((await gate('/api/plugins/cosmo-tasks/rules',{jar:null,headers:{Authorization:`Bearer ${bt}`}})).status,200);
 role='member';assert.equal((await gate('/api/plugins/cosmo-tasks/rules',{jar:null,headers:{Authorization:`Bearer ${bt}`}})).status,401);role='endmin';
 const {code}=await walk();valid=false;assert.equal((await token(code)).status,401);assert.equal((await token(code)).status,400);valid=true;
});
test('public association and query-free landing before auth; browser flow preserved',async()=>{
 assert.equal((await gate('/auth/native/token',{jar:null})).status,405);
 const r=await gate('/.well-known/assetlinks.json',{jar:null});assert.equal(r.status,200);assert.equal(r.headers.get('location'),null);assert.equal((await r.json())[0].target.package_name,CLIENT_ID);
 const landing=await gate('/android/auth/callback?code=synthetic-sensitive-value&state=secret',{jar:null});assert.equal(landing.status,200);assert.equal((await landing.text()).includes('synthetic-sensitive-value'),false);
 const normal=new Map();let begin=await gate('/',{jar:normal});assert.equal(begin.status,302);
 const fromSite=await fetch(begin.headers.get('location'),{redirect:'manual'});const cb=new URL(fromSite.headers.get('location'));
 const done=await gate(cb.pathname+cb.search,{jar:normal});assert.equal(done.status,302);assert.equal(done.headers.get('location'),'/');
 assert.equal((await gate('/',{jar:normal})).status,200);
});
test('invalid requests, state, body size and cross-origin writes rejected without echo',async()=>{
 for(const changes of [{state:'short'},{redirect_uri:CALLBACK+'?x=1'},{code_challenge_method:'plain'},{code_challenge:'bad'},{state:STATE+'\n'},{code_challenge:challenge+'\n'}])assert.equal((await gate('/auth/native/authorize?'+params(changes),{jar:null})).status,400);
 assert.equal((await gate('/auth/native/authorize?'+params()+'&state='+STATE,{jar:null})).status,400);
 assert.equal((await gate('/auth/callback?state=bad&code='+'c'.repeat(43),{jar:new Map()})).status,400);
 assert.equal((await gate('/auth/callback?state='+'é'.repeat(43)+'&code='+'c'.repeat(43),{jar:new Map()})).status,400);
 const big=await gate('/auth/native/token',{method:'POST',jar:null,headers:{'Content-Type':'application/json'},body:'x'.repeat(4097)});assert.equal(big.status,413);
 assert.equal((await token('unknown',{}, {Origin:'https://evil.test'})).status,403);
 assert.equal(logs.includes('synthetic-sensitive-value'),false);assert.equal(logs.includes('synthetic-private-hermes-key'),false);assert.equal(logs.includes(fakeKey),false);
});

test('broker expiry/restart and default refusal independent of production identities',async()=>{
 let clock=1000,checks=true;
 const fakeAuth={ nativeSession:async()=>({id:'synthetic',expires:99999999}), nativeSessionById:async()=>checks?{id:'synthetic',expires:99999999}:undefined };
 const native=createNative({auth:'site',publicOrigin:origin},fakeAuth,{now:()=>clock});
 async function dispatch(broker,pathname,{method='GET',data}={}) {
  let status,location,text='';const res={writeHead(s,h){status=s;location=h.Location;},end(t=''){text=t;}};
  const req={method,headers:method==='POST'?{'content-type':'application/json'}:{},socket:{remoteAddress:'test'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(data));}};
  await broker.handle(req,res,new URL(pathname,origin));return {status,location,text};
 }
 let auth=await dispatch(native,'/auth/native/authorize?'+params());assert.equal(auth.status,302);let code=new URL(auth.location).searchParams.get('code');
 clock+=120000;assert.equal((await dispatch(native,'/auth/native/token',{method:'POST',data:{code,code_verifier:verifier,redirect_uri:CALLBACK,client_id:CLIENT_ID}})).status,400);
 auth=await dispatch(native,'/auth/native/authorize?'+params());code=new URL(auth.location).searchParams.get('code');
 const restarted=createNative({auth:'site',publicOrigin:origin},fakeAuth,{now:()=>clock});
 assert.equal((await dispatch(restarted,'/auth/native/token',{method:'POST',data:{code,code_verifier:verifier,redirect_uri:CALLBACK,client_id:CLIENT_ID}})).status,400);
 const disabled=createNative({auth:'none',publicOrigin:origin},fakeAuth);assert.equal((await dispatch(disabled,'/auth/native/authorize?'+params())).status,503);
 for(let i=0;i<30;i++)await dispatch(restarted,'/auth/native/token',{method:'POST',data:{}});
 assert.equal((await dispatch(restarted,'/auth/native/token',{method:'POST',data:{}})).status,429);
});
