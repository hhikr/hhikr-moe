import {lesson,array,integer} from './lesson-kit.mjs';
export const arrayLessons={
53:lesson({id:53,signature:'public int maxSubArray(int[] nums)',sample:{nums:[-2,1,-3,4,-1,2,1,-5,4]},expected:6,call:'new Solution().maxSubArray(new int[]{-2,1,-3,4,-1,2,1,-5,4})',description:'在非空整数数组中找一个非空连续子数组，使其和最大，返回最大和。',idea:'end 表示以当前位置结尾的最大子数组和。当前位置可以接在上一段之后，也可以重新开始，因此 end = max(x, end+x)。',invariant:'end 是必须以当前位置结尾的最优值；best 是所有结尾位置中最大的值。',time:'O(n)',space:'O(1)'},`class Solution {
    public int maxSubArray(int[] nums) {
        int end = nums[0], best = nums[0]; // @init
        for (int i = 1; i < nums.length; i++) { // @loop
            end = Math.max(nums[i], end + nums[i]); // @end
            best = Math.max(best, end); // @best
        }
        return best; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:1});let end=a[0],best=a[0];emit('init',a,[0],'非空子数组必须至少选择一个元素。',{end,best});for(let i=1;i<a.length;i++){emit('loop',a,[i],'考虑以当前元素结尾的子数组。',{i,end,best});const old=end;end=Math.max(a[i],end+a[i]);emit('end',a,[i],old<0?'前一段和为负，从当前元素重新开始。':'延续前一段不会降低当前和。',{i,end,best});best=Math.max(best,end);emit('best',a,[i],'更新全局最大和。',{i,end,best});}emit('return',a,[],`最大子数组和为 ${best}。`,{best});return best;}),
56:lesson({id:56,signature:'public int[][] merge(int[][] intervals)',sample:{intervals:[[1,3],[2,6],[8,10],[15,18]]},expected:[[1,6],[8,10],[15,18]],call:'new Solution().merge(new int[][]{{1,3},{2,6},{8,10},{15,18}})',print:'System.out.println(Arrays.deepToString(new Solution().merge(new int[][]{{1,3},{2,6},{8,10},{15,18}})));',description:'合并所有有重叠的闭区间，返回互不重叠的区间列表。端点相同也算重叠。',idea:'先按起点排序。若新区间的起点在最后一个结果区间内，就扩展最后的右端点；否则新增区间。',invariant:'结果区间按起点递增且互不重叠；最后一个结果区间吸收所有已扫描的重叠区间。',time:'O(n log n)',space:'O(n)，输出',stateLabel:'合并后的区间',valueLabel:'区间 / intervals'},`class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, Comparator.comparingInt(a -> a[0])); // @sort
        List<int[]> ans = new ArrayList<>(); // @init
        for (int[] current : intervals) { // @loop
            if (ans.isEmpty() || ans.get(ans.size() - 1)[1] < current[0]) { // @compare
                ans.add(current.clone()); // @append
            } else {
                int[] last = ans.get(ans.size() - 1); // @last
                last[1] = Math.max(last[1], current[1]); // @merge
            }
        }
        return ans.toArray(new int[0][]); // @return
    }
}`,({intervals},emit)=>{if(!Array.isArray(intervals)||intervals.length>24)throw Error('intervals 必须是最多 24 个区间的数组');const a=intervals.map(v=>{const x=array(v,'区间',{min:2,max:2});if(x[0]>x[1])throw Error('区间起点不能大于终点');return x;}).sort((x,y)=>x[0]-y[0]),v=a.map(x=>`[${x}]`),ans=[];const memory=()=>ans.map((x,i)=>[i,`[${x}]`]);emit('sort',v,[],'按区间起点排序。');emit('init',v,[],'初始化合并结果。');for(let i=0;i<a.length;i++){const current=a[i];emit('loop',v,[i],'扫描下一个区间。',{i},memory());const append=!ans.length||ans.at(-1)[1]<current[0];emit('compare',v,[i],append?'新区间与已有结果不重叠。':'新区间与最后一个结果区间重叠。',{i},memory());if(append){ans.push([...current]);emit('append',v,[i],'新增一个结果区间。',{i},memory());}else{const last=ans.at(-1);emit('last',v,[i],'取出最后一个结果区间。',{i},memory());last[1]=Math.max(last[1],current[1]);emit('merge',v,[i],'右端点扩展到两者最大值。',{i},memory());}}emit('return',v,[],`得到 ${ans.length} 个互不重叠的区间。`,{},memory());return ans;}),
189:lesson({id:189,signature:'public void rotate(int[] nums, int k)',sample:{nums:[1,2,3,4,5,6,7],k:3},expected:[5,6,7,1,2,3,4],call:'new Solution().rotate(nums,3)',javaSetup:'int[] nums = {1,2,3,4,5,6,7};',javaResult:'nums',print:'int[] nums = {1,2,3,4,5,6,7};\n        new Solution().rotate(nums, 3);\n        System.out.println(Arrays.toString(nums));',description:'将数组原地向右轮转 k 步。k 是非负整数，超出数组长度时取模。',idea:'把数组分成前段 A 和后段 B，目标是 BA。整体翻转得到 reverse(B)reverse(A)，再分别翻转两段，就得到 BA。',invariant:'每次翻转时，区间外的元素已经固定；左右指针向内交换对称元素。',time:'O(n)',space:'O(1)'},`class Solution {
    public void rotate(int[] nums, int k) {
        if (nums.length == 0) return; // @empty
        k %= nums.length; // @mod
        reverse(nums, 0, nums.length - 1); // @all
        reverse(nums, 0, k - 1); // @first
        reverse(nums, k, nums.length - 1); // @second
    }
    private void reverse(int[] nums, int left, int right) {
        while (left < right) { // @loop
            int temp = nums[left]; // @temp
            nums[left] = nums[right]; // @left
            nums[right] = temp; // @right
            left++; right--; // @move
        }
    }
}`,({nums,k},emit)=>{const a=array(nums);integer(k,'k',0);emit('empty',a,[],a.length?'数组非空，开始轮转。':'空数组直接结束。');if(!a.length)return a;k%=a.length;emit('mod',a,[],'轮转步数对数组长度取模。',{k});function reverse(l,r,key,note){emit(key,a,[],note,{left:l,right:r,k});while(l<r){emit('loop',a,[l,r],'翻转区间的两个端点。',{left:l,right:r,k});const temp=a[l];emit('temp',a,[l,r],'暂存左端点。',{left:l,right:r,temp,k});a[l]=a[r];emit('left',a,[l,r],'右端点写入左侧。',{left:l,right:r,temp,k});a[r]=temp;emit('right',a,[l,r],'暂存值写入右侧，完成交换。',{left:l,right:r,temp,k});l++;r--;emit('move',a,[],'两个指针向内移动。',{left:l,right:r,k});}}reverse(0,a.length-1,'all','整体翻转数组。');reverse(0,k-1,'first','翻转前 k 个元素。');reverse(k,a.length-1,'second','翻转剩余元素。');emit('second',a,[],'三次翻转完成，数组已轮转。',{k});return a;}),
238:lesson({id:238,signature:'public int[] productExceptSelf(int[] nums)',sample:{nums:[1,2,3,4]},expected:[24,12,8,6],call:'new Solution().productExceptSelf(new int[]{1,2,3,4})',print:'System.out.println(Arrays.toString(new Solution().productExceptSelf(new int[]{1,2,3,4})));',description:'返回一个数组，其中 ans[i] 是除 nums[i] 之外所有元素的乘积。不使用除法，在线性时间内完成。',idea:'先把每个位置左侧的乘积写入答案，再从右往左乘上右侧乘积。零值不需要特殊处理。',invariant:'第一遍 ans[i] 不包含当前位置；第二遍 right 不包含当前及其左侧元素。',time:'O(n)',space:'O(1)，不含输出',stateLabel:'结果数组 / ans'},`class Solution {
    public int[] productExceptSelf(int[] nums) {
        int[] ans = new int[nums.length]; // @init
        int left = 1; // @left-init
        for (int i = 0; i < nums.length; i++) { // @left-loop
            ans[i] = left; // @left-write
            left *= nums[i]; // @left-multiply
        }
        int right = 1; // @right-init
        for (int i = nums.length - 1; i >= 0; i--) { // @right-loop
            ans[i] *= right; // @right-write
            right *= nums[i]; // @right-multiply
        }
        return ans; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:2});if(a.some(v=>Math.abs(v)>10)||a.length>9)throw Error('乘积演示限制：最多 9 项，每项绝对值不超过 10');const ans=Array(a.length).fill(0),memory=()=>ans.map((v,i)=>[i,v]);emit('init',a,[],'创建结果数组。',{},memory());let left=1;emit('left-init',a,[],'空前缀乘积为 1。',{left},memory());for(let i=0;i<a.length;i++){emit('left-loop',a,[i],'正向遍历。',{i,left},memory());ans[i]=left;emit('left-write',a,[i],'写入当前位置左侧所有元素的乘积。',{i,left},memory());left*=a[i];emit('left-multiply',a,[i],'把当前元素加入前缀积。',{i,left},memory());}let right=1;emit('right-init',a,[],'空后缀乘积为 1。',{right},memory());for(let i=a.length-1;i>=0;i--){emit('right-loop',a,[i],'反向遍历。',{i,right},memory());ans[i]*=right;emit('right-write',a,[i],'左侧积乘右侧积，排除当前元素。',{i,right},memory());right*=a[i];emit('right-multiply',a,[i],'把当前元素加入后缀积。',{i,right},memory());}emit('return',a,[],`返回 ${JSON.stringify(ans)}。`,{},memory());return ans;}),
41:lesson({id:41,signature:'public int firstMissingPositive(int[] nums)',sample:{nums:[3,4,-1,1]},expected:2,call:'new Solution().firstMissingPositive(new int[]{3,4,-1,1})',description:'给定无序整数数组，在线性时间、常数额外空间内找出最小缺失的正整数。',idea:'长度为 n 的数组，答案一定在 1 到 n+1 之间。把合法值 x 放到下标 x−1，重复值已经归位时停止交换。最后第一个 nums[i] != i+1 的位置就是答案。',invariant:'交换会让至少一个合法值归位；已经放在正确位置的值不会被移走。',time:'O(n)',space:'O(1)'},`class Solution {
    public int firstMissingPositive(int[] nums) {
        int n = nums.length; // @init
        for (int i = 0; i < n; i++) { // @loop
            while (nums[i] >= 1 && nums[i] <= n && nums[nums[i] - 1] != nums[i]) { // @valid
                int destination = nums[i] - 1; // @dest
                int temp = nums[destination]; // @temp
                nums[destination] = nums[i]; // @place
                nums[i] = temp; // @restore
            }
        }
        for (int i = 0; i < n; i++) { // @scan
            if (nums[i] != i + 1) return i + 1; // @missing
        }
        return n + 1; // @return
    }
}`,({nums},emit)=>{const a=array(nums),n=a.length;emit('init',a,[],'候选答案范围是 1 到 n+1。',{n});for(let i=0;i<n;i++){emit('loop',a,[i],'检查当前位置是否有值需要归位。',{i,n});while(a[i]>=1&&a[i]<=n&&a[a[i]-1]!==a[i]){emit('valid',a,[i],'当前值合法且目标位置尚未放置该值。',{i,n});const destination=a[i]-1;emit('dest',a,[i,destination],'值 x 应放在下标 x−1。',{i,destination,n});const temp=a[destination];emit('temp',a,[destination],'暂存目标位置的值。',{i,destination,temp});a[destination]=a[i];emit('place',a,[i,destination],'把合法值放到正确位置。',{i,destination,temp});a[i]=temp;emit('restore',a,[i],'把原目标值带回当前位置，继续检查。',{i,destination,temp});}}for(let i=0;i<n;i++){emit('scan',a,[i],'从左到右寻找第一个未归位的位置。',{i});if(a[i]!==i+1){emit('missing',a,[i],`位置 ${i} 缺少正整数 ${i+1}。`,{i,answer:i+1});return i+1;}}emit('return',a,[],`1 到 ${n} 都存在，答案为 ${n+1}。`,{answer:n+1});return n+1;})
};
