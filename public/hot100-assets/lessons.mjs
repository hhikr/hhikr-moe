import {hashLessons} from './lessons-hash.mjs';
import {practiceProgram} from './lesson-kit.mjs';
import {pointerLessons} from './lessons-pointers.mjs';
import {windowLessons} from './lessons-windows.mjs';
import {arrayLessons} from './lessons-arrays.mjs';
import {greedyLessons} from './lessons-greedy.mjs';
import {trickLessons} from './lessons-tricks.mjs';
import {stackLessons} from './lessons-stacks.mjs';
import {dpLessons} from './lessons-dp.mjs';
import {binaryLessons} from './lessons-binary.mjs';
import {matrixLessons} from './lessons-matrix.mjs';
import {linkedLessons} from './lessons-linked.mjs';
import {linkedEditLessons} from './lessons-linked-edit.mjs';
import {linkedAdvancedLessons} from './lessons-linked-advanced.mjs';
import {designLessons} from './lessons-design.mjs';
import {treeLessons} from './lessons-tree.mjs';
import {treeOrderLessons} from './lessons-tree-order.mjs';
import {treePathLessons} from './lessons-tree-path.mjs';
import {multidpLessons} from './lessons-multidp.mjs';
import {heapLessons} from './lessons-heap.mjs';
import {graphLessons} from './lessons-graph.mjs';
import {trieLessons} from './lessons-trie.mjs';
import {backtrackLessons} from './lessons-backtrack.mjs';
import {backtrackSearchLessons} from './lessons-backtrack-search.mjs';
const frame = (line, values, active, note, vars = {}, stored = []) => ({line,values:[...values],active,note,vars:{...vars},stored:[...stored]});
const baseLessons = {
  1: {
    description:'给定整数数组 nums 和目标值 target，返回两个不同位置的下标，使这两个位置的数之和等于 target。假设恰好有一组答案。',
    input:'nums = [2, 7, 11, 15], target = 9', output:'[0, 1]',
    idea:'把已经见过的数和下标放进哈希表。每看到一个新数，只需查询它的补数是否出现过。先查询、再存入，可以避免同一位置被使用两次。',
    invariant:'查询时，seen 只包含当前下标之前的数。', time:'O(n)',space:'O(n)',mode:'array',
    code:`class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            if (seen.containsKey(need)) {
                return new int[]{seen.get(need), i};
            }
            seen.put(nums[i], i);
        }
        throw new IllegalArgumentException("无解");
    }
}`,
    practice:`import java.util.*;

public class Main {
    static int[] twoSum(int[] nums, int target) {
        // 在这里实现哈希表解法
        return new int[]{};
    }

    public static void main(String[] args) {
        System.out.println(Arrays.toString(twoSum(new int[]{2,7,11,15}, 9)));
    }
}`,
    trace(raw){const {nums,target}=JSON.parse(raw);checkArray(nums);if(!Number.isFinite(target))throw Error('target 必须是数字');const out=[],seen=new Map();out.push(frame(3,nums,[],'创建空哈希表。',{target}));for(let i=0;i<nums.length;i++){const need=target-nums[i],vars={i,'nums[i]':nums[i],need,target};out.push(frame(4,nums,[i],'进入下一轮遍历。',vars,[...seen]));out.push(frame(5,nums,[i],`补数 = ${target} − ${nums[i]} = ${need}。`,vars,[...seen]));out.push(frame(6,nums,[i],seen.has(need)?'哈希表中找到补数。':'补数还没有出现。',vars,[...seen]));if(seen.has(need)){out.push(frame(7,nums,[seen.get(need),i],`返回下标 [${seen.get(need)}, ${i}]。`,vars,[...seen]));return out;}seen.set(nums[i],i);out.push(frame(9,nums,[i],`记录 ${nums[i]} → 下标 ${i}。`,vars,[...seen]));}out.push(frame(11,nums,[],'输入不存在满足条件的两个位置。',{target},[...seen]));return out;},raw:'{"nums":[2,7,11,15],"target":9}'
  },
  283: {
    description:'把数组中的所有零移到末尾，并保持非零元素原有的相对顺序。直接修改数组，不创建另一个数组。',input:'nums = [0, 1, 0, 3, 12]',output:'[1, 3, 12, 0, 0]',
    idea:'read 检查每一个位置，write 指向下一个非零数应该放置的位置。读到非零数时交换两个位置，然后向前移动 write。',invariant:'[0, write) 始终是已经整理好的非零前缀。',time:'O(n)',space:'O(1)',mode:'array',
    code:`class Solution {
    public void moveZeroes(int[] nums) {
        int write = 0;
        for (int read = 0; read < nums.length; read++) {
            if (nums[read] != 0) {
                int temp = nums[write];
                nums[write] = nums[read];
                nums[read] = temp;
                write++;
            }
        }
    }
}`,
    practice:`import java.util.*;
public class Main {
    static void moveZeroes(int[] nums) {
        // 用 read 和 write 两个指针整理数组
    }
    public static void main(String[] args) {
        int[] nums = {0,1,0,3,12};
        moveZeroes(nums);
        System.out.println(Arrays.toString(nums));
    }
}`,
    trace(raw){const {nums}=JSON.parse(raw);checkArray(nums);const a=[...nums],out=[frame(3,a,[],'write 从下标 0 开始。',{write:0})];let write=0;for(let read=0;read<a.length;read++){let vars={read,write};out.push(frame(4,a,[read],`read 检查下标 ${read}。`,vars));out.push(frame(5,a,[read],a[read]===0?'当前值为零，跳过。':'当前值非零，移入非零前缀。',vars));if(a[read]!==0){const temp=a[write];out.push(frame(6,a,[write,read],'暂存 write 位置的值。',{...vars,temp}));a[write]=a[read];out.push(frame(7,a,[write,read],'将非零值写入 write 位置。',{...vars,temp}));a[read]=temp;out.push(frame(8,a,[write,read],'将暂存值写回 read 位置，完成交换。',{...vars,temp}));write++;out.push(frame(9,a,[read],'非零前缀增加一个位置。',{read,write}));}}out.push(frame(12,a,[],'数组整理完成。',{write}));return out;},raw:'{"nums":[0,1,0,3,12]}'
  },
  35: {
    description:'给定严格升序数组 nums 和目标值 target，返回目标值的下标；如果不存在，返回它保持升序时应插入的位置。',input:'nums = [1, 3, 5, 6], target = 2',output:'1',
    idea:'使用左闭右开的区间 [left, right)。mid 的值小于 target 时，插入位置只能在右侧；否则保留 mid，并缩小右边界。区间为空时，left 就是插入位置。',invariant:'插入位置始终位于 [left, right] 范围内。',time:'O(log n)',space:'O(1)',mode:'array',
    code:`class Solution {
    public int searchInsert(int[] nums, int target) {
        int left = 0, right = nums.length;
        while (left < right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] < target) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }
        return left;
    }
}`,
    practice:`import java.util.*;
public class Main {
    static int searchInsert(int[] nums, int target) {
        // 使用左闭右开的二分区间
        return 0;
    }
    public static void main(String[] args) {
        System.out.println(searchInsert(new int[]{1,3,5,6}, 2));
    }
}`,
    trace(raw){const {nums,target}=JSON.parse(raw);checkArray(nums);if(!Number.isFinite(target))throw Error('target 必须是数字');if(nums.some((v,i)=>i&&v<=nums[i-1]))throw Error('nums 必须严格升序');let left=0,right=nums.length;const out=[frame(3,nums,[],'设置左闭右开区间。',{left,right,target})];while(left<right){out.push(frame(4,nums,[],'区间非空，继续查找。',{left,right,target}));const mid=left+Math.floor((right-left)/2);const vars={left,right,mid,target};out.push(frame(5,nums,[mid],`mid = ${mid}。`,vars));out.push(frame(6,nums,[mid],`${nums[mid]} ${nums[mid]<target?'<':'≥'} ${target}。`,vars));if(nums[mid]<target){left=mid+1;out.push(frame(7,nums,[mid],'排除 mid 及其左侧。',{left,right,mid,target}));}else{right=mid;out.push(frame(9,nums,[mid],'保留 mid，缩小右边界。',{left,right,mid,target}));}}out.push(frame(12,nums,left<nums.length?[left]:[],`返回插入位置 ${left}。`,{left,right,target}));return out;},raw:'{"nums":[1,3,5,6],"target":2}'
  },
  70: {
    description:'每次可以爬 1 或 2 个台阶。给定正整数 n，求到达第 n 阶的不同走法数量。',input:'n = 5',output:'8',idea:'到达第 i 阶的最后一步，只能来自第 i−1 阶或第 i−2 阶，因此 f(i) = f(i−1) + f(i−2)。用两个变量保存前两个状态。',invariant:'每轮开始时，a = f(i−2)，b = f(i−1)。',time:'O(n)',space:'O(1)',mode:'dp',
    code:`class Solution {
    public int climbStairs(int n) {
        if (n <= 2) return n;
        int a = 1, b = 2;
        for (int i = 3; i <= n; i++) {
            int next = a + b;
            a = b;
            b = next;
        }
        return b;
    }
}`,
    practice:`public class Main {
    static int climbStairs(int n) {
        // 状态转移：f(i) = f(i-1) + f(i-2)
        return 0;
    }
    public static void main(String[] args) {
        System.out.println(climbStairs(5));
    }
}`,
    trace(raw){const {n}=JSON.parse(raw);if(!Number.isInteger(n)||n<1||n>20)throw Error('演示范围：n 为 1 到 20 的整数');const v=Array(n).fill('·'),out=[];out.push(frame(3,v,[],n<=2?`直接返回 ${n}。`:'n 大于 2，计算状态转移。',{n}));if(n<=2)return out;v[0]=1;v[1]=2;let a=1,b=2;out.push(frame(4,v,[0,1],'初始化 f(1) 和 f(2)。',{a,b,n}));for(let i=3;i<=n;i++){out.push(frame(5,v,[i-3,i-2],'读取前两个状态。',{i,a,b}));const next=a+b;v[i-1]=next;out.push(frame(6,v,[i-3,i-2,i-1],`${a} + ${b} = ${next}。`,{i,a,b,next}));a=b;out.push(frame(7,v,[i-2],'a 向前移动一个状态。',{i,a,b,next}));b=next;out.push(frame(8,v,[i-1],'b 保存当前状态。',{i,a,b,next}));}out.push(frame(10,v,[n-1],`返回 ${b} 种走法。`,{n,a,b}));return out;},raw:'{"n":5}'
  }
};
function checkArray(nums){if(!Array.isArray(nums)||nums.length>24||!nums.every(v=>Number.isInteger(v)&&Math.abs(v)<=100000))throw Error('nums 必须是最多 24 个整数组成的数组，元素绝对值不能超过 100000');}
Object.assign(baseLessons[1],{id:1,expected:[0,1],call:'new Solution().twoSum(new int[]{2,7,11,15},9)'});
Object.assign(baseLessons[283],{id:283,expected:[1,3,12,0,0],call:'new Solution().moveZeroes(nums)',javaSetup:'int[] nums = {0,1,0,3,12};',javaResult:'nums'});
Object.assign(baseLessons[35],{id:35,expected:1,call:'new Solution().searchInsert(new int[]{1,3,5,6},2)'});
Object.assign(baseLessons[70],{id:70,expected:8,call:'new Solution().climbStairs(5)'});
for(const [id,l] of Object.entries(baseLessons)){
 l.signature={1:'public int[] twoSum(int[] nums, int target)',283:'public void moveZeroes(int[] nums)',35:'public int searchInsert(int[] nums, int target)',70:'public int climbStairs(int n)'}[id];
 l.sample=JSON.parse(l.raw);l.practice=practiceProgram(l);
 const original=l.trace;
 l.trace=raw=>{const frames=original(raw),last=frames.at(-1);last.answer=id==='1'?(last.line===7?last.active:null):id==='283'?last.values:id==='35'?last.vars.left:last.vars.b??last.vars.n;return frames;};
}
export const lessons={...baseLessons,...hashLessons,...pointerLessons,...windowLessons,...arrayLessons,...greedyLessons,...trickLessons,...stackLessons,...dpLessons,...binaryLessons,...matrixLessons,...linkedLessons,...linkedEditLessons,...linkedAdvancedLessons,...designLessons,...treeLessons,...treeOrderLessons,...treePathLessons,...multidpLessons,...heapLessons,...graphLessons,...trieLessons,...backtrackLessons,...backtrackSearchLessons};
