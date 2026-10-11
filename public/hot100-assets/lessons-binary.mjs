import {lesson,array,integer,matrix} from './lesson-kit.mjs';
function rotated(value){const a=array(value,'nums',{min:1});if(new Set(a).size!==a.length)throw Error('旋转数组演示不允许重复元素');const drops=a.slice(1).filter((v,i)=>v<a[i]).length;if(drops>1||drops===1&&a.at(-1)>=a[0])throw Error('nums 必须由严格升序数组旋转得到');return a;}
export const binaryLessons={
34:lesson({id:34,signature:'public int[] searchRange(int[] nums, int target)',sample:{nums:[5,7,7,8,8,10],target:8},expected:[3,4],call:'new Solution().searchRange(new int[]{5,7,7,8,8,10},8)',print:'System.out.println(Arrays.toString(new Solution().searchRange(new int[]{5,7,7,8,8,10},8)));',description:'在非递减数组中找到 target 第一次和最后一次出现的位置。不存在时返回 [−1, −1]，要求 O(log n) 时间。',idea:'分别查找第一个大于等于 target 的位置，和第一个严格大于 target 的位置。后者减一就是右端点。两次二分共用同一个边界函数。',invariant:'左闭右开搜索区间不断缩小；upper 决定相等值应留在左侧还是右侧。',time:'O(log n)',space:'O(1)'},`class Solution {
    public int[] searchRange(int[] nums, int target) {
        int start = boundary(nums, target, false); // @start
        if (start == nums.length || nums[start] != target) return new int[]{-1, -1}; // @absent
        int end = boundary(nums, target, true) - 1; // @end
        return new int[]{start, end}; // @return
    }
    private int boundary(int[] nums, int target, boolean upper) {
        int left = 0, right = nums.length; // @init
        while (left < right) { // @loop
            int mid = left + (right - left) / 2; // @mid
            if (nums[mid] < target || (upper && nums[mid] == target)) left = mid + 1; // @left
            else right = mid; // @right
        }
        return left; // @bound-return
    }
}`,({nums,target},emit)=>{const a=array(nums,'nums',{sorted:true});integer(target,'target');function bound(upper){let left=0,right=a.length;emit('init',a,[],'初始化左闭右开搜索区间。',{left,right,target,upper});while(left<right){emit('loop',a,[],'区间仍非空。',{left,right,target,upper});const mid=left+Math.floor((right-left)/2);emit('mid',a,[mid],'取中间位置。',{left,right,mid,target,upper});if(a[mid]<target||upper&&a[mid]===target){left=mid+1;emit('left',a,[mid],upper?'查找严格更大的边界，相等值也移到左侧。':'当前值小于目标，排除左半段。',{left,right,mid,target,upper});}else{right=mid;emit('right',a,[mid],'保留当前候选，缩小右边界。',{left,right,mid,target,upper});}}emit('bound-return',a,left<a.length?[left]:[],'返回边界位置。',{left,right,target,upper});return left;}emit('start',a,[],'先找第一个不小于 target 的位置。',{target});const start=bound(false);if(start===a.length||a[start]!==target){emit('absent',a,[],'目标不存在，返回两个 −1。',{start,target});return [-1,-1];}emit('absent',a,[start],'这个边界确实等于目标。',{start,target});emit('end',a,[start],'再找第一个严格大于目标的位置。',{start,target});const end=bound(true)-1;emit('return',a,Array.from({length:end-start+1},(_,i)=>start+i),`范围为 [${start}, ${end}]。`,{start,end,target});return [start,end];}),
33:lesson({id:33,signature:'public int search(int[] nums, int target)',sample:{nums:[4,5,6,7,0,1,2],target:0},expected:4,call:'new Solution().search(new int[]{4,5,6,7,0,1,2},0)',description:'严格升序数组经过一次旋转，元素互不相同。以 O(log n) 时间查找 target 的下标，不存在时返回 −1。',idea:'每次二分至少有一半仍保持升序。先判断有序的是哪一半，再判断目标是否落在这半段的数值范围内，决定保留哪个区间。',invariant:'若目标存在，它始终位于当前闭区间 [left, right] 中。',time:'O(log n)',space:'O(1)'},`class Solution {
    public int search(int[] nums, int target) {
        int left = 0, right = nums.length - 1; // @init
        while (left <= right) { // @loop
            int mid = left + (right - left) / 2; // @mid
            if (nums[mid] == target) return mid; // @found
            if (nums[left] <= nums[mid]) { // @ordered
                if (nums[left] <= target && target < nums[mid]) right = mid - 1; // @keep-left
                else left = mid + 1; // @discard-left
            } else {
                if (nums[mid] < target && target <= nums[right]) left = mid + 1; // @keep-right
                else right = mid - 1; // @discard-right
            }
        }
        return -1; // @return
    }
}`,({nums,target},emit)=>{const a=rotated(nums);integer(target,'target');let left=0,right=a.length-1;emit('init',a,[],'初始化闭区间。',{left,right,target});while(left<=right){emit('loop',a,[left,right],'检查当前搜索区间。',{left,right,target});const mid=left+Math.floor((right-left)/2);emit('mid',a,[mid],'取中间位置。',{left,right,mid,target});emit('found',a,[mid],a[mid]===target?'找到目标，返回当前下标。':'中间值不是目标。',{left,right,mid,target});if(a[mid]===target)return mid;const ordered=a[left]<=a[mid];emit('ordered',a,[left,mid,right],ordered?'左半段保持升序。':'右半段保持升序。',{left,right,mid,target});if(ordered){if(a[left]<=target&&target<a[mid]){right=mid-1;emit('keep-left',a,[mid],'目标在有序左半段的范围内。',{left,right,mid,target});}else{left=mid+1;emit('discard-left',a,[mid],'目标不在左半段，保留右侧。',{left,right,mid,target});}}else{if(a[mid]<target&&target<=a[right]){left=mid+1;emit('keep-right',a,[mid],'目标在有序右半段的范围内。',{left,right,mid,target});}else{right=mid-1;emit('discard-right',a,[mid],'目标不在右半段，保留左侧。',{left,right,mid,target});}}}emit('return',a,[],'区间为空，目标不存在。',{target});return -1;}),
153:lesson({id:153,signature:'public int findMin(int[] nums)',sample:{nums:[3,4,5,1,2]},expected:1,call:'new Solution().findMin(new int[]{3,4,5,1,2})',description:'严格升序数组经过旋转，元素互不相同。用 O(log n) 时间找到最小值。',idea:'比较中间值和右端点。中间值更大时，最小值在右半段；否则最小值可能就是 mid，保留 mid 并缩小右边界。',invariant:'最小值始终在闭区间 [left, right] 内。',time:'O(log n)',space:'O(1)'},`class Solution {
    public int findMin(int[] nums) {
        int left = 0, right = nums.length - 1; // @init
        while (left < right) { // @loop
            int mid = left + (right - left) / 2; // @mid
            if (nums[mid] > nums[right]) left = mid + 1; // @left
            else right = mid; // @right
        }
        return nums[left]; // @return
    }
}`,({nums},emit)=>{const a=rotated(nums);let left=0,right=a.length-1;emit('init',a,[left,right],'初始化最小值的候选区间。',{left,right});while(left<right){emit('loop',a,[left,right],'还有多个候选位置。',{left,right});const mid=left+Math.floor((right-left)/2);emit('mid',a,[mid,right],'比较中间值与右端点。',{left,right,mid});if(a[mid]>a[right]){left=mid+1;emit('left',a,[mid],'中间值更大，最小值一定在右侧。',{left,right,mid});}else{right=mid;emit('right',a,[mid],'mid 可能就是最小值，保留它。',{left,right,mid});}}emit('return',a,[left],`最小值为 ${a[left]}。`,{left,right,answer:a[left]});return a[left];}),
74:lesson({id:74,signature:'public boolean searchMatrix(int[][] matrix, int target)',sample:{matrix:[[1,3,5,7],[10,11,16,20],[23,30,34,60]],target:3},expected:true,call:'new Solution().searchMatrix(new int[][]{{1,3,5,7},{10,11,16,20},{23,30,34,60}},3)',description:'矩阵每行非递减，后一行第一个数大于前一行最后一个数。判断目标值是否存在。',idea:'按行展开后整个矩阵有序，可以直接做一维二分。下标 mid 对应行 mid/列数、列 mid%列数。',invariant:'目标若存在，展开下标始终位于 [left, right] 中。',time:'O(log(m n))',space:'O(1)',mode:'matrix',valueLabel:'矩阵 / matrix'},`class Solution {
    public boolean searchMatrix(int[][] matrix, int target) {
        int columns = matrix[0].length; // @columns
        int left = 0, right = matrix.length * columns - 1; // @init
        while (left <= right) { // @loop
            int mid = left + (right - left) / 2; // @mid
            int value = matrix[mid / columns][mid % columns]; // @value
            if (value == target) return true; // @found
            if (value < target) left = mid + 1; // @left
            else right = mid - 1; // @right
        }
        return false; // @return
    }
}`,({matrix:input,target},emit)=>{const a=matrix(input),columns=a[0].length,v=a.flat();integer(target,'target');if(v.some((x,i)=>i&&x<v[i-1])||a.some((row,i)=>i&&row[0]<=a[i-1].at(-1)))throw Error('矩阵须满足行内升序且后行起点大于前行终点');emit('columns',v,[],'展开下标除以列数得到行，取模得到列。',{columns});let left=0,right=v.length-1;emit('init',v,[],'初始化展开后的二分区间。',{left,right,target});while(left<=right){emit('loop',v,[],'区间非空，继续查找。',{left,right,target});const mid=left+Math.floor((right-left)/2);emit('mid',v,[mid],'计算展开下标的中点。',{left,right,mid});const value=v[mid],row=Math.floor(mid/columns),col=mid%columns;emit('value',v,[mid],`访问 matrix[${row}][${col}]。`,{mid,row,col,value,target});emit('found',v,[mid],value===target?'找到目标。':'当前值不是目标。',{mid,value,target});if(value===target)return true;if(value<target){left=mid+1;emit('left',v,[mid],'值小于目标，查找右侧。',{left,right,mid,target});}else{right=mid-1;emit('right',v,[mid],'值大于目标，查找左侧。',{left,right,mid,target});}}emit('return',v,[],'目标不存在。',{target});return false;}),
4:lesson({id:4,signature:'public double findMedianSortedArrays(int[] nums1, int[] nums2)',sample:{nums1:[1,3],nums2:[2]},expected:2,call:'new Solution().findMedianSortedArrays(new int[]{1,3},new int[]{2})',description:'两个非递减数组，至少一个非空。求合并后的中位数，要求 O(log(m+n)) 时间，不能直接合并排序。',idea:'在较短数组上二分切分位置 i，另一个数组的切分位置 j 由左侧总人数决定。左右两侧元素数量平衡，且两边所有左侧值不大于右侧值时，就能从分界值得到中位数。',invariant:'两个切分位置满足 i+j=(m+n+1)/2；目标是让 leftA≤rightB 且 leftB≤rightA。',time:'O(log min(m,n))',space:'O(1)',valueLabel:'较短数组 A | 较长数组 B',stateLabel:'切分边界值'},`class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        if (nums1.length > nums2.length) return findMedianSortedArrays(nums2, nums1); // @swap
        int m = nums1.length, n = nums2.length; // @sizes
        int left = 0, right = m; // @init
        while (left <= right) { // @loop
            int i = left + (right - left) / 2; // @i
            int j = (m + n + 1) / 2 - i; // @j
            int leftA = i == 0 ? Integer.MIN_VALUE : nums1[i - 1]; // @left-a
            int rightA = i == m ? Integer.MAX_VALUE : nums1[i]; // @right-a
            int leftB = j == 0 ? Integer.MIN_VALUE : nums2[j - 1]; // @left-b
            int rightB = j == n ? Integer.MAX_VALUE : nums2[j]; // @right-b
            if (leftA <= rightB && leftB <= rightA) { // @valid
                if ((m + n) % 2 == 1) return Math.max(leftA, leftB); // @odd
                return ((double) Math.max(leftA, leftB) + Math.min(rightA, rightB)) / 2; // @even
            }
            if (leftA > rightB) right = i - 1; // @left
            else left = i + 1; // @right
        }
        throw new IllegalArgumentException("输入数组必须有序");
    }
}`,({nums1,nums2},emit)=>{let a=array(nums1,'nums1',{sorted:true,max:16}),b=array(nums2,'nums2',{sorted:true,max:16});if(!a.length&&!b.length)throw Error('至少一个数组非空');emit('swap',[...a,...b],[],'把较短数组放到 A。');if(a.length>b.length)[a,b]=[b,a];const v=[...a,...b],m=a.length,n=b.length;emit('sizes',v,[],'记录两个数组的长度。',{m,n});let left=0,right=m;emit('init',v,[],'切分位置可以从 0 到 m。',{left,right});while(left<=right){emit('loop',v,[],'尝试一个切分位置。',{left,right,m,n});const i=left+Math.floor((right-left)/2);emit('i',v,i<m?[i]:[],'二分较短数组的切分位置。',{i,left,right});const j=Math.floor((m+n+1)/2)-i;emit('j',v,j<n?[m+j]:[],'由左侧总数量确定 B 的切分。',{i,j,m,n});const leftA=i===0?-Infinity:a[i-1],rightA=i===m?Infinity:a[i],leftB=j===0?-Infinity:b[j-1],rightB=j===n?Infinity:b[j];const vars={i,j,m,n,leftA:Number.isFinite(leftA)?leftA:'−∞',rightA:Number.isFinite(rightA)?rightA:'∞',leftB:Number.isFinite(leftB)?leftB:'−∞',rightB:Number.isFinite(rightB)?rightB:'∞'};emit('left-a',v,i>0?[i-1]:[],'读取 A 左侧最大值；空侧用负无穷表示。',vars);emit('right-a',v,i<m?[i]:[],'读取 A 右侧最小值；空侧用正无穷表示。',vars);emit('left-b',v,j>0?[m+j-1]:[],'读取 B 左侧最大值。',vars);emit('right-b',v,j<n?[m+j]:[],'读取 B 右侧最小值。',vars);const ok=leftA<=rightB&&leftB<=rightA;emit('valid',v,[],ok?'左右两部分已经有序分隔。':'分界值交叉，需要调整切分。',vars);if(ok){const odd=(m+n)%2===1;emit('odd',v,[],odd?'总长度为奇数，取左侧最大值。':'总长度为偶数，取两个中间值的平均。',vars);if(odd)return Math.max(leftA,leftB);const answer=(Math.max(leftA,leftB)+Math.min(rightA,rightB))/2;emit('even',v,[],`中位数为 ${answer}。`,{...vars,answer});return answer;}if(leftA>rightB){right=i-1;emit('left',v,[],'A 左边元素过多，切分左移。',{...vars,left,right});}else{left=i+1;emit('right',v,[],'A 左边元素过少，切分右移。',{...vars,left,right});}}throw Error('未找到有效切分');})
};
