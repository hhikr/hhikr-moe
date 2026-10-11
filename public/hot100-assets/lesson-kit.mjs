export function array(value,name='nums',{min=0,max=24,positive=false,sorted=false}={}) {
  if(!Array.isArray(value)||value.length<min||value.length>max||!value.every(v=>Number.isInteger(v)&&Math.abs(v)<=100000&&(positive?v>=0:true)))throw Error(`${name} 必须包含 ${min} 到 ${max} 个整数${positive?'，且元素非负':''}`);
  if(sorted&&value.some((v,i)=>i&&v<value[i-1]))throw Error(`${name} 必须按升序排列`);
  return [...value];
}
export function integer(value,name,min=-100000,max=100000){if(!Number.isInteger(value)||value<min||value>max)throw Error(`${name} 必须是 ${min} 到 ${max} 的整数`);return value;}
export function text(value,name='s',max=32){if(typeof value!=='string'||value.length>max||!/^[\x20-\x7e]*$/.test(value))throw Error(`${name} 必须是最多 ${max} 个 ASCII 字符`);return value;}
export function matrix(value,name='matrix'){if(!Array.isArray(value)||!value.length||value.length>8)throw Error(`${name} 必须包含 1 到 8 行`);const rows=value.map(row=>array(row,name,{min:1,max:8}));if(rows.some(row=>row.length!==rows[0].length))throw Error('矩阵的每一行必须等长');return rows;}
export function practiceProgram(meta){
  const main=meta.print||`${meta.javaSetup||''}\n        ${meta.javaResult?`${meta.call};\n        `:''}System.out.println(LessonIO.format(${meta.javaResult||meta.javaTransform?.replace('__RESULT__',meta.call)||meta.call}));`;
  return `import java.util.*;\n\nclass Solution {\n    ${meta.signature} {\n        throw new UnsupportedOperationException("请在这里实现解法");\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        ${main}\n    }\n}`;
}
export function lesson(meta,source,algorithm){
  if(!meta.javaTransform&&/^public ListNode\b/.test(meta.signature||''))meta={...meta,javaTransform:'LessonIO.listValues(__RESULT__)'};
  if(!meta.javaTransform&&/^public Node\b/.test(meta.signature||''))meta={...meta,javaTransform:'LessonIO.randomValues(__RESULT__)'};
  const lines={},code=source.split('\n').map((line,i)=>line.replace(/\s*\/\/ @([\w-]+)\s*$/,(_,key)=>{lines[key]=i+1;return '';})).join('\n');
  function trace(raw){
    let input;try{input=JSON.parse(raw);}catch{throw Error('请输入合法的 JSON 对象');}
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('输入必须是 JSON 对象');
    const frames=[];
    function emit(key,values,active,note,vars={},stored=[],visual={}){
      if(!lines[key])throw Error(`缺少代码步骤：${meta.id}/${key}`);
      if(frames.length>=6000)throw Error('演示步骤超过 6000，请缩小输入');
      frames.push({line:lines[key],key,values:structuredClone(values),active:[...active],note,vars:structuredClone(vars),stored:structuredClone(stored),visual:structuredClone(visual),columns:visual.columns??(meta.mode==='matrix'?input.matrix[0].length:undefined)});
    }
    const answer=algorithm(input,emit);
    if(!frames.length)throw Error('演示没有产生执行步骤');
    frames.at(-1).answer=structuredClone(answer);
    return frames;
  }
  const args=Object.entries(meta.sample).map(([key,value])=>`${key} = ${JSON.stringify(value)}`).join(', ');
  const practice=meta.practice||practiceProgram(meta);
  return {...meta,input:args,output:JSON.stringify(meta.expected),raw:JSON.stringify(meta.sample),code,lines,trace,practice,mode:meta.mode||'array'};
}
