import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const python=process.env.HERMES_TEST_PYTHON || 'python';
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port)));
async function port(){const s=http.createServer();const p=await listen(s);await new Promise(r=>s.close(r));return p;}
function request(port,url,{headers={},method='GET',body}={}){return new Promise((resolve,reject)=>{
 const req=http.request({hostname:'127.0.0.1',port,path:url,method,headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString()}));});req.on('error',reject);if(body!==undefined)req.write(body);req.end();
});}
async function ready(port,url,headers){for(let i=0;i<100;i++){try{await request(port,url,{headers});return;}catch{}await new Promise(r=>setTimeout(r,20));}throw Error('staged test server unavailable');}
async function stop(proc){if(proc.exitCode!==null)return;const wait=new Promise(r=>proc.once('exit',r));proc.kill();await wait;}
test('existing gate -> stripped bearer -> real loopback token guard -> real rules/device-status handlers',async()=>{
 const bp=await port(),gp=await port(),code='c'.repeat(43),secret='test-only-shared-secret-0123456789';let logs='';
 const site=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const b=JSON.parse(body);
  assert.equal(req.headers.authorization,'Bearer '+secret);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(b.action==='redeem'?{ok:b.code===code,grant:'synthetic-owner-grant',user:{role:'endmin'}}:{valid:true}));});
 const sp=await listen(site);
 const backend=spawn(python,[path.join(root,'tests/loopback_backend.py'),String(bp)],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 const gate=spawn(process.execPath,[path.resolve(root,'../../../../cosmo/gate/server.mjs')],{env:{PATH:process.env.PATH,COSMO_AUTH:'site',COSMO_LISTEN:`127.0.0.1:${gp}`,COSMO_PUBLIC_ORIGIN:'https://cosmo.hhikr.moe',COSMO_SITE_PUBLIC:`http://127.0.0.1:${sp}`,COSMO_SITE_INTERNAL:`http://127.0.0.1:${sp}`,COSMO_HERMES:`http://127.0.0.1:${bp}`,COSMO_GATE_SECRET:secret}});
 for(const child of [backend,gate]){child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);}
 try{
  await ready(bp,'/');await ready(gp,'/.well-known/assetlinks.json',{Host:'cosmo.hhikr.moe'});
  const v='v'.repeat(43),challenge=crypto.createHash('sha256').update(v).digest('base64url');
  const fields={state:'s'.repeat(43),code_challenge:challenge,code_challenge_method:'S256',redirect_uri:'https://cosmo.hhikr.moe/android/auth/callback'};
  const start=await request(gp,'/auth/native/authorize?'+new URLSearchParams(fields),{headers:{Host:'cosmo.hhikr.moe'}});assert.equal(start.status,302);
  const state=new URL(start.headers.location).searchParams.get('state'),cookie=start.headers['set-cookie'][0].split(';')[0];
  const cb=await request(gp,'/auth/callback?'+new URLSearchParams({state,code}),{headers:{Host:'cosmo.hhikr.moe',Cookie:cookie}});assert.equal(cb.status,302);
  const session=cb.headers['set-cookie'][0].split(';')[0];
  const resume=await request(gp,cb.headers.location,{headers:{Host:'cosmo.hhikr.moe',Cookie:session}});assert.equal(resume.status,302);
  const nativeCode=new URL(resume.headers.location).searchParams.get('code');
  const exchange=await request(gp,'/auth/native/token',{method:'POST',headers:{Host:'cosmo.hhikr.moe','Content-Type':'application/json'},body:JSON.stringify({code:nativeCode,code_verifier:v,redirect_uri:fields.redirect_uri,client_id:'moe.hhikr.cosmo.focus'})});assert.equal(exchange.status,200);
  const token=JSON.parse(exchange.text).access_token,auth={Host:'cosmo.hhikr.moe',Authorization:'Bearer '+token};
  const rules=await request(gp,'/api/plugins/cosmo-tasks/rules',{headers:auth});assert.equal(rules.status,200);assert.equal(JSON.parse(rules.text).daily_limit_minutes,80);
  const report={used_seconds:0,target_package:'tv.danmaku.bili',enabled:false,service_active:false,rules_applied:false,device_test_passed:false,date:'2026-10-13',client_version:'test'};
  const posted=await request(gp,'/api/plugins/cosmo-tasks/device-status',{method:'POST',headers:{...auth,'Content-Type':'application/json',Origin:'https://cosmo.hhikr.moe'},body:JSON.stringify(report)});assert.equal(posted.status,200,logs);assert.equal(JSON.parse(posted.text).saved,true);
  assert.equal((await request(bp,'/api/plugins/cosmo-tasks/rules')).status,401);
  assert.equal((await request(bp,'/api/plugins/cosmo-tasks/rules',{headers:{Authorization:'Bearer '+token}})).status,401);
  assert.equal((await request(gp,'/api/plugins/cosmo-tasks/rules',{headers:{Host:'cosmo.hhikr.moe'}})).status,401);
  for(const r of [exchange,rules,posted])assert.equal(r.text.includes('synthetic-private-hermes-key'),false);
  assert.equal(logs.includes('synthetic-private-hermes-key'),false);assert.equal(logs.includes(token),false);assert.equal(logs.includes(secret),false);
 }finally{await stop(gate);await stop(backend);await new Promise(r=>site.close(r));}
});
