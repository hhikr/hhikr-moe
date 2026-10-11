const unorderedOuter=new Set([17,22,46,51,131,347]);
const unorderedBoth=new Set([15,39,49,78]);
const serialize=value=>JSON.stringify(value);
function normalize(id,value){
 if(!Array.isArray(value))return value;
 if(id===1)return [...value].sort((a,b)=>a-b);
 if(unorderedBoth.has(id))return value.map(group=>Array.isArray(group)?group.map(serialize).sort():serialize(group)).map(serialize).sort();
 if(unorderedOuter.has(id)||id===56)return value.map(serialize).sort();
 return value;
}
function validBalancedTree(values,nums){
 if(!Array.isArray(values)||values.length>256||!values.every(v=>v===null||Number.isInteger(v)))return false;
 if(!nums.length)return !values.length||values.every(v=>v===null);
 if(!values.length||values[0]===null)return false;
 const root={value:values[0]},queue=[root];let index=1;
 for(const node of queue)for(const key of ['left','right']){if(index>=values.length)break;const value=values[index++];if(value!==null){node[key]={value};queue.push(node[key]);}}
 if(values.slice(index).some(v=>v!==null))return false;
 const ordered=[];let valid=true;
 function visit(node){if(!node)return 0;const left=visit(node.left);ordered.push(node.value);const right=visit(node.right);if(Math.abs(left-right)>1)valid=false;return Math.max(left,right)+1;}
 visit(root);return valid&&serialize(ordered)===serialize(nums);
}
export function judgeOutput(id,stdout,expected,sample={}){
 let actual;try{actual=JSON.parse(stdout.trim());}catch{return {kind:'format',message:'输出不是一个完整的 JSON 值。请用 LessonIO.format 输出结果，并移除调试文字。'};}
 let passed;
 if(id===5)passed=typeof actual==='string'&&actual.length===expected.length&&sample.s.includes(actual)&&[...actual].reverse().join('')===actual;
 else if(id===108)passed=validBalancedTree(actual,sample.nums);
 else passed=serialize(normalize(id,actual))===serialize(normalize(id,expected));
 return passed?{kind:'passed',message:'本题示例通过。示例通过不代表所有输入都正确。'}:{kind:'wrong',message:`结果不符合本题示例。预期：${serialize(expected)}；实际：${serialize(actual)}`};
}
export function referenceProgram(lesson){
 const body=lesson.javaScenario?`${lesson.javaScenario}\n        System.out.println(LessonIO.format(result));`:`${lesson.javaSetup||''}\n        ${lesson.javaResult?`${lesson.call};\n        `:''}System.out.println(LessonIO.format(${lesson.javaResult||lesson.javaTransform?.replace('__RESULT__',lesson.call)||lesson.call}));`;
 return `import java.util.*;\n\n${lesson.code}\n\npublic class Main {\n    public static void main(String[] args) {\n        ${body}\n    }\n}`;
}
