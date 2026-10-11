import {lesson,array} from './lesson-kit.mjs';
export const pointerLessons={
11:lesson({id:11,signature:'public int maxArea(int[] height)',sample:{height:[1,8,6,2,5,4,8,3,7]},expected:49,call:'new Solution().maxArea(new int[]{1,8,6,2,5,4,8,3,7})',description:'从非负高度数组中选择两根竖线，与横轴围成容器，求容器能盛水的最大面积。',idea:'面积由较短的线和宽度决定。宽度逐渐缩小时，移动较高的线不会提高当前短板；移动较短的线才有机会找到更大的面积。',invariant:'每次淘汰的短边无法与区间内其他位置组成更优答案。',time:'O(n)',space:'O(1)',valueLabel:'高度 / height'},`class Solution {
    public int maxArea(int[] height) {
        int left = 0, right = height.length - 1, best = 0; // @init
        while (left < right) { // @loop
            int area = Math.min(height[left], height[right]) * (right - left); // @area
            best = Math.max(best, area); // @best
            if (height[left] < height[right]) left++; // @left
            else right--; // @right
        }
        return best; // @return
    }
}`,({height},emit)=>{const a=array(height,'height',{min:2,positive:true});let left=0,right=a.length-1,best=0;const vars=()=>({left,right,best});emit('init',a,[left,right],'从最宽的容器开始。',vars());while(left<right){emit('loop',a,[left,right],'检查左右边界。',vars());const area=Math.min(a[left],a[right])*(right-left);emit('area',a,[left,right],`短板 × 宽度 = ${Math.min(a[left],a[right])} × ${right-left} = ${area}。`,{...vars(),area});best=Math.max(best,area);emit('best',a,[left,right],'保留目前最大面积。',vars());if(a[left]<a[right]){left++;emit('left',a,[left,right],'左侧更短，移动左指针。',vars());}else{right--;emit('right',a,[left,right],'右侧不高于左侧，移动右指针。',vars());}}emit('return',a,[],`最大面积为 ${best}。`,vars());return best;}),
15:lesson({id:15,signature:'public List<List<Integer>> threeSum(int[] nums)',sample:{nums:[-1,0,1,2,-1,-4]},expected:[[-1,-1,2],[-1,0,1]],call:'new Solution().threeSum(new int[]{-1,0,1,2,-1,-4})',description:'找出数组中三个不同位置的数，使它们之和为零。返回所有不重复的三元组。',idea:'排序后固定第一个数，在剩余区间用双指针查找。和偏小则移动左边，和偏大则移动右边；跳过重复值避免重复答案。',invariant:'固定 i 后，双指针只向内移动；已跳过的重复值不会产生新的三元组。',time:'O(n²)',space:'O(log n)，排序栈，不含输出',stateLabel:'已找到的三元组'},`class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        Arrays.sort(nums); // @sort
        List<List<Integer>> ans = new ArrayList<>(); // @init
        for (int i = 0; i < nums.length - 2; i++) { // @loop
            if (i > 0 && nums[i] == nums[i - 1]) continue; // @skip
            int left = i + 1, right = nums.length - 1; // @pointers
            while (left < right) { // @while
                int sum = nums[i] + nums[left] + nums[right]; // @sum
                if (sum < 0) left++; // @left
                else if (sum > 0) right--; // @right
                else {
                    ans.add(Arrays.asList(nums[i], nums[left], nums[right])); // @found
                    int a = nums[left], b = nums[right]; // @remember
                    while (left < right && nums[left] == a) left++; // @dedup-left
                    while (left < right && nums[right] == b) right--; // @dedup-right
                }
            }
        }
        return ans; // @return
    }
}`,({nums},emit)=>{const a=array(nums).sort((x,y)=>x-y),ans=[];const memory=()=>ans.map((v,i)=>[i,JSON.stringify(v)]);emit('sort',a,[],'先排序，让指针移动具有单调性。');emit('init',a,[],'创建结果列表。');for(let i=0;i<a.length-2;i++){emit('loop',a,[i],'固定第一个数。',{i},memory());emit('skip',a,[i],i>0&&a[i]===a[i-1]?'跳过重复的第一个数。':'第一个数没有重复。',{i},memory());if(i>0&&a[i]===a[i-1])continue;let left=i+1,right=a.length-1;emit('pointers',a,[i,left,right],'设置左右指针。',{i,left,right},memory());while(left<right){let vars={i,left,right};emit('while',a,[i,left,right],'左右指针还未相遇。',vars,memory());const sum=a[i]+a[left]+a[right];emit('sum',a,[i,left,right],`三个数的和为 ${sum}。`,{...vars,sum},memory());if(sum<0){left++;emit('left',a,[i,left,right],'和偏小，左指针右移。',{i,left,right},memory());}else if(sum>0){right--;emit('right',a,[i,left,right],'和偏大，右指针左移。',{i,left,right},memory());}else{ans.push([a[i],a[left],a[right]]);emit('found',a,[i,left,right],'找到一组答案。',vars,memory());const x=a[left],y=a[right];emit('remember',a,[left,right],'记住当前两端的值。',{...vars,a:x,b:y},memory());while(left<right&&a[left]===x){left++;emit('dedup-left',a,[i,left,right],'跳过重复的左端值。',{i,left,right},memory());}while(left<right&&a[right]===y){right--;emit('dedup-right',a,[i,left,right],'跳过重复的右端值。',{i,left,right},memory());}}}}emit('return',a,[],`返回 ${ans.length} 个不重复三元组。`,{},memory());return ans;}),
42:lesson({id:42,signature:'public int trap(int[] height)',sample:{height:[0,1,0,2,1,0,1,3,2,1,2,1]},expected:6,call:'new Solution().trap(new int[]{0,1,0,2,1,0,1,3,2,1,2,1})',description:'非负整数表示宽度为 1 的柱子高度。求下雨后柱子之间能积存多少单位水。',idea:'某个位置的水位由两边最高柱子的较小者决定。双指针每次处理当前较低的一侧，更新这一侧的最高值并累加水量。',invariant:'已处理位置的积水量已经确定，未处理区域位于 left 与 right 之间。',time:'O(n)',space:'O(1)',valueLabel:'柱子高度 / height'},`class Solution {
    public int trap(int[] height) {
        int left = 0, right = height.length - 1; // @init
        int leftMax = 0, rightMax = 0, water = 0; // @state
        while (left <= right) { // @loop
            if (height[left] <= height[right]) { // @compare
                leftMax = Math.max(leftMax, height[left]); // @left-max
                water += leftMax - height[left]; // @left-water
                left++; // @left
            } else {
                rightMax = Math.max(rightMax, height[right]); // @right-max
                water += rightMax - height[right]; // @right-water
                right--; // @right
            }
        }
        return water; // @return
    }
}`,({height},emit)=>{const a=array(height,'height',{positive:true});let left=0,right=a.length-1,leftMax=0,rightMax=0,water=0;const vars=()=>({left,right,leftMax,rightMax,water});emit('init',a,[],'从两端开始。',{left,right});emit('state',a,[],'初始化左右最高柱子和总水量。',vars());while(left<=right){emit('loop',a,[left,right],'区间仍有未处理的柱子。',vars());emit('compare',a,[left,right],'处理当前高度更低的一侧。',vars());if(a[left]<=a[right]){leftMax=Math.max(leftMax,a[left]);emit('left-max',a,[left],'更新左侧最高值。',vars());const added=leftMax-a[left];water+=added;emit('left-water',a,[left],`当前位置积水 ${added}，累计 ${water}。`,vars());left++;emit('left',a,[],'左指针向内移动。',vars());}else{rightMax=Math.max(rightMax,a[right]);emit('right-max',a,[right],'更新右侧最高值。',vars());const added=rightMax-a[right];water+=added;emit('right-water',a,[right],`当前位置积水 ${added}，累计 ${water}。`,vars());right--;emit('right',a,[],'右指针向内移动。',vars());}}emit('return',a,[],`总积水量为 ${water}。`,vars());return water;})
};
