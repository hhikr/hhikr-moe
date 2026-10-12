import {lesson,array} from './lesson-kit.mjs';
export const trickLessons={
136:lesson({id:136,signature:'public int singleNumber(int[] nums)',sample:{nums:[4,1,2,1,2]},expected:4,call:'new Solution().singleNumber(new int[]{4,1,2,1,2})',description:'数组中恰有一个元素出现一次，其余元素都出现两次。在线性时间、常数空间内找出单独出现的数。',idea:'同一个数异或自身得到 0，任何数异或 0 保持不变。异或满足交换律和结合律，所有成对元素抵消后只剩答案。',invariant:'result 是已经扫描部分所有元素的异或值。',time:'O(n)',space:'O(1)'},`class Solution {
    public int singleNumber(int[] nums) {
        int result = 0; // @init
        for (int x : nums) { // @loop
            result ^= x; // @xor
        }
        return result; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:1}),freq=new Map();a.forEach(v=>freq.set(v,(freq.get(v)||0)+1));if([...freq.values()].filter(c=>c===1).length!==1||[...freq.values()].some(c=>c!==1&&c!==2))throw Error('须恰有一个数出现一次，其他数各出现两次');let result=0;emit('init',a,[],'异或累积值从 0 开始。',{result});for(let i=0;i<a.length;i++){emit('loop',a,[i],'读入当前数。',{i,x:a[i],result});const before=result;result^=a[i];emit('xor',a,[i],`${before} XOR ${a[i]} = ${result}。`,{i,result,binary:(result>>>0).toString(2)});}emit('return',a,[],`成对的数全部抵消，剩下 ${result}。`,{result});return result;}),
169:lesson({id:169,signature:'public int majorityElement(int[] nums)',sample:{nums:[2,2,1,1,1,2,2]},expected:2,call:'new Solution().majorityElement(new int[]{2,2,1,1,1,2,2})',description:'非空数组中保证有一个数出现次数超过数组长度的一半，找出这个多数元素。',idea:'Boyer–Moore 投票法让不同元素互相抵消。票数为零时换候选；与候选相同则加一，否则减一。多数元素的数量超过其他元素总和，无法被完全抵消。',invariant:'已扫描元素消去不同值配对后，剩余未抵消的票都属于当前候选。',time:'O(n)',space:'O(1)'},`class Solution {
    public int majorityElement(int[] nums) {
        int candidate = 0, votes = 0; // @init
        for (int x : nums) { // @loop
            if (votes == 0) candidate = x; // @candidate
            votes += x == candidate ? 1 : -1; // @vote
        }
        return candidate; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:1}),freq=new Map();a.forEach(v=>freq.set(v,(freq.get(v)||0)+1));if(![...freq.values()].some(v=>v>a.length/2))throw Error('输入须存在出现次数超过一半的元素');let candidate=0,votes=0;emit('init',a,[],'初始化候选和票数。',{candidate,votes});for(let i=0;i<a.length;i++){const x=a[i];emit('loop',a,[i],'读取下一个元素。',{i,x,candidate,votes});if(votes===0)candidate=x;emit('candidate',a,[i],votes===0?'没有未抵消的票，选择新候选。':'保留当前候选。',{i,x,candidate,votes});votes+=x===candidate?1:-1;emit('vote',a,[i],x===candidate?'同一候选增加一票。':'不同元素抵消一票。',{i,x,candidate,votes});}emit('return',a,[],`多数元素为 ${candidate}。`,{candidate,votes});return candidate;}),
75:lesson({id:75,signature:'public void sortColors(int[] nums)',sample:{nums:[2,0,2,1,1,0]},expected:[0,0,1,1,2,2],call:'new Solution().sortColors(nums)',javaSetup:'int[] nums = {2,0,2,1,1,0};',javaResult:'nums',print:'int[] nums = {2,0,2,1,1,0};\n        new Solution().sortColors(nums);\n        System.out.println(Arrays.toString(nums));',description:'数组只包含 0、1、2，分别表示三种颜色。一次扫描、原地排序，让相同颜色相邻并按 0、1、2 排列。',idea:'荷兰国旗法维护三个区域：左侧已放好的 0，中间已确认的 1，右侧已放好的 2。遇到 2 时与右侧交换后，当前位置仍未知，不能立即前进。',invariant:'[0, low) 是 0，[low, i) 是 1，(high, n) 是 2，[i, high] 未处理。',time:'O(n)',space:'O(1)'},`class Solution {
    public void sortColors(int[] nums) {
        int low = 0, i = 0, high = nums.length - 1; // @init
        while (i <= high) { // @loop
            if (nums[i] == 0) { // @zero
                swap(nums, i, low); // @swap-zero
                low++; i++; // @advance-zero
            } else if (nums[i] == 2) { // @two
                swap(nums, i, high); // @swap-two
                high--; // @shrink
            } else i++; // @one
        }
    }
    private void swap(int[] nums, int a, int b) {
        int temp = nums[a]; // @temp
        nums[a] = nums[b]; // @write-a
        nums[b] = temp; // @write-b
    }
}`,({nums},emit)=>{const a=array(nums);if(a.some(v=>v<0||v>2))throw Error('nums 只能包含 0、1、2');let low=0,i=0,high=a.length-1;const vars=()=>({low,i,high});function swap(x,y,key){emit(key,a,[x,y],'交换两个位置。',vars());const temp=a[x];emit('temp',a,[x,y],'暂存第一个位置。',{...vars(),temp});a[x]=a[y];emit('write-a',a,[x,y],'把另一个值写入当前位置。',{...vars(),temp});a[y]=temp;emit('write-b',a,[x,y],'完成交换。',vars());}emit('init',a,[],'设置三个区域的边界。',vars());while(i<=high){emit('loop',a,[i],'检查未知区域的第一个数。',vars());emit('zero',a,[i],a[i]===0?'当前为 0，应放到左侧。':'当前不是 0。',vars());if(a[i]===0){swap(i,low,'swap-zero');low++;i++;emit('advance-zero',a,[],'0 区域和已确认区域都增长。',vars());}else{emit('two',a,[i],a[i]===2?'当前为 2，应放到右侧。':'当前为 1，可以直接前进。',vars());if(a[i]===2){swap(i,high,'swap-two');high--;emit('shrink',a,[i],'右边界收缩，交换来的数还要继续检查。',vars());}else{i++;emit('one',a,[],'1 已处于正确区域，向前扫描。',vars());}}}emit('loop',a,[],'未知区域为空，排序完成。',vars());return a;}),
31:lesson({id:31,signature:'public void nextPermutation(int[] nums)',sample:{nums:[1,2,3]},expected:[1,3,2],call:'new Solution().nextPermutation(nums)',javaSetup:'int[] nums = {1,2,3};',javaResult:'nums',print:'int[] nums = {1,2,3};\n        new Solution().nextPermutation(nums);\n        System.out.println(Arrays.toString(nums));',description:'原地把数组改成按字典序排列的下一个排列。若当前已经最大，则改成最小排列。',idea:'从右寻找第一个上升位置 i，让它与右侧最小的更大值交换。右侧原本降序，再反转为升序，就得到增长幅度最小的下一排列。',invariant:'找到 i 时，i 右侧的后缀为非递增序列；交换后反转使这个后缀最小。',time:'O(n)',space:'O(1)'},`class Solution {
    public void nextPermutation(int[] nums) {
        int i = nums.length - 2; // @init
        while (i >= 0 && nums[i] >= nums[i + 1]) i--; // @pivot
        if (i >= 0) { // @exists
            int j = nums.length - 1; // @j
            while (nums[j] <= nums[i]) j--; // @successor
            swap(nums, i, j); // @exchange
        }
        int left = i + 1, right = nums.length - 1; // @bounds
        while (left < right) { // @reverse
            swap(nums, left++, right--); // @reverse-swap
        }
    }
    private void swap(int[] nums, int a, int b) {
        int temp = nums[a]; // @temp
        nums[a] = nums[b]; // @write-a
        nums[b] = temp; // @write-b
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:1});let i=a.length-2;emit('init',a,i>=0?[i]:[],'从右寻找可以增大的位置。',{i});while(i>=0&&a[i]>=a[i+1]){i--;emit('pivot',a,i>=0?[i]:[],'跳过非递增的后缀。',{i});}emit('exists',a,i>=0?[i]:[],i>=0?'找到可以增大的位置。':'整个数组已经最大，需要整体反转。',{i});function swap(x,y,key,vars){emit(key,a,[x,y],'交换这两个位置。',vars);const temp=a[x];emit('temp',a,[x,y],'暂存第一个值。',{...vars,temp});a[x]=a[y];emit('write-a',a,[x,y],'写入第二个值。',vars);a[y]=temp;emit('write-b',a,[x,y],'完成交换。',vars);}if(i>=0){let j=a.length-1;emit('j',a,[i,j],'从右寻找比支点更大的最小值。',{i,j});while(a[j]<=a[i]){j--;emit('successor',a,[i,j],'继续向左寻找更大值。',{i,j});}swap(i,j,'exchange',{i,j});}let left=i+1,right=a.length-1;emit('bounds',a,[],'设置待反转后缀的边界。',{i,left,right});while(left<right){emit('reverse',a,[left,right],'反转后缀使其升序。',{i,left,right});const x=left++,y=right--;swap(x,y,'reverse-swap',{i,left,right});}emit('reverse',a,[],'后缀已经最小化，得到下一排列。',{i,left,right});return a;}),
287:lesson({id:287,signature:'public int findDuplicate(int[] nums)',sample:{nums:[1,3,4,2,2]},expected:2,call:'new Solution().findDuplicate(new int[]{1,3,4,2,2})',description:'长度为 n+1 的数组中，每个元素都在 1 到 n 之间，只有一个数重复。不能修改数组，使用常数额外空间找出重复值。',idea:'把下标看作节点，nums[i] 看作下一节点。重复值使这条路径形成环。快慢指针先相遇，再让一个指针回到起点，两者同速前进时在环入口相遇。',invariant:'第一阶段快指针每次走两步，慢指针走一步；第二阶段两者同速，入口即重复值。',time:'O(n)',space:'O(1)',stateLabel:'指针所在下标'},`class Solution {
    public int findDuplicate(int[] nums) {
        int slow = 0, fast = 0; // @init
        do { // @loop
            slow = nums[slow]; // @slow
            fast = nums[nums[fast]]; // @fast
        } while (slow != fast); // @meet
        int finder = 0; // @finder
        while (finder != slow) { // @entry-loop
            finder = nums[finder]; // @finder-step
            slow = nums[slow]; // @slow-step
        }
        return finder; // @return
    }
}`,({nums},emit)=>{const a=array(nums,'nums',{min:2});const n=a.length-1,freq=new Map();a.forEach(v=>freq.set(v,(freq.get(v)||0)+1));if(a.some(v=>v<1||v>n)||[...freq.values()].filter(c=>c>1).length!==1)throw Error('须满足长度 n+1、数值在 1..n、只有一个重复值');let slow=0,fast=0;emit('init',a,[0],'两个指针从下标 0 出发。',{slow,fast});do{emit('loop',a,[slow,fast],'进入快慢指针阶段。',{slow,fast});slow=a[slow];emit('slow',a,[slow,fast],'慢指针前进一步。',{slow,fast});fast=a[a[fast]];emit('fast',a,[slow,fast],'快指针前进两步。',{slow,fast});emit('meet',a,[slow,fast],slow===fast?'指针相遇，路径存在环。':'尚未相遇，继续追赶。',{slow,fast});}while(slow!==fast);let finder=0;emit('finder',a,[finder,slow],'一个指针回到起点。',{finder,slow});while(finder!==slow){emit('entry-loop',a,[finder,slow],'两个指针同速前进。',{finder,slow});finder=a[finder];emit('finder-step',a,[finder,slow],'起点指针前进一步。',{finder,slow});slow=a[slow];emit('slow-step',a,[finder,slow],'相遇点指针前进一步。',{finder,slow});}emit('return',a,[finder],`在环入口 ${finder} 相遇，这就是重复值。`,{finder,slow});return finder;})
};
