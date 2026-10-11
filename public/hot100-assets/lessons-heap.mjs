import {lesson,array,integer} from './lesson-kit.mjs';
class Heap {
 constructor(compare=(a,b)=>a-b){this.data=[];this.compare=compare;}
 get size(){return this.data.length;} peek(){return this.data[0];}
 push(v){const a=this.data;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(this.compare(a[p],a[i])<=0)break;[a[p],a[i]]=[a[i],a[p]];i=p;}}
 pop(){const a=this.data,result=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;while(2*i+1<a.length){let c=2*i+1;if(c+1<a.length&&this.compare(a[c+1],a[c])<0)c++;if(this.compare(a[i],a[c])<=0)break;[a[i],a[c]]=[a[c],a[i]];i=c;}}return result;}
}
const medianScenario='MedianFinder finder = new MedianFinder(); List<Object> result = new ArrayList<>(); result.add(null); finder.addNum(1); result.add(null); finder.addNum(2); result.add(null); result.add(finder.findMedian()); finder.addNum(3); result.add(null); result.add(finder.findMedian());';
export const heapLessons={
215:lesson({id:215,signature:'public int findKthLargest(int[] nums, int k)',sample:{nums:[3,2,1,5,6,4],k:2},expected:5,call:'new Solution().findKthLargest(new int[]{3,2,1,5,6,4},2)',mode:'heap',valueLabel:'小根堆（数组下标对应完全二叉树）',description:'返回数组排序后第 k 大的元素，重复值按出现次数计入。',idea:'只保留目前最大的 k 个元素，用小根堆让保留元素的最小值位于根。加入新值后若数量超限，就删去最小值。最终堆顶是第 k 大。',invariant:'处理完一个输入后，堆包含已见元素中最大的至多 k 个值。',time:'O(n log k)',space:'O(k)'},`class Solution {
    public int findKthLargest(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>(); // @init
        for (int value : nums) { // @loop
            heap.add(value); // @add
            if (heap.size() > k) heap.remove(); // @trim
        }
        return heap.peek(); // @return
    }
}`, ({nums:input,k},emit)=>{const nums=array(input,'nums',{min:1});integer(k,'k',1,nums.length);const heap=new Heap();const show=(key,note,vars={})=>emit(key,heap.data,heap.size?[0]:[],note,{nums,k,...vars},[],{heaps:[{name:'小根堆',values:[...heap.data]}]});show('init','建立空小根堆。');for(let i=0;i<nums.length;i++){const value=nums[i];show('loop','读取下一个输入元素。',{i,value});heap.push(value);show('add','插入堆，上浮恢复堆序。',{i,value});const removed=heap.size>k?heap.pop():null;show('trim',removed===null?'数量不超过 k，保留全部。':'超出 k，删除堆顶并下沉恢复堆序。',{i,value,removed});}show('return','最大的 k 个元素中，最小者就是第 k 大。',{answer:heap.peek()});return heap.peek();}),
347:lesson({id:347,signature:'public int[] topKFrequent(int[] nums, int k)',sample:{nums:[1,1,1,2,2,3],k:2},expected:[1,2],call:'new Solution().topKFrequent(new int[]{1,1,1,2,2,3},2)',mode:'heap',valueLabel:'候选元素（堆序按频次，频次相同按值）',stateLabel:'元素 → 频次',description:'返回出现频率最高的 k 个元素。题目保证答案唯一，返回顺序不限。本课程将结果升序输出，便于验证。',idea:'先统计频次，再建立最多 k 项的小根堆。频次最低的候选位于根，数量超限时被淘汰。',invariant:'堆保留已处理不同元素中频率最高的至多 k 项。',time:'O(n + u log k + k log k)，u 为不同元素数',space:'O(u)'},`class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>(); // @init
        for (int value : nums) count.merge(value, 1, Integer::sum); // @count
        PriorityQueue<Integer> heap = new PriorityQueue<>((a, b) ->
            count.get(a).equals(count.get(b)) ? Integer.compare(a, b)
                : Integer.compare(count.get(a), count.get(b))); // @heap
        for (int value : count.keySet()) { // @loop
            heap.add(value); // @add
            if (heap.size() > k) heap.remove(); // @trim
        }
        int[] result = new int[k]; // @result
        for (int i = 0; i < k; i++) result[i] = heap.remove(); // @extract
        Arrays.sort(result); // @sort
        return result; // @return
    }
}`, ({nums:input,k},emit)=>{const nums=array(input,'nums',{min:1}),count=new Map();integer(k,'k',1,new Set(nums).size);const freq=[...new Set(nums)].map(v=>nums.filter(x=>x===v).length).sort((a,b)=>b-a);if(k<freq.length&&freq[k]===freq[k-1])throw Error('第 k 与第 k+1 项频次相同，演示要求答案唯一');let heap=new Heap((a,b)=>(count.get(a)-count.get(b))||a-b);const show=(key,note,vars={})=>emit(key,heap.data,[],note,{k,...vars},[...count],{heaps:[{name:'频次小根堆',values:[...heap.data],labels:heap.data.map(v=>`${v} × ${count.get(v)}`)}]});show('init','建立频次表。');nums.forEach(value=>{count.set(value,(count.get(value)||0)+1);show('count','累计当前值出现次数。',{value});});show('heap','按频次建立小根堆。');for(const value of count.keys()){show('loop','处理一个不同元素。',{value});heap.push(value);show('add','加入候选并恢复堆序。',{value});const removed=heap.size>k?heap.pop():null;show('trim','候选超限时淘汰频次最低项。',{value,removed});}const result=[];show('result','准备提取最终候选。',{result});while(heap.size){result.push(heap.pop());show('extract','取出一个高频元素。',{result});}result.sort((a,b)=>a-b);show('sort','结果升序排列，便于比较。',{result});show('return','返回最高频的 k 个不同元素。',{result});return result;}),
295:lesson({id:295,className:'MedianFinder',sample:{ops:['MedianFinder','addNum','addNum','findMedian','addNum','findMedian'],args:[[],[1],[2],[],[3],[]]},expected:[null,null,null,1.5,null,2],javaScenario:medianScenario,mode:'heap',valueLabel:'左侧大根堆 / 右侧小根堆',description:'设计数据流中位数结构。addNum 插入一个整数，findMedian 返回当前中位数，查询时数据流必须非空。',idea:'左堆保存较小一半，用大根堆暴露其最大值；右堆保存较大一半，用小根堆暴露其最小值。两堆等大或左边多一个，根节点即可决定中位数。',invariant:'左堆所有值 ≤ 右堆所有值；左堆大小等于右堆或多一。',time:'插入 O(log n)，查询 O(1)',space:'O(n)',practice:`import java.util.*;
class MedianFinder {
    public MedianFinder() { }
    public void addNum(int num) { throw new UnsupportedOperationException("实现 addNum"); }
    public double findMedian() { throw new UnsupportedOperationException("实现 findMedian"); }
}
public class Main {
    public static void main(String[] args) {
        ${medianScenario}
        System.out.println(LessonIO.format(result));
    }
}`},`class MedianFinder {
    private final PriorityQueue<Integer> left = new PriorityQueue<>(Comparator.reverseOrder()); // @left-init
    private final PriorityQueue<Integer> right = new PriorityQueue<>(); // @right-init
    public MedianFinder() { }
    public void addNum(int num) {
        left.add(num); // @add
        right.add(left.remove()); // @transfer
        if (left.size() < right.size()) left.add(right.remove()); // @balance
    }
    public double findMedian() {
        if (left.size() > right.size()) return left.peek(); // @odd
        return ((long) left.peek() + right.peek()) / 2.0; // @even
    }
}`, ({ops,args},emit)=>{if(!Array.isArray(ops)||!Array.isArray(args)||ops.length!==args.length||ops.length>24||ops[0]!=='MedianFinder'||!args.every(Array.isArray)||args[0].length)throw Error('ops、args 须等长，首项为无参 MedianFinder，最多 24 项');const left=new Heap((a,b)=>b-a),right=new Heap(),result=[null];const show=(key,note,vars={})=>emit(key,[...left.data,...right.data],[],note,{leftSize:left.size,rightSize:right.size,...vars},[],{heaps:[{name:'较小一半 · 大根堆',values:[...left.data]},{name:'较大一半 · 小根堆',values:[...right.data]}]});show('left-init','建立左侧大根堆。');show('right-init','建立右侧小根堆。');for(let i=1;i<ops.length;i++){if(ops[i]==='addNum'){if(args[i].length!==1)throw Error('addNum 需要一个整数');const num=integer(args[i][0],'num');left.push(num);show('add','新值先加入左堆。',{num});const moved=left.pop();right.push(moved);show('transfer','左堆最大值转到右堆，恢复两侧大小关系。',{moved});if(left.size<right.size)left.push(right.pop());show('balance','必要时把右堆最小值移回左堆，平衡数量。');result.push(null);}else if(ops[i]==='findMedian'){if(args[i].length||!left.size)throw Error('findMedian 必须无参且数据非空');show('odd',left.size>right.size?'奇数个元素，中位数为左堆顶。':'两堆等大，需要两个堆顶平均值。');if(left.size>right.size)result.push(left.peek());else{const median=(left.peek()+right.peek())/2;show('even','使用两个堆顶计算平均值。',{median});result.push(median);}}else throw Error(`不支持的中位数操作：${ops[i]}`);}return result;})
};
