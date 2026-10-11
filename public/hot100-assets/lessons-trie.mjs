import {lesson,text} from './lesson-kit.mjs';
const scenario='Trie trie = new Trie(); List<Object> result = new ArrayList<>(); result.add(null); trie.insert("apple"); result.add(null); result.add(trie.search("apple")); result.add(trie.search("app")); result.add(trie.startsWith("app")); trie.insert("app"); result.add(null); result.add(trie.search("app"));';
export const trieLessons={
208:lesson({id:208,className:'Trie',sample:{ops:['Trie','insert','search','search','startsWith','insert','search'],args:[[],['apple'],['apple'],['app'],['app'],['app'],['app']]},expected:[null,null,true,false,true,null,true],javaScenario:scenario,mode:'trie',valueLabel:'前缀树节点（★ 表示完整单词）',stateLabel:'字符位置 / 当前节点',description:'实现前缀树，支持插入单词、精确搜索和前缀搜索。输入只含小写英文字母；精确搜索还要求终点被标记为完整单词。',idea:'从根沿字符边前进，相同前缀共享同一路径。插入时补建缺失节点；单词终点用 end 标记，区分已有前缀与完整单词。',invariant:'当前节点表示已经处理的字符前缀；end 只在完整插入单词的终点为真。',time:'每个操作 O(L)，L 为字符串长度',space:'O(所有插入单词的字符总数)',practice:`import java.util.*;
class Trie {
    public Trie() { }
    public void insert(String word) { throw new UnsupportedOperationException("实现 insert"); }
    public boolean search(String word) { throw new UnsupportedOperationException("实现 search"); }
    public boolean startsWith(String prefix) { throw new UnsupportedOperationException("实现 startsWith"); }
}
public class Main {
    public static void main(String[] args) {
        ${scenario}
        System.out.println(LessonIO.format(result));
    }
}`},`class Trie {
    private final Trie[] children = new Trie[26]; // @init
    private boolean end;
    public Trie() { }
    public void insert(String word) {
        Trie node = this; // @insert-start
        for (int i = 0; i < word.length(); i++) { // @insert-loop
            int index = word.charAt(i) - 'a'; // @index
            if (node.children[index] == null) node.children[index] = new Trie(); // @create
            node = node.children[index]; // @insert-next
        }
        node.end = true; // @mark
    }
    public boolean search(String word) {
        Trie node = find(word); // @search
        return node != null && node.end; // @exact
    }
    public boolean startsWith(String prefix) {
        return find(prefix) != null; // @prefix
    }
    private Trie find(String word) {
        Trie node = this; // @find-start
        for (int i = 0; i < word.length(); i++) { // @find-loop
            int index = word.charAt(i) - 'a'; // @find-index
            if (node.children[index] == null) return null; // @missing
            node = node.children[index]; // @find-next
        }
        return node; // @found
    }
}`, ({ops,args},emit)=>{if(!Array.isArray(ops)||!Array.isArray(args)||ops.length!==args.length||ops.length>20||ops[0]!=='Trie'||!args.every(Array.isArray)||args[0].length)throw Error('首项须为无参 Trie，ops 与 args 等长且最多 20 项');const nodes=[{id:0,label:'根',end:false,depth:0,children:new Map()}],edges=[],result=[null];let current=nodes[0];const show=(key,note,vars={})=>emit(key,nodes.map(n=>`${n.label}${n.end?'★':''}`),current?[current.id]:[],note,vars,[],{network:{kind:'trie',labels:nodes.map(n=>`${n.label}${n.end?'★':''}`),depths:nodes.map(n=>n.depth),edges:[...edges]}});show('init','创建根节点及空孩子表。');for(let opIndex=1;opIndex<ops.length;opIndex++){if(args[opIndex].length!==1)throw Error('每个操作需要一个字符串');const word=text(args[opIndex][0],'word',12);if(!/^[a-z]*$/.test(word))throw Error('word 只能含小写英文字母');const op=ops[opIndex];current=nodes[0];if(op==='insert'){show('insert-start','插入从根开始。',{word});for(let i=0;i<word.length;i++){show('insert-loop','处理下一个字符。',{word,i});const index=word.charCodeAt(i)-97;show('index','字符映射到 0 到 25 的孩子槽。',{word,i,index});if(!current.children.has(word[i])){if(nodes.length>=80)throw Error('演示最多支持 80 个前缀树节点');const child={id:nodes.length,label:word[i],end:false,depth:current.depth+1,children:new Map()};nodes.push(child);current.children.set(word[i],child);edges.push({from:current.id,to:child.id,label:word[i]});}show('create','缺少字符边时补建节点。',{word,i,index});current=current.children.get(word[i]);show('insert-next','沿字符边前进。',{word,i,index});}current.end=true;show('mark','标记这个前缀为完整单词。',{word});result.push(null);}else if(op==='search'||op==='startsWith'){show(op==='search'?'search':'prefix','查找字符串对应的路径。',{word});show('find-start','从根开始查找。',{word});let found=true;for(let i=0;i<word.length;i++){show('find-loop','处理查找字符。',{word,i});const index=word.charCodeAt(i)-97;show('find-index','计算孩子槽下标。',{word,i,index});show('missing',current.children.has(word[i])?'字符边存在。':'字符边不存在，查找失败。',{word,i,index});if(!current.children.has(word[i])){found=false;current=null;break;}current=current.children.get(word[i]);show('find-next','移动到字符边终点。',{word,i,index});}if(found)show('found','整条前缀路径存在。',{word});if(op==='search'){const answer=found&&current.end;show('exact',answer?'路径存在且终点为完整单词。':'路径缺失或终点未标记完整单词。',{word,answer});result.push(answer);}else result.push(found);}else throw Error(`不支持的 Trie 操作：${op}`);}return result;})
};
