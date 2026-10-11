import {lesson,integer} from './lesson-kit.mjs';
function operations(ops,args,name){if(!Array.isArray(ops)||!Array.isArray(args)||ops.length!==args.length||ops.length>24||ops[0]!==name||!args.every(Array.isArray))throw Error(`ops、args 须等长、最多 24 项，首项为 ${name} 构造操作`);}
const cacheScenario='LRUCache cache = new LRUCache(2); List<Object> result = new ArrayList<>(); result.add(null); cache.put(1,1); result.add(null); cache.put(2,2); result.add(null); result.add(cache.get(1)); cache.put(3,3); result.add(null); result.add(cache.get(2)); cache.put(4,4); result.add(null); result.add(cache.get(1)); result.add(cache.get(3)); result.add(cache.get(4));';
const stackScenario='MinStack stack = new MinStack(); List<Object> result = new ArrayList<>(); result.add(null); stack.push(-2); result.add(null); stack.push(0); result.add(null); stack.push(-3); result.add(null); result.add(stack.getMin()); stack.pop(); result.add(null); result.add(stack.top()); result.add(stack.getMin());';
export const designLessons={
146:lesson({id:146,className:'LRUCache',sample:{ops:['LRUCache','put','put','get','put','get','put','get','get','get'],args:[[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]},expected:[null,null,null,1,null,-1,null,-1,3,4],javaScenario:cacheScenario,mode:'cache',valueLabel:'缓存键（从最久未使用到最近使用）',stateLabel:'缓存顺序 / 键 → 值',description:'实现固定容量缓存。get 查询已有键并将其标记为最近使用；put 写入或更新键值，超出容量时淘汰最久未使用的键。操作平均 O(1)。输出 null 表示构造或无返回值操作。',idea:'哈希表用于定位键，双向链表用于维护使用顺序。本 Java 实现利用 LinkedHashMap 的插入顺序，把访问过的键删除再插入，移动到末尾；首项就是淘汰对象。',invariant:'缓存顺序始终从最久未使用到最近使用，容量不会超过设定上限。',time:'get、put 平均 O(1)',space:'O(capacity)',practice:`import java.util.*;
class LRUCache {
    public LRUCache(int capacity) { }
    public int get(int key) { throw new UnsupportedOperationException("实现 get"); }
    public void put(int key, int value) { throw new UnsupportedOperationException("实现 put"); }
}
public class Main {
    public static void main(String[] args) {
        ${cacheScenario}
        System.out.println(LessonIO.format(result));
    }
}`},`class LRUCache {
    private final LinkedHashMap<Integer, Integer> order = new LinkedHashMap<>(); // @init
    private final int capacity;
    public LRUCache(int capacity) {
        this.capacity = capacity; // @capacity
    }
    public int get(int key) {
        if (!order.containsKey(key)) return -1; // @missing
        int value = order.remove(key); // @get-remove
        order.put(key, value); // @recent
        return value; // @get-return
    }
    public void put(int key, int value) {
        order.remove(key); // @put-remove
        order.put(key, value); // @put
        if (order.size() > capacity) { // @overflow
            int oldest = order.keySet().iterator().next(); // @oldest
            order.remove(oldest); // @evict
        }
    }
}`,({ops,args},emit)=>{operations(ops,args,'LRUCache');if(args[0].length!==1)throw Error('构造操作需要一个容量参数');const capacity=integer(args[0][0],'capacity',1,12),order=new Map(),result=[null];const show=(key,note,vars={},active=[])=>emit(key,[...order.keys()],active,note,{capacity,...vars},[...order]);show('init','创建有序哈希表。');show('capacity','记录最大容量。');for(let i=1;i<ops.length;i++){const op=ops[i],input=args[i];if(op==='get'){if(input.length!==1)throw Error('get 需要一个键参数');const key=integer(input[0],'key');show('missing',order.has(key)?'键存在，准备刷新使用顺序。':'键不存在，返回 −1。',{op,key});if(!order.has(key)){result.push(-1);continue;}const value=order.get(key);order.delete(key);show('get-remove','暂时移除原位置。',{op,key,value});order.set(key,value);show('recent','重新插入末尾，成为最近使用。',{op,key,value},[order.size-1]);result.push(value);show('get-return','返回查到的值。',{op,key,value},[order.size-1]);}else if(op==='put'){if(input.length!==2)throw Error('put 需要键和值两个参数');const key=integer(input[0],'key'),value=integer(input[1],'value');order.delete(key);show('put-remove','已有键先移除，统一更新最近位置。',{op,key,value});order.set(key,value);show('put','写入末尾。',{op,key,value},[order.size-1]);show('overflow',order.size>capacity?'容量超限，需要淘汰首项。':'容量没有超限。',{op,key,value});if(order.size>capacity){const oldest=order.keys().next().value;show('oldest','首项就是最久未使用的键。',{oldest},[0]);order.delete(oldest);show('evict','淘汰最久未使用项。',{oldest});}result.push(null);}else throw Error(`不支持的缓存操作：${op}`);}return result;}),
155:lesson({id:155,className:'MinStack',sample:{ops:['MinStack','push','push','push','getMin','pop','top','getMin'],args:[[],[-2],[0],[-3],[],[],[],[]]},expected:[null,null,null,null,-3,null,0,-2],javaScenario:stackScenario,mode:'stack',valueLabel:'主栈（左侧为栈底，右侧为栈顶）',stateLabel:'每个深度的最小值',description:'设计支持 push、pop、top 和 getMin 的栈，每个操作都为 O(1)。弹出和读取操作只允许用于非空栈。',idea:'主栈保存元素，辅助栈在相同深度保存截至该深度的最小值。入栈时同步记录最小值，出栈时同步移除，因此不用重新扫描。',invariant:'两个栈始终等高，辅助栈顶是主栈当前所有元素的最小值。',time:'每个操作 O(1)',space:'O(n)',practice:`import java.util.*;
class MinStack {
    public MinStack() { }
    public void push(int val) { throw new UnsupportedOperationException("实现 push"); }
    public void pop() { throw new UnsupportedOperationException("实现 pop"); }
    public int top() { throw new UnsupportedOperationException("实现 top"); }
    public int getMin() { throw new UnsupportedOperationException("实现 getMin"); }
}
public class Main {
    public static void main(String[] args) {
        ${stackScenario}
        System.out.println(LessonIO.format(result));
    }
}`},`class MinStack {
    private final Deque<Integer> values = new ArrayDeque<>(); // @values
    private final Deque<Integer> minimums = new ArrayDeque<>(); // @minimums
    public void push(int val) {
        values.push(val); // @push
        minimums.push(minimums.isEmpty() ? val : Math.min(val, minimums.peek())); // @min-push
    }
    public void pop() {
        values.pop(); // @pop
        minimums.pop(); // @min-pop
    }
    public int top() {
        return values.peek(); // @top
    }
    public int getMin() {
        return minimums.peek(); // @get-min
    }
}`,({ops,args},emit)=>{operations(ops,args,'MinStack');if(args[0].length)throw Error('MinStack 构造操作没有参数');const values=[],minimums=[],result=[null],show=(key,note,vars={},active=[])=>emit(key,values,active,note,vars,minimums.map((v,i)=>[i,v]));show('values','创建主栈。');show('minimums','创建对应深度的最小值栈。');for(let i=1;i<ops.length;i++){const op=ops[i];if(op==='push'){if(args[i].length!==1)throw Error('push 需要一个数值');const val=integer(args[i][0],'val');values.push(val);show('push','元素进入主栈。',{op,val},[values.length-1]);minimums.push(minimums.length?Math.min(val,minimums.at(-1)):val);show('min-push','同步记录当前深度的最小值。',{op,val},[values.length-1]);result.push(null);}else{if(args[i].length||!values.length)throw Error('读取或弹出操作不接受参数，且主栈必须非空');if(op==='pop'){values.pop();show('pop','主栈弹出栈顶。',{op});minimums.pop();show('min-pop','辅助栈同步弹出。',{op});result.push(null);}else if(op==='top'){result.push(values.at(-1));show('top','读取主栈顶。',{op,answer:values.at(-1)},[values.length-1]);}else if(op==='getMin'){result.push(minimums.at(-1));show('get-min','直接读取辅助栈顶的最小值。',{op,answer:minimums.at(-1)},[values.length-1]);}else throw Error(`不支持的栈操作：${op}`);}}return result;})
};
