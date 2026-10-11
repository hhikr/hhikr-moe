import {lesson,array,text} from './lesson-kit.mjs';
export const hashLessons = {
49:lesson({id:49,signature:'public List<List<String>> groupAnagrams(String[] strs)',sample:{strs:['eat','tea','tan','ate','nat','bat']},expected:[['eat','tea','ate'],['tan','nat'],['bat']],call:'new Solution().groupAnagrams(new String[]{"eat","tea","tan","ate","nat","bat"})',description:'把字符串数组中字符种类和数量相同的单词归为一组。各组与组内元素的顺序不影响答案。',idea:'将每个单词排序，排序结果是它所属分组的唯一键。相同键的单词加入同一个列表。',invariant:'map 中每个键对应的单词具有相同的排序结果。',time:'O(n k log k)',space:'O(n k)',stateLabel:'分组 / map',valueLabel:'单词 / strs'},`class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> map = new LinkedHashMap<>(); // @init
        for (String s : strs) { // @loop
            char[] chars = s.toCharArray(); // @chars
            Arrays.sort(chars); // @sort
            String key = new String(chars); // @key
            map.computeIfAbsent(key, x -> new ArrayList<>()).add(s); // @add
        }
        return new ArrayList<>(map.values()); // @return
    }
}`,({strs},emit)=>{if(!Array.isArray(strs)||strs.length>16)throw Error('strs 必须是最多 16 个字符串的数组');strs.forEach(s=>text(s,'strs 元素',16));const map=new Map();const memory=()=>[...map].map(([k,v])=>[k,v.join(', ')]);emit('init',strs,[],'创建分组表。');for(let i=0;i<strs.length;i++){const s=strs[i];emit('loop',strs,[i],'读取一个单词。',{s});const chars=[...s];emit('chars',strs,[i],'拆成字符数组。',{chars:chars.join('')});chars.sort();emit('sort',strs,[i],'排序后，异位词会得到相同结果。',{chars:chars.join('')});const key=chars.join('');emit('key',strs,[i],`使用 ${key} 作为分组键。`,{key},memory());if(!map.has(key))map.set(key,[]);map.get(key).push(s);emit('add',strs,[i],'加入相同键的列表。',{key},memory());}const result=[...map.values()];emit('return',strs,[],`得到 ${result.length} 个分组。`,{},memory());return result;}),
128:lesson({id:128,signature:'public int longestConsecutive(int[] nums)',sample:{nums:[100,4,200,1,3,2]},expected:4,call:'new Solution().longestConsecutive(new int[]{100,4,200,1,3,2})',description:'在无序整数数组中找到数值连续的最长序列长度。元素不需要在原数组中相邻，要求平均时间复杂度为 O(n)。',idea:'先用集合去重。只从没有前驱 x−1 的数开始向右延伸，这样每段连续序列只被扫描一次。',invariant:'只有序列起点才能触发扩展，每个不同的数至多参与一次扩展。',time:'O(n)，平均',space:'O(n)',stateLabel:'已出现的数 / set'},`class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Integer> set = new HashSet<>(); // @init
        for (int x : nums) set.add(x); // @add
        int best = 0; // @best
        for (int x : set) { // @loop
            if (set.contains(x - 1)) continue; // @skip
            int end = x; // @start
            while (set.contains(end + 1)) end++; // @extend
            best = Math.max(best, end - x + 1); // @update
        }
        return best; // @return
    }
}`,({nums},emit)=>{const a=array(nums),set=new Set();emit('init',a,[],'创建集合。');for(let i=0;i<a.length;i++){set.add(a[i]);emit('add',a,[i],'把数加入集合，重复值只保留一次。',{x:a[i]},[...set].map(v=>[v,'存在']));}let best=0;emit('best',a,[],'最长长度初始化为 0。',{best});for(const x of set){const active=[a.indexOf(x)];emit('loop',a,active,'判断当前数是否是起点。',{x,best});emit('skip',a,active,set.has(x-1)?'前驱存在，跳过，避免重复扫描。':'没有前驱，可以从此处扩展。',{x,best});if(set.has(x-1))continue;let end=x;emit('start',a,active,'从序列起点开始。',{x,end,best});while(set.has(end+1)){end++;emit('extend',a,[a.indexOf(end)],'下一个连续值存在，继续扩展。',{x,end,best});}best=Math.max(best,end-x+1);emit('update',a,active,`当前序列长度 ${end-x+1}，更新最大值。`,{x,end,best});}emit('return',a,[],`最长连续长度为 ${best}。`,{best});return best;})
};
