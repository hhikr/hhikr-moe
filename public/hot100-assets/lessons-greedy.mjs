import {lesson,array,text} from './lesson-kit.mjs';
export const greedyLessons={
121:lesson({id:121,signature:'public int maxProfit(int[] prices)',sample:{prices:[7,1,5,3,6,4]},expected:5,call:'new Solution().maxProfit(new int[]{7,1,5,3,6,4})',description:'每天有一个股票价格，只能先买入一次，再在之后的某一天卖出一次。求最大利润；无法获利时返回 0。',idea:'扫描每一天，同时记录此前最低买入价。以今天作为卖出日时，最优利润是今天价格减此前最低价。',invariant:'minPrice 是目前见过的最低价格，best 是已经考虑的最大合法利润。',time:'O(n)',space:'O(1)',valueLabel:'每日价格 / prices'},`class Solution {
    public int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE, best = 0; // @init
        for (int price : prices) { // @loop
            minPrice = Math.min(minPrice, price); // @min
            best = Math.max(best, price - minPrice); // @best
        }
        return best; // @return
    }
}`,({prices},emit)=>{const a=array(prices,'prices',{positive:true});let minPrice=Infinity,best=0;emit('init',a,[],'最低价未知，利润初始化为 0。',{minPrice:'∞',best});for(let i=0;i<a.length;i++){const price=a[i];emit('loop',a,[i],'考虑今天的价格。',{i,price,minPrice:minPrice===Infinity?'∞':minPrice,best});minPrice=Math.min(minPrice,price);emit('min',a,[i],'更新截至今天的最低买入价。',{i,price,minPrice,best});best=Math.max(best,price-minPrice);emit('best',a,[i],`以今天卖出，利润为 ${price-minPrice}。`,{i,price,minPrice,best});}emit('return',a,[],`最大利润为 ${best}。`,{best});return best;}),
55:lesson({id:55,signature:'public boolean canJump(int[] nums)',sample:{nums:[2,3,1,1,4]},expected:true,call:'new Solution().canJump(new int[]{2,3,1,1,4})',description:'从数组下标 0 出发，每个元素表示该位置最多能向右跳多少步。判断是否能到达最后一个位置。',idea:'维护当前能到达的最远位置 far。只有可达位置才能扩展 far；扫描遇到 i > far 时，当前位置和之后的位置都无法到达。',invariant:'[0, far] 内的每个位置都可达；far 只会增加。',time:'O(n)',space:'O(1)'},`class Solution {
    public boolean canJump(int[] nums) {
        int far = 0; // @init
        for (int i = 0; i < nums.length; i++) { // @loop
            if (i > far) return false; // @blocked
            far = Math.max(far, i + nums[i]); // @extend
        }
        return true; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:1,positive:true});let far=0;emit('init',a,[0],'起点可达。',{far});for(let i=0;i<a.length;i++){emit('loop',a,[i],'检查下一个位置。',{i,far});if(i>far){emit('blocked',a,[i],'当前位置超出可达范围，无法到达终点。',{i,far});return false;}emit('blocked',a,[i],'当前位置可达。',{i,far});far=Math.max(far,i+a[i]);emit('extend',a,[i],`最远可达下标更新为 ${far}。`,{i,far});}emit('return',a,[a.length-1],'扫描结束，终点可达。',{far});return true;}),
45:lesson({id:45,signature:'public int jump(int[] nums)',sample:{nums:[2,3,1,1,4]},expected:2,call:'new Solution().jump(new int[]{2,3,1,1,4})',description:'给定保证能够到达终点的非负跳跃数组，求从下标 0 到最后一个位置的最少跳跃次数。',idea:'把跳跃按层处理：end 是当前跳数能覆盖的边界，far 是这一层能扩展的最远边界。扫描到 end 时，增加一次跳跃并切换到下一层。',invariant:'扫描当前层时，far 汇总这一层所有位置的最远落点。',time:'O(n)',space:'O(1)'},`class Solution {
    public int jump(int[] nums) {
        int end = 0, far = 0, jumps = 0; // @init
        for (int i = 0; i < nums.length - 1; i++) { // @loop
            far = Math.max(far, i + nums[i]); // @extend
            if (i == end) { // @boundary
                jumps++; // @jump
                end = far; // @next-layer
            }
        }
        return jumps; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:1,positive:true});let reach=0;for(let i=0;i<a.length;i++){if(i>reach)throw Error('本题输入须保证能够到达终点');reach=Math.max(reach,i+a[i]);}let end=0,far=0,jumps=0;const vars=i=>({i,end,far,jumps});emit('init',a,[0],'当前层只包含起点。',vars(0));for(let i=0;i<a.length-1;i++){emit('loop',a,[i],'扫描当前层的位置。',vars(i));far=Math.max(far,i+a[i]);emit('extend',a,[i],'汇总这一层能到达的最远位置。',vars(i));emit('boundary',a,[i],i===end?'当前层扫描完成。':'当前层还有位置需要扫描。',vars(i));if(i===end){jumps++;emit('jump',a,[i],'跳跃次数加一。',vars(i));end=far;emit('next-layer',a,end<a.length?[end]:[],'下一层覆盖到 far。',vars(i));}}emit('return',a,[a.length-1],`最少跳跃 ${jumps} 次。`,{jumps});return jumps;}),
763:lesson({id:763,signature:'public List<Integer> partitionLabels(String s)',sample:{s:'ababcbacadefegdehijhklij'},expected:[9,7,8],call:'new Solution().partitionLabels("ababcbacadefegdehijhklij")',description:'将小写字符串划分为尽可能多的连续片段，使每个字母只出现在一个片段中。返回每个片段的长度。',idea:'先记录每个字母最后出现的位置。扫描一个片段时，不断扩展 end 到已见字母的最晚位置；当 i = end 时，当前片段可以结束。',invariant:'当前片段内已经遇到的字母，其全部出现位置都不超过 end。',time:'O(n)',space:'O(26)，不含输出',mode:'string',valueLabel:'字符 / s',stateLabel:'字母最后出现位置'},`class Solution {
    public List<Integer> partitionLabels(String s) {
        int[] last = new int[26]; // @init
        for (int i = 0; i < s.length(); i++) last[s.charAt(i) - 'a'] = i; // @last
        List<Integer> ans = new ArrayList<>(); // @ans
        int start = 0, end = 0; // @state
        for (int i = 0; i < s.length(); i++) { // @loop
            end = Math.max(end, last[s.charAt(i) - 'a']); // @extend
            if (i == end) { // @boundary
                ans.add(end - start + 1); // @save
                start = i + 1; // @next
            }
        }
        return ans; // @return
    }
}`,({s},emit)=>{text(s);if(!/^[a-z]*$/.test(s))throw Error('s 只允许小写英文字母');const v=[...s],last=new Map(),ans=[];emit('init',v,[],'创建最后出现位置表。');for(let i=0;i<s.length;i++){last.set(s[i],i);emit('last',v,[i],'更新这个字母的最后出现位置。',{i},[...last]);}emit('ans',v,[],'创建片段长度列表。');let start=0,end=0;emit('state',v,[],'开始第一个片段。',{start,end});for(let i=0;i<s.length;i++){emit('loop',v,[i],'扫描当前字符。',{i,start,end},[...last]);end=Math.max(end,last.get(s[i]));const active=Array.from({length:i-start+1},(_,j)=>start+j);emit('extend',v,active,'片段必须包含当前字母的最后一次出现。',{i,start,end},[...last]);emit('boundary',v,active,i===end?'到达边界，所有已见字母都已完整包含。':'当前片段还不能结束。',{i,start,end},[...last]);if(i===end){ans.push(end-start+1);emit('save',v,active,`记录片段长度 ${end-start+1}。`,{i,start,end,output:ans.join(',')},[...last]);start=i+1;emit('next',v,[],'从下一个位置开始新片段。',{i,start,end},[...last]);}}emit('return',v,[],`返回片段长度 ${JSON.stringify(ans)}。`,{},[...last]);return ans;})
};
