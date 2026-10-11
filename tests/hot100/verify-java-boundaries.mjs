import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {lessons} from '../../public/hot100-assets/lessons.mjs';
const cases=[];
const ints=a=>`new int[]{${a.join(',')}}`,list=a=>`LessonIO.list(${a.join(',')})`,tree=a=>`LessonIO.tree(${a.map(v=>v===null?'null':v).join(',')})`,matrix=a=>`new int[][]{${a.map(row=>`{${row.join(',')}}`).join(',')}}`;
function add(id,input,call,setup='',result=null){const l=lessons[id],expected=l.trace(JSON.stringify(input)).at(-1).answer;cases.push({id,input,expected,statement:`${setup} ${result?`${call};`:''} System.out.println(LessonIO.format(${result||l.javaTransform?.replace('__RESULT__',call)||call}));`});}
for(const head of [[],[1],[1,2],[1,2,1],[1,1,2,2],[-3,0,4,-3]]){
 for(const [id,method] of [[206,'reverseList'],[234,'isPalindrome'],[148,'sortList'],[24,'swapPairs']])add(id,{head},`new P${id}().${method}(${list(head)})`);
 for(const k of [1,2,4])add(25,{head,k},`new P25().reverseKGroup(${list(head)},${k})`);
 for(const pos of head.length?[-1,0,head.length-1]:[-1]){add(141,{head,pos},`new P141().hasCycle(LessonIO.cycle(${list(head)},${pos}))`);add(142,{head,pos},`new P142().detectCycle(LessonIO.cycle(${list(head)},${pos}))`);}
 if(head.length)for(const n of [1,head.length])add(19,{head,n},`new P19().removeNthFromEnd(${list(head)},${n})`);
}
for(const [a,b] of [[[],[]],[[],[1,2]],[[1,1],[1,1]],[[1,3,5],[2,4]]]){add(21,{list1:a,list2:b},`new P21().mergeTwoLists(${list(a)},${list(b)})`);add(160,{listA:a,listB:b,skipA:-1,skipB:-1},`new P160().getIntersectionNode(${list(a)},${list(b)})`);}
for(const lists of [[],[[]],[[1],[],[0,2]],[[1,1],[1,1]]])add(23,{lists},`new P23().mergeKLists(new ListNode[]{${lists.map(list).join(',')}})`);
for(const head of [[],[[1,null]],[[1,0]],[[1,1],[2,0]]])add(138,{head},`new P138().copyRandomList(LessonIO.randomList(${matrix(head.map(([v,r])=>[v,r??-1]))}))`);
for(const root of [[],[1],[0,1,1],[-3,-4,-5],[1,null,2,null,3],[2,1,3],[1,2,3,4,null,null,5]]){
 for(const [id,method] of [[94,'inorderTraversal'],[104,'maxDepth'],[226,'invertTree'],[101,'isSymmetric'],[543,'diameterOfBinaryTree'],[102,'levelOrder'],[199,'rightSideView'],[98,'isValidBST']])add(id,{root},`new P${id}().${method}(${tree(root)})`);
 add(114,{root},'new P114().flatten(root)',`TreeNode root=${tree(root)};`,'LessonIO.rightValues(root)');
 for(const targetSum of [0,3,-4])add(437,{root,targetSum},`new P437().pathSum(${tree(root)},${targetSum})`);
 if(root.length)add(124,{root},`new P124().maxPathSum(${tree(root)})`);
 if(root.length&&new Set(root.filter(v=>v!==null)).size===root.filter(v=>v!==null).length){const p=root[0],q=root.filter(v=>v!==null).at(-1);add(236,{root,p,q},`new P236().lowestCommonAncestor(root,LessonIO.find(root,${p}),LessonIO.find(root,${q}))`,`TreeNode root=${tree(root)};`);}
}
for(const nums of [[],[-1],[1,2],[-4,-2,0,3,8]])add(108,{nums},`new P108().sortedArrayToBST(${ints(nums)})`);
for(const root of [[1],[2,1,3],[4,2,6,1,3,5,7]])for(const k of [1,root.length])add(230,{root,k},`new P230().kthSmallest(${tree(root)},${k})`);
for(const matrixInput of [[[0]],[[1]],[[1,0,1]],[[1,1],[1,1]],[[0,1,0],[1,0,1]]]){const chars=`new char[][]{${matrixInput.map(row=>`{${row.map(v=>`'${v}'`).join(',')}}`).join(',')}}`;add(200,{matrix:matrixInput},`new P200().numIslands(${chars})`);}
for(const matrixInput of [[[0]],[[1]],[[2]],[[2,1,1]],[[2,0,1]],[[2,1],[1,1]],[[0,2],[1,0]]])add(994,{matrix:matrixInput},`new P994().orangesRotting(${matrix(matrixInput)})`);
for(const prerequisites of [[],[[1,0]],[[1,0],[0,1]],[[0,0]],[[1,0],[2,1],[1,2]]])add(207,{numCourses:3,prerequisites},`new P207().canFinish(3,${matrix(prerequisites)})`);
for(const nums of [[1],[2,2,2],[-4,-2,0,5],[3,2,3,1,2,4,5,5,6]])for(const k of [1,nums.length])add(215,{nums,k},`new P215().findKthLargest(${ints(nums)},${k})`);
for(const nums of [[],[1],[1,2],[1,2,3,4]]){add(46,{nums},`new P46().permute(${ints(nums)})`);add(78,{nums},`new P78().subsets(${ints(nums)})`);}
for(const n of [1,2,4]){add(22,{n},`new P22().generateParenthesis(${n})`);add(51,{n},`new P51().solveNQueens(${n})`);}
for(const s of ['', 'a','abba','aaaa','abcd']){add(131,{s},`new P131().partition(${JSON.stringify(s)})`);add(5,{s},`new P5().longestPalindrome(${JSON.stringify(s)})`);}
for(const digits of ['', '2','79'])add(17,{digits},`new P17().letterCombinations(${JSON.stringify(digits)})`);
for(const [a,b] of [['',''],['abc',''],['a','a'],['abc','xyz'],['abac','cab']]){add(1143,{text1:a,text2:b},`new P1143().longestCommonSubsequence(${JSON.stringify(a)},${JSON.stringify(b)})`);add(72,{word1:a,word2:b},`new P72().minDistance(${JSON.stringify(a)},${JSON.stringify(b)})`);}
for(const [m,n] of [[1,1],[1,8],[8,1],[4,4]])add(62,{m,n},`new P62().uniquePaths(${m},${n})`);
for(const grid of [[[0]],[[1,0,2]],[[1],[0],[2]],[[1,2],[3,4]]])add(64,{matrix:grid},`new P64().minPathSum(${matrix(grid)})`);
const root=dirname(fileURLToPath(import.meta.url)),home=process.env.JAVA_HOME||join(root,'.runtime',(await readdir(join(root,'.runtime'))).find(v=>v.startsWith('jdk-'))),work=join(root,'.runtime','boundaries');await mkdir(work,{recursive:true});
const classes=[...new Set(cases.map(c=>c.id))].map(id=>{const l=lessons[id];return l.code.replace(new RegExp(`\\b${l.className||'Solution'}\\b`,'g'),`P${id}`).replace(`class P${id}`,`static class P${id}`);}).join('\n');
const statements=cases.map((c,i)=>`{ System.out.print("${i}\\t"); ${c.statement} }`).join('\n');
await writeFile(join(work,'VerifyBoundaries.java'),`import java.util.*; public class VerifyBoundaries { ${classes} public static void main(String[] args) { ${statements} } }`,'utf8');await writeFile(join(work,'LessonIO.java'),await readFile(join(root,'../../tools/hot100-java/LessonIO.java')));
const bin=name=>join(home,'bin',`${name}${process.platform==='win32'?'.exe':''}`),compiled=spawnSync(bin('javac'),['-encoding','UTF-8','VerifyBoundaries.java','LessonIO.java'],{cwd:work,encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(compiled.status,0,compiled.stderr);
const run=spawnSync(bin('java'),['-Dfile.encoding=UTF-8','-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8','-cp',work,'VerifyBoundaries'],{encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(run.status,0,run.stderr);
let count=0;for(const row of run.stdout.trim().split(/\r?\n/)){const [i,encoded]=row.split('\t'),c=cases[Number(i)],actual=JSON.parse(encoded);assert.deepEqual(actual,c.expected,`${c.id}: ${JSON.stringify(c.input)}`);count++;}assert.equal(count,cases.length);
console.log(`通过：${count} 组 Java 边界用例与动画结果一致，包含空链表、空树、全负树、环、不可达网格和回溯。`);
