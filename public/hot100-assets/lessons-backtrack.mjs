import {lesson,array,text,integer} from './lesson-kit.mjs';
const base={mode:'backtrack',stateLabel:'当前选择 / 已收集结果'};
function steps(emit,values,path,result){return (key,note,active=[],vars={})=>emit(key,values,active,note,{path:[...path],resultCount:result.length,...vars},result.map((v,i)=>[i,JSON.stringify(v)]),{searchPath:[...path]});}
export const backtrackLessons={
46:lesson({...base,id:46,signature:'public List<List<Integer>> permute(int[] nums)',sample:{nums:[1,2,3]},expected:[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]],call:'new Solution().permute(new int[]{1,2,3})',description:'返回互异整数数组的所有排列。每个排列使用每个元素恰好一次，结果顺序不限。',idea:'每层选择一个尚未使用的元素。选择后递归填下一位置，返回时撤销选择和 used 标记，以便探索其他排列。',invariant:'path 中元素互异，used 恰好标记当前路径已使用的位置。',time:'O(n·n!)',space:'O(n)，不计结果'},`class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> result = new ArrayList<>(); // @init
        search(nums, new boolean[nums.length], new ArrayList<>(), result); // @start
        return result; // @return
    }
    private void search(int[] nums, boolean[] used, List<Integer> path, List<List<Integer>> result) {
        if (path.size() == nums.length) { // @complete
            result.add(new ArrayList<>(path)); // @record
            return;
        }
        for (int i = 0; i < nums.length; i++) { // @loop
            if (used[i]) continue; // @skip
            used[i] = true; // @mark
            path.add(nums[i]); // @choose
            search(nums, used, path, result); // @recurse
            path.remove(path.size() - 1); // @undo
            used[i] = false; // @unmark
        }
    }
}`, ({nums:input},emit)=>{const nums=array(input,'nums',{max:5});if(new Set(nums).size!==nums.length)throw Error('nums 必须互异');const used=Array(nums.length).fill(false),path=[],result=[],show=steps(emit,nums,path,result);show('init','建立结果表。');show('start','从空排列开始。');function search(){show('complete','检查排列是否已填满。',[],{used:[...used]});if(path.length===nums.length){result.push([...path]);show('record','复制完整排列，避免后续撤销修改结果。');return;}for(let i=0;i<nums.length;i++){show('loop','尝试一个候选位置。',[i],{i});show('skip',used[i]?'已在路径中，跳过。':'尚未使用，可以选择。',[i],{i});if(used[i])continue;used[i]=true;show('mark','标记该位置已用。',[i],{i,used:[...used]});path.push(nums[i]);show('choose','将候选追加到路径。',[i],{i});show('recurse','递归填写下一位置。',[i],{i});search();path.pop();show('undo','撤销本次路径选择。',[i],{i});used[i]=false;show('unmark','恢复可选标记。',[i],{i,used:[...used]});}}search();show('return','返回所有排列。');return result;}),
78:lesson({...base,id:78,signature:'public List<List<Integer>> subsets(int[] nums)',sample:{nums:[1,2,3]},expected:[[],[1],[1,2],[1,2,3],[1,3],[2],[2,3],[3]],call:'new Solution().subsets(new int[]{1,2,3})',description:'返回互异数组的全部子集，包括空集。子集内保持原数组顺序，结果顺序不限。',idea:'每个递归状态本身就是一个子集。只从 start 之后选择下一项，使下标严格递增，从而避免相同子集以不同顺序重复出现。',invariant:'path 下标递增，下一选择只来自 start 及之后。',time:'O(n·2ⁿ)',space:'O(n)，不计结果'},`class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> result = new ArrayList<>(); // @init
        search(nums, 0, new ArrayList<>(), result); // @start
        return result; // @return
    }
    private void search(int[] nums, int start, List<Integer> path, List<List<Integer>> result) {
        result.add(new ArrayList<>(path)); // @record
        for (int i = start; i < nums.length; i++) { // @loop
            path.add(nums[i]); // @choose
            search(nums, i + 1, path, result); // @recurse
            path.remove(path.size() - 1); // @undo
        }
    }
}`, ({nums:input},emit)=>{const nums=array(input,'nums',{max:8});if(new Set(nums).size!==nums.length)throw Error('nums 必须互异');const path=[],result=[],show=steps(emit,nums,path,result);show('init','建立子集结果表。');show('start','从空集开始。');function search(start){result.push([...path]);show('record','当前路径就是一个合法子集。',[],{start});for(let i=start;i<nums.length;i++){show('loop','从未处理后缀选择元素。',[i],{start,i});path.push(nums[i]);show('choose','加入当前子集。',[i],{start,i});show('recurse','下一层只选择更大的下标。',[i],{start:i+1});search(i+1);path.pop();show('undo','撤销当前元素，尝试其他子集。',[i],{start,i});}}search(0);show('return','每个子集恰好生成一次。');return result;}),
17:lesson({...base,id:17,signature:'public List<String> letterCombinations(String digits)',sample:{digits:'23'},expected:['ad','ae','af','bd','be','bf','cd','ce','cf'],call:'new Solution().letterCombinations("23")',description:'输入只含 2 到 9 的电话键盘数字，返回它们对应的所有字母组合。空字符串返回空数组。',idea:'每层处理一个数字，枚举它对应的字母，向路径追加后进入下一位。数字都处理完就记录字符串。',invariant:'path 长度等于 index，恰好选定前 index 个数字的字母。',time:'O(L·4ᴸ)，L 为数字长度',space:'O(L)，不计结果'},`class Solution {
    private final String[] letters = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};
    public List<String> letterCombinations(String digits) {
        List<String> result = new ArrayList<>(); // @init
        if (digits.isEmpty()) return result; // @empty
        search(digits, 0, new StringBuilder(), result); // @start
        return result; // @return
    }
    private void search(String digits, int index, StringBuilder path, List<String> result) {
        if (index == digits.length()) { // @complete
            result.add(path.toString()); // @record
            return;
        }
        String choices = letters[digits.charAt(index) - '0']; // @choices
        for (int i = 0; i < choices.length(); i++) { // @loop
            path.append(choices.charAt(i)); // @choose
            search(digits, index + 1, path, result); // @recurse
            path.deleteCharAt(path.length() - 1); // @undo
        }
    }
}`, ({digits:input},emit)=>{const digits=text(input,'digits',4);if(!/^[2-9]*$/.test(digits))throw Error('digits 只能包含 2 到 9');const letters=['','','abc','def','ghi','jkl','mno','pqrs','tuv','wxyz'],path=[],result=[],show=steps(emit,[...digits],path,result);show('init','建立字母组合结果表。');show('empty',digits?'数字串非空。':'空数字串直接返回空结果。');if(!digits)return result;show('start','从第一个数字开始。');function search(index){show('complete','检查是否已处理所有数字。',[],{index});if(index===digits.length){result.push(path.join(''));show('record','记录完整字母组合。',[],{index});return;}const choices=letters[Number(digits[index])];show('choices','查找当前数字对应字母。',[index],{index,choices});for(let i=0;i<choices.length;i++){show('loop','尝试一个字母。',[index],{index,i,choices});path.push(choices[i]);show('choose','追加字母到路径。',[index],{index,i});show('recurse','处理下一个数字。',[index],{index});search(index+1);path.pop();show('undo','移除本层字母，尝试其他选择。',[index],{index,i});}}search(0);show('return','返回所有键盘字母组合。');return result;}),
39:lesson({...base,id:39,signature:'public List<List<Integer>> combinationSum(int[] candidates, int target)',sample:{candidates:[2,3,6,7],target:7},expected:[[2,2,3],[7]],call:'new Solution().combinationSum(new int[]{2,3,6,7},7)',description:'候选数组含互异正整数，每个数可重复使用，返回和为 target 的所有组合。组合顺序不限，不能重复。',idea:'先排序。递归选择时允许再次选择当前下标，支持重复使用；下标不回退，避免排列重复。候选大于剩余目标时，后面更大的数也不可选，直接剪枝。',invariant:'path 非递减，其和加 remaining 等于原目标。',time:'与搜索树和结果规模相关，粗略上界 O(n^(target/min))',space:'O(target/min)，不计结果'},`class Solution {
    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        Arrays.sort(candidates); // @sort
        List<List<Integer>> result = new ArrayList<>(); // @init
        search(candidates, 0, target, new ArrayList<>(), result); // @start
        return result; // @return
    }
    private void search(int[] nums, int start, int remaining, List<Integer> path, List<List<Integer>> result) {
        if (remaining == 0) { // @complete
            result.add(new ArrayList<>(path)); // @record
            return;
        }
        for (int i = start; i < nums.length; i++) { // @loop
            if (nums[i] > remaining) break; // @prune
            path.add(nums[i]); // @choose
            search(nums, i, remaining - nums[i], path, result); // @recurse
            path.remove(path.size() - 1); // @undo
        }
    }
}`, ({candidates:input,target},emit)=>{const nums=array(input,'candidates',{min:1,max:8});if(nums.some(v=>v<=0)||new Set(nums).size!==nums.length)throw Error('candidates 必须是互异正整数');integer(target,'target',1,20);nums.sort((a,b)=>a-b);const path=[],result=[],show=steps(emit,nums,path,result);show('sort','排序后允许按大小剪枝。');show('init','建立组合结果表。');show('start','从完整目标开始选择。',[],{target});function search(start,remaining){show('complete','检查剩余目标是否为 0。',[],{start,remaining});if(remaining===0){result.push([...path]);show('record','当前路径的和等于目标。');return;}for(let i=start;i<nums.length;i++){show('loop','只从当前下标及后面选择。',[i],{start,remaining,i});show('prune',nums[i]>remaining?'候选过大，后续全部剪枝。':'候选不超过剩余目标。',[i],{remaining,i});if(nums[i]>remaining)break;path.push(nums[i]);show('choose','选择候选，减少剩余目标。',[i],{remaining,i});show('recurse','下一层仍可使用当前候选。',[i],{remaining:remaining-nums[i],start:i});search(i,remaining-nums[i]);path.pop();show('undo','撤销当前候选。',[i],{remaining,i});}}search(0,target);show('return','返回所有不重复组合。');return result;})
};
