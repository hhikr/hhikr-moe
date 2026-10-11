import {spawn} from 'node:child_process';
import {mkdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createInterface} from 'node:readline';

export class JavaCompletion {
 constructor(root,commands){this.root=root;this.commands=commands;this.child=null;this.pending=[];this.starting=null;this.serial=Promise.resolve();}
 async start(){
  if(this.child)return;
  if(this.starting)return this.starting;
  this.starting=(async()=>{
   const commands=await this.commands(),folder=join(this.root,'.runtime','completion');await mkdir(folder,{recursive:true});
   const source=join(this.root,'CompletionService.java'),classFile=join(folder,'CompletionService.class');
   let compile=true;try{compile=(await stat(source)).mtimeMs>(await stat(classFile)).mtimeMs;}catch{}
   if(compile)await new Promise((resolve,reject)=>{let stderr='';const child=spawn(commands.javac,['-encoding','UTF-8','-d',folder,source],{windowsHide:true});child.stderr.on('data',data=>stderr+=data);child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(stderr)));});
   const child=spawn(commands.java,['-Xmx128m','-Dfile.encoding=UTF-8','-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8','-cp',folder,'CompletionService',join(this.root,'LessonIO.java')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
   this.child=child;child.stdin.on('error',()=>{});child.stderr.resume();
   createInterface({input:child.stdout}).on('line',line=>{const pending=this.pending.shift();if(!pending)return;clearTimeout(pending.timer);try{pending.resolve(JSON.parse(line));}catch{pending.resolve([]);}});
   const close=()=>{if(this.child!==child)return;this.child=null;for(const pending of this.pending){clearTimeout(pending.timer);pending.resolve([]);}this.pending=[];};child.on('error',close);child.on('close',close);
  })();
  try{await this.starting;}finally{this.starting=null;}
 }
 async complete(code,cursor){
  const job=this.serial.then(async()=>{await this.start();return new Promise(resolve=>{const timer=setTimeout(()=>{this.child?.kill();resolve([]);},8000);this.pending.push({resolve,timer});this.child.stdin.write(`${Buffer.from(code).toString('base64')}\t${cursor}\n`);});});
  this.serial=job.catch(()=>{});return job;
 }
 close(){this.child?.kill();}
}
