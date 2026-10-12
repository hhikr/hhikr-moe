import {lesson,array,integer,text} from './lesson-kit.mjs';
export const windowLessons={
3:lesson({id:3,signature:'public int lengthOfLongestSubstring(String s)',sample:{s:'abcabcbb'},expected:3,call:'new Solution().lengthOfLongestSubstring("abcabcbb")',description:'返回字符串中不包含重复字符的最长连续子串长度。子串必须连续，空字符串的答案为 0。',idea:'右指针加入字符，last 保存每个字符上次出现的位置。如果它落在当前窗口内，直接把左边界移到上次位置之后。',invariant:'窗口 [left, right] 中的字符始终互不重复，left 只向右移动。',time:'O(n)',space:'O(字符集大小)',mode:'string',valueLabel:'字符 / s',stateLabel:'上次出现位置 / last'},`class Solution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> last = new HashMap<>(); // @init
        int left = 0, best = 0; // @state
        for (int right = 0; right < s.length(); right++) { // @loop
            char c = s.charAt(right); // @char
            left = Math.max(left, last.getOrDefault(c, -1) + 1); // @left
            last.put(c, right); // @record
            best = Math.max(best, right - left + 1); // @best
        }
        return best; // @return
    }
}`,({s},emit)=>{text(s);const values=[...s],last=new Map();let left=0,best=0;emit('init',values,[],'记录字符最近出现的位置。');emit('state',values,[],'初始化窗口和答案。',{left,best});for(let right=0;right<s.length;right++){const c=s[right];emit('loop',values,[right],'右边界向前读取。',{left,right,best},[...last]);emit('char',values,[right],`当前字符为 ${c}。`,{c,left,right,best},[...last]);left=Math.max(left,(last.get(c)??-1)+1);const active=Array.from({length:right-left+1},(_,i)=>left+i);emit('left',values,active,'左边界越过窗口内的重复字符，且不能后退。',{left,right,best},[...last]);last.set(c,right);emit('record',values,active,'更新当前字符的最近位置。',{c,left,right,best},[...last]);best=Math.max(best,right-left+1);emit('best',values,active,`当前窗口长度 ${right-left+1}。`,{left,right,best},[...last]);}emit('return',values,[],`最长无重复子串长度为 ${best}。`,{best},[...last]);return best;}),
438:lesson({id:438,signature:'public List<Integer> findAnagrams(String s, String p)',sample:{s:'cbaebabacd',p:'abc'},expected:[0,6],call:'new Solution().findAnagrams("cbaebabacd","abc")',description:'给定小写英文字符串 s 和非空字符串 p，返回 s 中所有与 p 互为字母异位词的子串起始下标。',idea:'固定窗口长度为 p.length()。用两个 26 项计数数组记录目标和当前窗口；每右移一步，加入新字符，移除离开窗口的字符，再比较计数。',invariant:'have 中只记录当前固定长度窗口的字符数量。',time:'O(26 n)',space:'O(26)，不含输出',mode:'string',valueLabel:'字符 / s',stateLabel:'非零字符计数'},`class Solution {
    public List<Integer> findAnagrams(String s, String p) {
        int[] need = new int[26], have = new int[26]; // @init
        for (char c : p.toCharArray()) need[c - 'a']++; // @need
        List<Integer> ans = new ArrayList<>(); // @ans
        for (int right = 0; right < s.length(); right++) { // @loop
            have[s.charAt(right) - 'a']++; // @add
            if (right >= p.length()) have[s.charAt(right - p.length()) - 'a']--; // @remove
            if (right + 1 >= p.length() && Arrays.equals(need, have)) { // @compare
                ans.add(right + 1 - p.length()); // @found
            }
        }
        return ans; // @return
    }
}`,({s,p},emit)=>{text(s);text(p,'p',16);if(!p.length||!/^[a-z]*$/.test(s+p))throw Error('s、p 必须由小写英文字母组成，p 不能为空');const v=[...s],need=Array(26).fill(0),have=Array(26).fill(0),ans=[];const memory=()=>have.flatMap((n,i)=>n||need[i]?[[String.fromCharCode(97+i),`${n} / ${need[i]}`]]:[]);emit('init',v,[],'创建目标和窗口计数数组。');for(const c of p){need[c.charCodeAt(0)-97]++;emit('need',v,[],'统计目标字符串中的字符数量。',{c},memory());}emit('ans',v,[],'创建起始下标列表。');for(let right=0;right<s.length;right++){let left=Math.max(0,right-p.length+1),active=Array.from({length:right-left+1},(_,i)=>left+i);emit('loop',v,[right],'窗口右边界向前移动。',{left,right},memory());have[s.charCodeAt(right)-97]++;emit('add',v,active,'加入当前字符。',{left,right},memory());if(right>=p.length)have[s.charCodeAt(right-p.length)-97]--;emit('remove',v,active,right>=p.length?'移除离开窗口的字符。':'窗口尚未超过目标长度。',{left,right},memory());const same=right+1>=p.length&&need.every((n,i)=>n===have[i]);emit('compare',v,active,same?'窗口计数与目标完全相同。':'当前窗口还不匹配目标。',{left,right,found:ans.join(',')},memory());if(same){ans.push(left);emit('found',v,active,`记录起点 ${left}。`,{left,right,found:ans.join(',')},memory());}}emit('return',v,[],`返回下标 ${JSON.stringify(ans)}。`,{},memory());return ans;}),
560:lesson({id:560,signature:'public int subarraySum(int[] nums, int k)',sample:{nums:[1,1,1],k:2},expected:2,call:'new Solution().subarraySum(new int[]{1,1,1},2)',description:'求数组中和等于 k 的非空连续子数组数量。数组可能包含负数，因此不能用普通滑动窗口。',idea:'前缀和 prefix 的子数组和为 k，等价于之前出现过 prefix−k。哈希表记录每个前缀和出现的次数，先查询再记录当前前缀。',invariant:'处理当前元素时，freq 只包含之前的前缀和；初始前缀 0 出现一次。',time:'O(n)，平均',space:'O(n)',stateLabel:'前缀和频次 / freq'},`class Solution {
    public int subarraySum(int[] nums, int k) {
        Map<Integer, Integer> freq = new HashMap<>(); // @init
        freq.put(0, 1); // @zero
        int prefix = 0, count = 0; // @state
        for (int x : nums) { // @loop
            prefix += x; // @prefix
            count += freq.getOrDefault(prefix - k, 0); // @count
            freq.put(prefix, freq.getOrDefault(prefix, 0) + 1); // @record
        }
        return count; // @return
    }
}`,({nums,k},emit)=>{const a=array(nums);integer(k,'k');const freq=new Map();let prefix=0,count=0;emit('init',a,[],'创建前缀和频次表。');freq.set(0,1);emit('zero',a,[],'空前缀的和为 0，出现一次。',{},[...freq]);emit('state',a,[],'初始化前缀和与答案。',{prefix,count,k},[...freq]);for(let i=0;i<a.length;i++){const x=a[i];emit('loop',a,[i],'读取下一个元素。',{i,x,prefix,count,k},[...freq]);prefix+=x;emit('prefix',a,[i],`当前前缀和为 ${prefix}。`,{i,prefix,count,k},[...freq]);const need=prefix-k,added=freq.get(need)??0;count+=added;emit('count',a,[i],`之前和为 ${need} 的前缀出现 ${added} 次。`,{i,prefix,need,count,k},[...freq]);freq.set(prefix,(freq.get(prefix)??0)+1);emit('record',a,[i],'记录当前前缀和，供后续查询。',{i,prefix,count,k},[...freq]);}emit('return',a,[],`符合条件的子数组共有 ${count} 个。`,{count},[...freq]);return count;}),
239:lesson({id:239,signature:'public int[] maxSlidingWindow(int[] nums, int k)',sample:{nums:[1,3,-1,-3,5,3,6,7],k:3},expected:[3,3,5,5,6,7],call:'new Solution().maxSlidingWindow(new int[]{1,3,-1,-3,5,3,6,7},3)',print:'System.out.println(Arrays.toString(new Solution().maxSlidingWindow(new int[]{1,3,-1,-3,5,3,6,7},3)));',description:'长度为 k 的窗口每次右移一格，返回每个窗口内的最大值。',idea:'双端队列保存候选下标，值从队首到队尾递减。过期下标从队首移除，较小的旧值从队尾淘汰；队首始终是当前最大值。',invariant:'队列下标递增、对应数值递减，且所有下标都位于窗口内。',time:'O(n)',space:'O(k)，不含输出',stateLabel:'单调队列 / 下标 → 值'},`class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        Deque<Integer> deque = new ArrayDeque<>(); // @init
        int[] ans = new int[nums.length - k + 1]; // @ans
        for (int i = 0; i < nums.length; i++) { // @loop
            while (!deque.isEmpty() && deque.peekFirst() <= i - k) deque.removeFirst(); // @expire
            while (!deque.isEmpty() && nums[deque.peekLast()] <= nums[i]) deque.removeLast(); // @pop
            deque.addLast(i); // @push
            if (i >= k - 1) ans[i - k + 1] = nums[deque.peekFirst()]; // @output
        }
        return ans; // @return
    }
}`,({nums,k},emit)=>{const a=array(nums,'nums',{min:1});integer(k,'k',1,a.length);const q=[],ans=[];const memory=()=>q.map(i=>[i,a[i]]);emit('init',a,[],'创建双端队列。',{k});emit('ans',a,[],'创建结果数组。',{k});for(let i=0;i<a.length;i++){emit('loop',a,[i],'新元素进入窗口。',{i,k},memory());while(q.length&&q[0]<=i-k){const removed=q.shift();emit('expire',a,[removed],'从队首移除已离开窗口的下标。',{i,k},memory());}while(q.length&&a[q.at(-1)]<=a[i]){const removed=q.pop();emit('pop',a,[removed,i],'新值更大或相等，旧值不再可能成为最大值。',{i,k},memory());}q.push(i);emit('push',a,[i],'把新下标加入队尾。',{i,k},memory());if(i>=k-1)ans.push(a[q[0]]);emit('output',a,[q[0]],i>=k-1?`输出队首值 ${a[q[0]]}。`:'窗口尚未形成，暂不输出。',{i,k,output:JSON.stringify(ans)},memory());}emit('return',a,[],`返回 ${JSON.stringify(ans)}。`,{},memory());return ans;}),
76:lesson({id:76,signature:'public String minWindow(String s, String t)',sample:{s:'ADOBECODEBANC',t:'ABC'},expected:'BANC',call:'new Solution().minWindow("ADOBECODEBANC","ABC")',description:'找到 s 中包含 t 全部字符及其重复数量的最短连续子串。没有可行窗口时返回空字符串。',idea:'need 记录还缺多少字符，missing 记录总缺口。右边界扩展到缺口为零后，不断收缩左边界；移出必要字符时重新扩展。',invariant:'missing = 0 表示当前窗口覆盖 t；bestLen 保存已经遇到的最短合法窗口长度。',time:'O(n+m)',space:'O(128)，ASCII 演示',mode:'string',valueLabel:'字符 / s',stateLabel:'字符剩余需求（负数表示多余）'},`class Solution {
    public String minWindow(String s, String t) {
        if (t.isEmpty()) return ""; // @empty
        int[] need = new int[128]; // @init
        for (char c : t.toCharArray()) need[c]++; // @need
        int left = 0, missing = t.length(), bestStart = 0, bestLen = Integer.MAX_VALUE; // @state
        for (int right = 0; right < s.length(); right++) { // @loop
            char c = s.charAt(right); // @char
            if (need[c] > 0) missing--; // @missing
            need[c]--; // @add
            while (missing == 0) { // @valid
                if (right - left + 1 < bestLen) { // @better
                    bestStart = left; bestLen = right - left + 1; // @save
                }
                char removed = s.charAt(left++); // @left
                need[removed]++; // @remove
                if (need[removed] > 0) missing++; // @break
            }
        }
        return bestLen == Integer.MAX_VALUE ? "" : s.substring(bestStart, bestStart + bestLen); // @return
    }
}`,({s,t},emit)=>{text(s);text(t,'t',16);const v=[...s],need=Array(128).fill(0);emit('empty',v,[],t.length?'目标非空，继续计算。':'空目标直接返回空串。');if(!t.length)return '';emit('init',v,[],'创建字符需求数组。');for(const c of t){need[c.charCodeAt(0)]++;emit('need',v,[],'累计目标中的字符数量。',{c});}let left=0,missing=t.length,bestStart=0,bestLen=Infinity;const memory=()=>[...new Set(t)].map(c=>[c,need[c.charCodeAt(0)]]);const vars=right=>({left,right,missing,bestLen:bestLen===Infinity?'∞':bestLen,bestStart});emit('state',v,[],'初始化左右边界、缺口和最短长度。',vars(-1),memory());for(let right=0;right<s.length;right++){const c=s[right],ci=c.charCodeAt(0);emit('loop',v,[right],'扩展右边界。',vars(right),memory());emit('char',v,[right],`读取 ${c}。`,{...vars(right),c},memory());if(need[ci]>0)missing--;emit('missing',v,[right],'如果当前字符正是所缺字符，减少总缺口。',vars(right),memory());need[ci]--;emit('add',v,[right],'字符加入窗口，剩余需求减一。',vars(right),memory());while(missing===0){const active=Array.from({length:right-left+1},(_,i)=>left+i);emit('valid',v,active,'窗口已覆盖目标，可以尝试收缩。',vars(right),memory());emit('better',v,active,'比较当前窗口和最短记录。',vars(right),memory());if(right-left+1<bestLen){bestStart=left;bestLen=right-left+1;emit('save',v,active,'保存更短的合法窗口。',vars(right),memory());}const removed=s[left++];emit('left',v,[left-1],'左边界向右移动。',{...vars(right),removed},memory());need[removed.charCodeAt(0)]++;emit('remove',v,[left-1],'归还移出字符的需求。',vars(right),memory());if(need[removed.charCodeAt(0)]>0)missing++;emit('break',v,[left-1],missing?'移出了必要字符，需要重新扩展。':'仍然覆盖目标，继续收缩。',vars(right),memory());}}const ans=bestLen===Infinity?'':s.slice(bestStart,bestStart+bestLen);emit('return',v,bestLen===Infinity?[]:Array.from({length:bestLen},(_,i)=>bestStart+i),ans?`最小覆盖子串为 ${ans}。`:'不存在覆盖目标的子串。',{answer:ans},memory());return ans;})
};
