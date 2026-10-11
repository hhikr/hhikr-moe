import {judgeOutput} from './judge.mjs';
export function prepareDemo(lesson,raw,expectedRaw=''){
 let input,expected;
 try{input=JSON.parse(raw);}catch{throw Error('演示输入必须是合法的 JSON');}
 const hasExpected=expectedRaw.trim()!=='';
 if(hasExpected){try{expected=JSON.parse(expectedRaw);}catch{throw Error('预期输出必须是一个合法的 JSON 值，例如 [0,1]、8、true 或 "abc"');}}
 const frames=lesson.trace(raw),actual=frames.at(-1)?.answer;
 if(actual===undefined)throw Error('此演示没有生成结果');
 const comparison=hasExpected?judgeOutput(lesson.id,JSON.stringify(expected),actual,input):null;
 return {frames,input,raw,expectedRaw,actual,hasExpected,matched:comparison?.kind==='passed'};
}
