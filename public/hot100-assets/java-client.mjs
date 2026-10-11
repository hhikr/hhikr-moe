export class JavaClient {
 constructor({sameOrigin=false,pageOrigin=location.origin,fetcher=(url,options)=>fetch(url,options)}={}){this.sameOrigin=sameOrigin;this.origin=sameOrigin?pageOrigin:'http://127.0.0.1:4337';this.fetcher=fetcher;this.token='';}
 setPort(value){const port=Number(value);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('本机服务端口必须为 1024 到 65535 的整数');if(!this.sameOrigin){this.origin=`http://127.0.0.1:${port}`;this.token='';}}
 async request(path,{method='GET',body,timeout=18000}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
   const headers=body?{'Content-Type':'application/json','X-Session-Token':this.token}:{};
   const response=await this.fetcher(new URL(path,this.origin).href,{method,mode:'cors',credentials:'omit',headers,body:body?JSON.stringify(body):undefined,signal:controller.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||`本机服务返回 ${response.status}`);return data;
  }finally{clearTimeout(timer);}
 }
 async environment(){this.token='';const data=await this.request('/api/environment',{timeout:8000});if(data.service!=='hot100-java'||data.protocol!==1||!/^\w{64}$/.test(data.token))throw Error('此端口不是兼容的 Hot 100 Java 服务');this.token=data.available?data.token:'';return data;}
 run(code,stdin){if(!this.token)throw Error('请先连接本机 Java 服务');return this.request('/api/run',{method:'POST',body:{code,stdin}});}
 complete(code,cursor){if(!this.token)return Promise.resolve({items:[]});return this.request('/api/complete',{method:'POST',body:{code,cursor},timeout:12000});}
 disconnect(){this.token='';}
}
