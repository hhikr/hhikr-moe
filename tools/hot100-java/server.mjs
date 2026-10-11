import http from 'node:http';
import {readFile,mkdtemp,writeFile,rm,readdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,extname,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {JavaCompletion} from './java-completion.mjs';
import {settings,applyCors} from './bridge-policy.mjs';
const root=dirname(fileURLToPath(import.meta.url)),{port,origin,origins,site}=settings(process.argv.slice(2),process.env),tokens=new Map();
function sessionToken(requestOrigin=origin){if(!tokens.has(requestOrigin))tokens.set(requestOrigin,randomBytes(32).toString('hex'));return tokens.get(requestOrigin);}
let busy=false;
const completion=new JavaCompletion(root,javaCommands);
async function javaCommands(){
 const extension=process.platform==='win32'?'.exe':'';
 const homes=[process.env.JAVA_HOME];
 try{for(const name of await readdir(join(root,'.runtime')))if(name.startsWith('jdk-'))homes.push(join(root,'.runtime',name));}catch{}
 for(const home of homes.filter(Boolean)){
  const java=join(home,'bin',`java${extension}`),javac=join(home,'bin',`javac${extension}`);
  try{await Promise.all([access(java),access(javac)]);return {java,javac,source:home};}catch{}
 }
 return {java:'java',javac:'javac',source:'PATH'};
}
function execute(command,args,{cwd,stdin='',timeout=5000}={}){
 return new Promise(resolve=>{
  let stdout='',stderr='',finished=false,bytes=0,limited=false;
  const child=spawn(command,args,{cwd,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']}),limit=65536;
  const timer=setTimeout(()=>{stderr+='\n执行超过时间限制。';child.kill();},timeout);
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  const append=(type,chunk)=>{
   if(limited)return;
   bytes+=Buffer.byteLength(chunk);
   if(bytes>limit){limited=true;stderr='输出超过 64 KB 限制。';child.kill();return;}
   if(type==='out')stdout+=chunk;else stderr+=chunk;
  };
  child.stdout.on('data',c=>append('out',c));child.stderr.on('data',c=>append('err',c));
  const finish=exitCode=>{if(finished)return;finished=true;clearTimeout(timer);resolve({stdout,stderr,exitCode});};
  child.on('error',e=>{stderr=e.message;finish(-1);});child.on('close',code=>finish(limited?-1:code??-1));
  child.stdin.on('error',()=>{});child.stdin.end(stdin);
 });
}
async function environment(requestOrigin){const commands=await javaCommands();const [java,javac]=await Promise.all([execute(commands.java,['-version']),execute(commands.javac,['-version'])]);return {service:'hot100-java',protocol:1,available:java.exitCode===0&&javac.exitCode===0,version:`${(java.stderr||java.stdout).split('\n')[0]} · ${(javac.stdout||javac.stderr).trim()}`,source:requestOrigin===origin?commands.source:undefined,token:sessionToken(requestOrigin)};}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
const allowed=new Set(['/','/index.html','/style.css','/app.mjs','/catalog.mjs','/lessons.mjs','/lesson-kit.mjs','/diagrams.mjs','/structures.mjs','/editor.mjs','/judge.mjs','/motion.mjs','/java-client.mjs','/demo-input.mjs']);
const server=http.createServer(async(req,res)=>{try{
 if(req.headers.host!==`127.0.0.1:${port}`){json(res,403,{error:'无效的主机名。'});return;}
 const path=new URL(req.url,origin).pathname;
 if(path.startsWith('/api/')){
  if(req.headers.origin&&!applyCors(req,res,origins)){json(res,403,{error:'此网站尚未获准连接本机服务。启动服务时用 --site 指定网站来源。'});return;}
  if(req.method==='OPTIONS'){if(!req.headers.origin){json(res,403,{error:'缺少网站来源。'});return;}res.writeHead(204);res.end();return;}
 }
 if(req.method==='GET'&&path==='/api/environment'){json(res,200,await environment(req.headers.origin||origin));return;}
 if(req.method==='POST'&&(path==='/api/run'||path==='/api/complete')){
  const supplied=String(req.headers['x-session-token']||'');
  const expected=tokens.get(req.headers.origin);
  if(!origins.has(req.headers.origin)||!expected||!/^\w{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))){json(res,403,{error:'运行请求未通过本机会话验证。'});return;}
  if(path==='/api/run'&&busy){json(res,429,{error:'已有程序正在运行。'});return;}
  req.setEncoding('utf8');let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000){json(res,413,{error:'代码与输入合计不能超过 100 KB。'});return;}}
  let data;try{data=JSON.parse(body);}catch{json(res,400,{error:'请求格式无效。'});return;}
  if(path==='/api/complete'){
   if(typeof data.code!=='string'||!Number.isInteger(data.cursor)||data.cursor<0||data.cursor>data.code.length){json(res,400,{error:'代码或光标位置无效。'});return;}
   json(res,200,{items:await completion.complete(data.code,data.cursor)});return;
  }
  if(typeof data.code!=='string'||typeof data.stdin!=='string'||!data.code.includes('class Main')){json(res,400,{error:'请提供包含 Main 类的 Java 代码。'});return;}
  busy=true;let folder;try{const commands=await javaCommands();folder=await mkdtemp(join(tmpdir(),'hot100-java-'));await writeFile(join(folder,'Main.java'),data.code,'utf8');await writeFile(join(folder,'LessonIO.java'),await readFile(join(root,'LessonIO.java')));const compile=await execute(commands.javac,['-J-Dstdout.encoding=UTF-8','-J-Dstderr.encoding=UTF-8','-encoding','UTF-8','Main.java','LessonIO.java'],{cwd:folder,timeout:10000});if(compile.exitCode!==0){json(res,200,{error:`编译失败：\n${compile.stderr}`});return;}json(res,200,await execute(commands.java,['-Xmx128m','-Dfile.encoding=UTF-8','-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8','-cp',folder,'Main'],{cwd:folder,stdin:data.stdin}));}finally{busy=false;if(folder&&resolve(folder).startsWith(resolve(tmpdir())+sep+'hot100-java-'))await rm(folder,{recursive:true,force:true});}return;
 }
 if(req.method!=='GET'||(!allowed.has(path)&&!/^\/lessons-[a-z-]+\.mjs$/.test(path))){res.writeHead(404);res.end('Not found');return;}
 const file=join(root,path==='/'?'index.html':path.slice(1)),types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript'};
 res.writeHead(200,{'Content-Type':`${types[extname(file)]}; charset=utf-8`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'"});res.end(await readFile(file));
 }catch(e){if(!res.headersSent)json(res,500,{error:e.message});else res.end();}});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Hot 100 preview: ${origin}${site?`\n允许连接的网站：${site}`:''}\n`));
process.on('SIGINT',()=>{completion.close();server.close(()=>process.exit(0));});
process.on('SIGTERM',()=>{completion.close();server.close(()=>process.exit(0));});
