export function settings(args=[],env={}){
 let port=Number(env.HOT100_PORT||4337),site=env.HOT100_SITE_ORIGIN||'';
 for(let i=0;i<args.length;i++){
  if(args[i]==='--port')port=Number(args[++i]);
  else if(args[i]==='--site'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('--site 缺少网站来源');site=args[++i];}
  else throw Error(`未知启动参数：${args[i]}`);
 }
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('服务端口必须为 1024 到 65535 的整数');
 const origin=`http://127.0.0.1:${port}`,origins=new Set([origin]);
 if(site){
  const url=new URL(site);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw Error('--site 必须是 HTTPS 网站来源，或本机 HTTP 开发来源，不得包含路径、查询或凭据');
  origins.add(url.origin);
 }
 return {port,origin,origins,site:[...origins].find(value=>value!==origin)||''};
}
export function applyCors(req,res,origins){
 const origin=req.headers.origin;
 if(!origin||!origins.has(origin))return false;
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
 if(req.method==='OPTIONS'){
  const method=req.headers['access-control-request-method'],headers=String(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
  if(!['GET','POST'].includes(method)||headers.some(value=>!['content-type','x-session-token'].includes(value)))return false;
  res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Session-Token');res.setHeader('Access-Control-Max-Age','600');
  if(req.headers['access-control-request-private-network']==='true')res.setHeader('Access-Control-Allow-Private-Network','true');
 }
 return true;
}
