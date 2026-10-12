import {lesson,array,integer,text} from './lesson-kit.mjs';
export const dpLessons={
118:lesson({id:118,signature:'public List<List<Integer>> generate(int numRows)',sample:{numRows:5},expected:[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]],call:'new Solution().generate(5)',description:'生成杨辉三角的前 numRows 行。每行两端为 1，其余元素等于上一行相邻两个元素之和。',idea:'逐行建立状态。第 r 行第 c 个元素来自上一行的 c−1 和 c，边界位置直接填写 1。',invariant:'计算一行之前，所有之前的行都已经完整生成。',time:'O(r²)',space:'O(r²)，输出',stateLabel:'已经生成的行',valueLabel:'当前行'},`class Solution {
    public List<List<Integer>> generate(int numRows) {
        List<List<Integer>> triangle = new ArrayList<>(); // @init
        for (int r = 0; r < numRows; r++) { // @row
            List<Integer> row = new ArrayList<>(); // @row-init
            for (int c = 0; c <= r; c++) { // @column
                if (c == 0 || c == r) row.add(1); // @edge
                else row.add(triangle.get(r - 1).get(c - 1) + triangle.get(r - 1).get(c)); // @sum
            }
            triangle.add(row); // @save
        }
        return triangle; // @return
    }
}`,({numRows},emit)=>{integer(numRows,'numRows',0,10);const triangle=[],memory=()=>triangle.map((v,i)=>[i+1,v.join(' ')]);emit('init',[],[],'创建三角形结果。');for(let r=0;r<numRows;r++){emit('row',[],[],'开始生成下一行。',{r},memory());const row=[];emit('row-init',row,[],'当前行暂时为空。',{r},memory());for(let c=0;c<=r;c++){emit('column',row,[],'计算当前列。',{r,c},memory());if(c===0||c===r){row.push(1);emit('edge',row,[c],'两端的元素为 1。',{r,c},memory());}else{const left=triangle[r-1][c-1],right=triangle[r-1][c];row.push(left+right);emit('sum',row,[c],`${left} + ${right} = ${left+right}。`,{r,c,left,right},memory());}}triangle.push([...row]);emit('save',row,[],'这一行完成，加入结果。',{r},memory());}emit('return',triangle.at(-1)||[],[],`返回 ${numRows} 行。`,{},memory());return triangle;}),
198:lesson({id:198,signature:'public int rob(int[] nums)',sample:{nums:[2,7,9,3,1]},expected:12,call:'new Solution().rob(new int[]{2,7,9,3,1})',description:'每间房有一个非负金额，不能同时选择相邻房屋。求能够取得的最大金额。',idea:'处理当前房屋时，只有两种选择：跳过它，保留前一间的最优值；选择它，把金额加到前两间的最优值。两个变量保存这两个状态。',invariant:'计算当前房屋前，prev1 是前 i 间的最优值，prev2 是前 i−1 间的最优值。',time:'O(n)',space:'O(1)'},`class Solution {
    public int rob(int[] nums) {
        int prev2 = 0, prev1 = 0; // @init
        for (int amount : nums) { // @loop
            int current = Math.max(prev1, prev2 + amount); // @choice
            prev2 = prev1; // @shift-two
            prev1 = current; // @shift-one
        }
        return prev1; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{positive:true});let prev2=0,prev1=0;emit('init',a,[],'还未处理任何房屋，收益为 0。',{prev2,prev1});for(let i=0;i<a.length;i++){const amount=a[i];emit('loop',a,[i],'考虑当前房屋。',{i,amount,prev2,prev1});const current=Math.max(prev1,prev2+amount);emit('choice',a,[i],`跳过收益 ${prev1}；选择收益 ${prev2+amount}。`,{i,amount,prev2,prev1,current});prev2=prev1;emit('shift-two',a,[i],'前两间状态向前移动。',{i,prev2,prev1,current});prev1=current;emit('shift-one',a,[i],'记录当前最优收益。',{i,prev2,prev1});}emit('return',a,[],`最大收益为 ${prev1}。`,{answer:prev1});return prev1;}),
279:lesson({id:279,signature:'public int numSquares(int n)',sample:{n:12},expected:3,call:'new Solution().numSquares(12)',description:'把正整数 n 表示为若干完全平方数之和，返回所需平方数的最少数量。平方数可以重复使用。',idea:'dp[x] 表示组成 x 的最少平方数数量。枚举最后一个平方数 j²，候选值为 dp[x−j²]+1，取所有候选中的最小值。',invariant:'计算 dp[x] 时，所有较小金额的最优值已经确定。',time:'O(n √n)',space:'O(n)',valueLabel:'最少数量 / dp',stateLabel:'本次转移'},`class Solution {
    public int numSquares(int n) {
        int[] dp = new int[n + 1]; // @init
        for (int x = 1; x <= n; x++) { // @amount
            dp[x] = x; // @upper
            for (int j = 1; j * j <= x; j++) { // @square
                dp[x] = Math.min(dp[x], dp[x - j * j] + 1); // @update
            }
        }
        return dp[n]; // @return
    }
}`,({n},emit)=>{integer(n,'n',1,32);const dp=Array(n+1).fill(0);emit('init',dp,[],'dp[0] = 0，其余状态依次计算。',{n});for(let x=1;x<=n;x++){emit('amount',dp,[x],`计算组成 ${x} 的最少数量。`,{x});dp[x]=x;emit('upper',dp,[x],'用 x 个 1² 一定可以组成 x。',{x});for(let j=1;j*j<=x;j++){emit('square',dp,[x-j*j,x],`尝试最后一个平方数 ${j*j}。`,{x,j});const candidate=dp[x-j*j]+1;dp[x]=Math.min(dp[x],candidate);emit('update',dp,[x-j*j,x],`dp[${x-j*j}] + 1 = ${candidate}。`,{x,j,candidate},[['来源',x-j*j],['目标',x]]);}}emit('return',dp,[n],`最少需要 ${dp[n]} 个平方数。`,{answer:dp[n]});return dp[n];}),
322:lesson({id:322,signature:'public int coinChange(int[] coins, int amount)',sample:{coins:[1,2,5],amount:11},expected:3,call:'new Solution().coinChange(new int[]{1,2,5},11)',description:'每种正整数面额的硬币可以无限使用，求凑成 amount 所需的最少枚数。无法凑成时返回 −1，金额为 0 时返回 0。',idea:'dp[x] 表示凑成金额 x 的最少枚数。尝试每一种作为最后一枚硬币，利用 dp[x−coin]+1 更新。amount+1 用来表示暂时不可达。',invariant:'计算金额 x 时，所有更小金额的最优值已经确定。',time:'O(amount × 硬币种类)',space:'O(amount)',valueLabel:'最少枚数 / dp',stateLabel:'硬币面额'},`class Solution {
    public int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1]; // @init
        Arrays.fill(dp, amount + 1); // @infinity
        dp[0] = 0; // @zero
        for (int x = 1; x <= amount; x++) { // @amount
            for (int coin : coins) { // @coin
                if (coin <= x) dp[x] = Math.min(dp[x], dp[x - coin] + 1); // @update
            }
        }
        return dp[amount] > amount ? -1 : dp[amount]; // @return
    }
}`,({coins,amount},emit)=>{const a=array(coins,'coins',{max:8});if(a.some(v=>v<=0))throw Error('硬币面额须为正整数');integer(amount,'amount',0,32);const dp=Array(amount+1).fill(0),memory=a.map((v,i)=>[i,v]);emit('init',dp,[],'创建金额状态数组。',{amount},memory);dp.fill(amount+1);emit('infinity',dp,[],'先用 amount+1 标记不可达。',{amount},memory);dp[0]=0;emit('zero',dp,[0],'凑成 0 不需要硬币。',{amount},memory);for(let x=1;x<=amount;x++){emit('amount',dp,[x],`计算金额 ${x}。`,{x},memory);for(const coin of a){emit('coin',dp,[x],`尝试最后一枚硬币 ${coin}。`,{x,coin},memory);if(coin<=x)dp[x]=Math.min(dp[x],dp[x-coin]+1);emit('update',dp,coin<=x?[x-coin,x]:[x],coin<=x?'用较小金额的解加一枚硬币更新。':'面额超过当前金额，不能使用。',{x,coin},memory);}}const ans=dp[amount]>amount?-1:dp[amount];emit('return',dp,[amount],ans<0?'无法凑成目标金额。':`最少需要 ${ans} 枚硬币。`,{answer:ans},memory);return ans;}),
139:lesson({id:139,signature:'public boolean wordBreak(String s, List<String> wordDict)',sample:{s:'leetcode',wordDict:['leet','code']},expected:true,call:'new Solution().wordBreak("leetcode",Arrays.asList("leet","code"))',description:'判断字符串 s 能否分割为字典中的若干非空单词。字典中的单词可以重复使用。',idea:'dp[end] 表示前 end 个字符能否成功拆分。如果某个可拆分前缀 start 后面恰好跟着字典单词，就标记新的前缀为可拆分。',invariant:'dp[0] 为 true，dp[end] 只会由已确定可拆分的更短前缀转移而来。',time:'O(n × 字典大小 × 最长单词长度)',space:'O(n)',mode:'string',valueLabel:'字符 / s',stateLabel:'前缀可拆分 / dp'},`class Solution {
    public boolean wordBreak(String s, List<String> wordDict) {
        boolean[] dp = new boolean[s.length() + 1]; // @init
        dp[0] = true; // @zero
        for (int start = 0; start < s.length(); start++) { // @start
            if (!dp[start]) continue; // @reachable
            for (String word : wordDict) { // @word
                if (s.startsWith(word, start)) { // @match
                    dp[start + word.length()] = true; // @mark
                }
            }
        }
        return dp[s.length()]; // @return
    }
}`,({s,wordDict},emit)=>{text(s,'s',24);if(!Array.isArray(wordDict)||wordDict.length>12)throw Error('wordDict 最多包含 12 个非空单词');wordDict.forEach(w=>{text(w,'字典单词',16);if(!w.length)throw Error('字典不能包含空单词');});const v=[...s],dp=Array(s.length+1).fill(false),memory=()=>dp.map((x,i)=>[i,x?'可拆分':'不可达']);emit('init',v,[],'创建前缀可拆分状态。',{},memory());dp[0]=true;emit('zero',v,[],'空前缀可以拆分。',{},memory());for(let start=0;start<s.length;start++){emit('start',v,[start],'尝试从这个前缀之后添加单词。',{start},memory());emit('reachable',v,[start],dp[start]?'当前前缀可以拆分。':'前缀不可拆分，跳过。',{start},memory());if(!dp[start])continue;for(const word of wordDict){emit('word',v,[start],`尝试字典单词 ${word}。`,{start,word},memory());const match=s.startsWith(word,start);emit('match',v,[start],match?'后续字符匹配这个单词。':'后续字符不匹配。',{start,word},memory());if(match){dp[start+word.length]=true;emit('mark',v,Array.from({length:word.length},(_,i)=>start+i),'将匹配后的前缀标记为可拆分。',{start,word,end:start+word.length},memory());}}}emit('return',v,[],dp[s.length]?'整个字符串能够拆分。':'整个字符串无法拆分。',{answer:dp[s.length]},memory());return dp[s.length];}),
300:lesson({id:300,signature:'public int lengthOfLIS(int[] nums)',sample:{nums:[10,9,2,5,3,7,101,18]},expected:4,call:'new Solution().lengthOfLIS(new int[]{10,9,2,5,3,7,101,18})',description:'返回数组中严格递增子序列的最长长度。子序列允许跳过元素，但保留原来的相对顺序。',idea:'dp[i] 表示必须以 nums[i] 结尾的最长递增子序列长度。枚举此前更小的元素 j，尝试用 dp[j]+1 连接到当前元素。',invariant:'计算 dp[i] 时，所有 j < i 的最优长度已经确定。',time:'O(n²)，教学解法',space:'O(n)',stateLabel:'以该下标结尾的最长长度 / dp'},`class Solution {
    public int lengthOfLIS(int[] nums) {
        int[] dp = new int[nums.length]; // @init
        Arrays.fill(dp, 1); // @ones
        int best = 0; // @best-init
        for (int i = 0; i < nums.length; i++) { // @i
            for (int j = 0; j < i; j++) { // @j
                if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1); // @update
            }
            best = Math.max(best, dp[i]); // @best
        }
        return best; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{max:18}),dp=Array(a.length).fill(0),memory=()=>dp.map((v,i)=>[i,v]);emit('init',a,[],'创建子序列长度状态。',{},memory());dp.fill(1);emit('ones',a,[],'每个元素单独构成长度 1 的子序列。',{},memory());let best=0;emit('best-init',a,[],'全局最长长度从 0 开始。',{best},memory());for(let i=0;i<a.length;i++){emit('i',a,[i],'计算以当前元素结尾的最优长度。',{i,best},memory());for(let j=0;j<i;j++){emit('j',a,[j,i],'尝试连接此前的元素。',{i,j,best},memory());if(a[j]<a[i])dp[i]=Math.max(dp[i],dp[j]+1);emit('update',a,[j,i],a[j]<a[i]?`可以连接，候选长度 ${dp[j]+1}。`:'前值不小于当前值，不能连接。',{i,j,best},memory());}best=Math.max(best,dp[i]);emit('best',a,[i],'更新全局最长长度。',{i,best},memory());}emit('return',a,[],`最长递增子序列长度为 ${best}。`,{best},memory());return best;}),
152:lesson({id:152,signature:'public int maxProduct(int[] nums)',sample:{nums:[2,3,-2,4]},expected:6,call:'new Solution().maxProduct(new int[]{2,3,-2,4})',description:'在非空整数数组中选一个非空连续子数组，使其乘积最大，返回这个最大乘积。',idea:'负数会交换最大值与最小值的作用，所以同时保存以当前位置结尾的最大乘积和最小乘积。每个状态都从当前数、旧最大乘当前数、旧最小乘当前数中选择。',invariant:'maxEnd、minEnd 分别是必须以当前位置结尾的最大和最小乘积。',time:'O(n)',space:'O(1)'},`class Solution {
    public int maxProduct(int[] nums) {
        int maxEnd = nums[0], minEnd = nums[0], best = nums[0]; // @init
        for (int i = 1; i < nums.length; i++) { // @loop
            int a = maxEnd * nums[i], b = minEnd * nums[i]; // @candidates
            maxEnd = Math.max(nums[i], Math.max(a, b)); // @max
            minEnd = Math.min(nums[i], Math.min(a, b)); // @min
            best = Math.max(best, maxEnd); // @best
        }
        return best; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:1,max:10});if(a.some(v=>Math.abs(v)>5))throw Error('乘积演示的元素绝对值最多为 5');let maxEnd=a[0],minEnd=a[0],best=a[0];emit('init',a,[0],'从第一个非空子数组开始。',{maxEnd,minEnd,best});for(let i=1;i<a.length;i++){emit('loop',a,[i],'考虑新的结尾元素。',{i,maxEnd,minEnd,best});const x=maxEnd*a[i],y=minEnd*a[i];emit('candidates',a,[i],'先用旧状态计算两个延续候选，避免覆盖后再使用。',{i,a:x,b:y,maxEnd,minEnd,best});maxEnd=Math.max(a[i],x,y);emit('max',a,[i],'选择当前最大结尾乘积。',{i,maxEnd,minEnd,best});minEnd=Math.min(a[i],x,y);emit('min',a,[i],'同时保留最小乘积，供之后的负数使用。',{i,maxEnd,minEnd,best});best=Math.max(best,maxEnd);emit('best',a,[i],'更新全局最大乘积。',{i,maxEnd,minEnd,best});}emit('return',a,[],`最大乘积为 ${best}。`,{best});return best;}),
416:lesson({id:416,signature:'public boolean canPartition(int[] nums)',sample:{nums:[1,5,11,5]},expected:true,call:'new Solution().canPartition(new int[]{1,5,11,5})',description:'判断正整数数组能否分成两个子集，使两部分的元素和相等。每个位置只能使用一次。',idea:'总和必须为偶数，问题转化为能否选出和为总和一半的子集。一维 0/1 背包从大到小更新，避免当前元素被重复使用。',invariant:'处理当前数之前，dp 只表示用此前元素可达的和；倒序更新保持这个条件。',time:'O(n × 总和)',space:'O(总和)',valueLabel:'子集和是否可达 / dp',stateLabel:'原数组'},`class Solution {
    public boolean canPartition(int[] nums) {
        int total = 0; // @init
        for (int x : nums) total += x; // @total
        if (total % 2 != 0) return false; // @odd
        int target = total / 2; // @target
        boolean[] dp = new boolean[target + 1]; // @dp
        dp[0] = true; // @zero
        for (int x : nums) { // @number
            for (int sum = target; sum >= x; sum--) { // @backward
                dp[sum] = dp[sum] || dp[sum - x]; // @update
            }
        }
        return dp[target]; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:1});if(a.some(v=>v<=0)||a.reduce((s,v)=>s+v,0)>64)throw Error('演示只接受正整数且总和最多为 64');let total=0;emit('init',a,[],'计算数组总和。',{total});for(let i=0;i<a.length;i++){total+=a[i];emit('total',a,[i],'累加当前元素。',{total});}emit('odd',a,[],total%2?'总和是奇数，不可能平分。':'总和是偶数，继续寻找一半。',{total});if(total%2)return false;const target=total/2;emit('target',a,[],'把问题转成目标和的子集选择。',{total,target});const dp=Array(target+1).fill(false),values=()=>dp.map(v=>v?'✓':'·'),memory=a.map((v,i)=>[i,v]);emit('dp',values(),[],'创建可达性状态数组。',{target},memory);dp[0]=true;emit('zero',values(),[0],'不选任何元素即可得到 0。',{target},memory);for(const x of a){emit('number',values(),[],'处理一个新的数。',{x,target},memory);for(let sum=target;sum>=x;sum--){emit('backward',values(),[sum-x,sum],'倒序遍历，防止当前数重复使用。',{x,sum,target},memory);dp[sum]=dp[sum]||dp[sum-x];emit('update',values(),[sum-x,sum],dp[sum]?'这个和已经可达或能从较小状态转移。':'当前元素无法让这个和可达。',{x,sum,target},memory);}}emit('return',values(),[target],dp[target]?'能选出一半总和，因此可以平分。':'无法选出一半总和。',{target,answer:dp[target]},memory);return dp[target];}),
32:lesson({id:32,signature:'public int longestValidParentheses(String s)',sample:{s:')()())'},expected:4,call:'new Solution().longestValidParentheses(")()())")',description:'字符串只包含左、右圆括号。求最长的连续有效括号子串长度。',idea:'dp[i] 表示以位置 i 结尾的有效子串长度。右括号前若是左括号，直接组成一对；若前面已是一段有效括号，则向前跨过这段，寻找配对左括号，再连接更早的有效段。',invariant:'dp[i] 只记录必须以 i 结尾的有效长度，左括号位置的值为 0。',time:'O(n)',space:'O(n)',mode:'string',valueLabel:'括号 / s',stateLabel:'有效长度 / dp'},`class Solution {
    public int longestValidParentheses(String s) {
        int[] dp = new int[s.length()]; // @init
        int best = 0; // @best-init
        for (int i = 1; i < s.length(); i++) { // @loop
            if (s.charAt(i) == ')') { // @close
                if (s.charAt(i - 1) == '(') { // @pair
                    dp[i] = 2 + (i >= 2 ? dp[i - 2] : 0); // @direct
                } else {
                    int j = i - dp[i - 1] - 1; // @jump
                    if (j >= 0 && s.charAt(j) == '(') { // @match
                        dp[i] = dp[i - 1] + 2 + (j >= 1 ? dp[j - 1] : 0); // @nested
                    }
                }
                best = Math.max(best, dp[i]); // @best
            }
        }
        return best; // @return
    }
}`,({s},emit)=>{text(s);if(!/^[()]*$/.test(s))throw Error('s 只能包含圆括号');const v=[...s],dp=Array(s.length).fill(0),memory=()=>dp.map((v,i)=>[i,v]);emit('init',v,[],'初始化以每个位置结尾的有效长度。',{},memory());let best=0;emit('best-init',v,[],'最长长度为 0。',{best},memory());for(let i=1;i<s.length;i++){emit('loop',v,[i],'考虑当前结尾位置。',{i,best},memory());emit('close',v,[i],s[i]===')'?'右括号可能形成有效结尾。':'左括号不能作为有效子串结尾。',{i,best},memory());if(s[i]!==')')continue;emit('pair',v,[i-1,i],s[i-1]==='('?'相邻字符直接组成一对。':'前面也是右括号，向前跨过已有有效段。',{i,best},memory());if(s[i-1]==='('){dp[i]=2+(i>=2?dp[i-2]:0);emit('direct',v,[i-1,i],'当前一对加上前面的有效段。',{i,best},memory());}else{const j=i-dp[i-1]-1;emit('jump',v,j>=0?[j,i]:[i],'跨过前一段，寻找匹配左括号。',{i,j,best},memory());emit('match',v,j>=0?[j,i]:[i],j>=0&&s[j]==='('?'找到配对左括号。':'不存在可配对左括号。',{i,j,best},memory());if(j>=0&&s[j]==='('){dp[i]=dp[i-1]+2+(j>=1?dp[j-1]:0);emit('nested',v,Array.from({length:dp[i]},(_,k)=>i-dp[i]+1+k),'连接内部有效段、当前一对和左侧有效段。',{i,j,best},memory());}}best=Math.max(best,dp[i]);emit('best',v,[i],'更新最长长度。',{i,best},memory());}emit('return',v,[],`最长有效括号长度为 ${best}。`,{best},memory());return best;})
};
