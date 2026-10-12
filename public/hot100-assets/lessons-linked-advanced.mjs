import {lesson,array} from './lesson-kit.mjs';
import {node,list,values,structureSteps} from './structures.mjs';
const base={mode:'linked',valueLabel:'节点值（编号区分节点身份）',stateLabel:'指针与连接'};
export const linkedAdvancedLessons={
148:lesson({...base,id:148,signature:'public ListNode sortList(ListNode head)',sample:{head:[4,2,1,3]},expected:[1,2,3,4],call:'new Solution().sortList(LessonIO.list(4,2,1,3))',description:'把链表按非递减顺序排序，要求 O(n log n) 时间。这里采用自顶向下归并排序，使用 O(log n) 递归空间。',idea:'快慢指针找到中点，断开为两条链，分别递归排序，再通过移动节点连接合并两个有序结果。若严格要求 O(1) 辅助空间，可改用自底向上的迭代归并。',invariant:'merge 的两个输入都已排序，tail 前面的输出按非递减顺序排列。',time:'O(n log n)',space:'O(log n)'},`class Solution {
    public ListNode sortList(ListNode head) {
        if (head == null || head.next == null) return head; // @base
        ListNode slow = head, fast = head.next; // @init
        while (fast != null && fast.next != null) { // @middle
            slow = slow.next; fast = fast.next.next; // @advance
        }
        ListNode second = slow.next; // @second
        slow.next = null; // @split
        ListNode left = sortList(head); // @left
        ListNode right = sortList(second); // @right
        return merge(left, right); // @merge-call
    }
    private ListNode merge(ListNode a, ListNode b) {
        ListNode dummy = new ListNode(0), tail = dummy; // @merge-init
        while (a != null && b != null) { // @merge-loop
            if (a.val <= b.val) { // @compare
                tail.next = a; a = a.next; // @take-a
            } else {
                tail.next = b; b = b.next; // @take-b
            }
            tail = tail.next; // @tail
        }
        tail.next = a == null ? b : a; // @rest
        return dummy.next; // @merge-return
    }
}`,({head:input},emit)=>{const nodes=[],head=list(input,nodes),show=structureSteps(emit,nodes);function merge(a,b,depth){const dummy=node(0,nodes);let tail=dummy;show('merge-init','开始合并两个有序子链。',{depth},[a,b],{a,b,tail});while(a&&b){show('merge-loop','两条子链都还有节点。',{depth},[a,b],{a,b,tail});show('compare','选择当前较小的头节点。',{depth},[a,b],{a,b,tail});if(a.val<=b.val){tail.next=a;a=a.next;show('take-a','连接左侧节点，移动左指针。',{depth},[tail.next,a],{a,b,tail});}else{tail.next=b;b=b.next;show('take-b','连接右侧节点，移动右指针。',{depth},[tail.next,b],{a,b,tail});}tail=tail.next;show('tail','结果尾指针前进。',{depth},[tail],{a,b,tail});}tail.next=a||b;show('rest','接上剩余有序部分。',{depth},[tail,a,b],{a,b,tail});show('merge-return','返回本次合并结果。',{depth},[dummy.next],{head:dummy.next});return dummy.next;}function sort(head,depth){show('base',!head||!head.next?'长度小于两项，已经有序。':'继续拆分当前子链。',{depth},[head],{head});if(!head||!head.next)return head;let slow=head,fast=head.next;show('init','快慢指针寻找中点。',{depth},[slow,fast],{slow,fast});while(fast&&fast.next){show('middle','快指针还可走两步。',{depth},[slow,fast],{slow,fast});slow=slow.next;fast=fast.next.next;show('advance','慢指针走一步，快指针走两步。',{depth},[slow,fast],{slow,fast});}const second=slow.next;show('second','保存右半段的头。',{depth},[second],{head,slow,second});slow.next=null;show('split','断开中间连接。',{depth},[slow,second],{head,second});show('left','递归排序左半段。',{depth},[head],{head,second});const left=sort(head,depth+1);show('right','递归排序右半段。',{depth},[second],{left,second});const right=sort(second,depth+1);show('merge-call','两半段已排序，调用合并。',{depth},[left,right],{left,right});const result=merge(left,right,depth);show('merge-call','合并完成，返回到上一层。',{depth},[result],{head:result});return result;}const result=sort(head,0);return values(result);}),
23:lesson({...base,id:23,signature:'public ListNode mergeKLists(ListNode[] lists)',sample:{lists:[[1,4,5],[1,3,4],[2,6]]},expected:[1,1,2,3,4,4,5,6],call:'new Solution().mergeKLists(new ListNode[]{LessonIO.list(1,4,5),LessonIO.list(1,3,4),LessonIO.list(2,6)})',description:'合并 k 条非递减链表，返回一个非递减链表。空链表可以用空数组表示。',idea:'最小堆保存每条链当前未处理的头节点。每次取出最小节点接到结果末尾，并把它的后继入堆。',invariant:'堆中至多保存每条链一个候选；堆顶是全部未处理节点中的最小值。',time:'O(n log k)',space:'O(k)',stateLabel:'最小堆 / 节点编号 → 值'},`class Solution {
    public ListNode mergeKLists(ListNode[] lists) {
        PriorityQueue<ListNode> heap = new PriorityQueue<>(Comparator.comparingInt(n -> n.val)); // @heap
        for (ListNode head : lists) if (head != null) heap.offer(head); // @heads
        ListNode dummy = new ListNode(0), tail = dummy; // @init
        while (!heap.isEmpty()) { // @loop
            ListNode current = heap.poll(); // @poll
            tail.next = current; // @connect
            tail = current; // @tail
            if (current.next != null) heap.offer(current.next); // @successor
        }
        return dummy.next; // @return
    }
}`,({lists},emit)=>{if(!Array.isArray(lists)||lists.length>6)throw Error('lists 最多包含 6 条链表');const inputs=lists.map(v=>array(v,'链表',{sorted:true,max:12}));if(inputs.reduce((s,a)=>s+a.length,0)>24)throw Error('演示总节点最多 24 个');const nodes=[],heads=inputs.map(a=>list(a,nodes)),heap=[],show=structureSteps(emit,nodes);const memory=()=>[...heap].sort((a,b)=>a.val-b.val).map(n=>[n.id,n.val]);show('heap','创建保存候选头节点的最小堆。');for(const head of heads){if(head)heap.push(head);show('heads','每条非空链的头节点进入堆。',{},[head],{},memory());}const dummy=node(0,nodes);let tail=dummy;show('init','创建结果哑节点。',{},[dummy],{tail},memory());while(heap.length){show('loop','堆中还有候选节点。',{},[],{tail},memory());heap.sort((a,b)=>a.val-b.val);const current=heap.shift();show('poll','取出堆中最小节点。',{},[current],{current,tail},memory());tail.next=current;show('connect','把最小节点接到结果末尾。',{},[tail,current],{tail,current},memory());tail=current;show('tail','结果尾移动到当前节点。',{},[tail],{tail,current},memory());if(current.next)heap.push(current.next);show('successor','当前节点的后继成为这一条链的新候选。',{},[current.next],{tail,current},memory());}show('return','所有链表节点均已合并。',{},[dummy.next],{head:dummy.next},memory());return values(dummy.next);}),
138:lesson({...base,id:138,signature:'public Node copyRandomList(Node head)',sample:{head:[[7,null],[13,0],[11,4],[10,2],[1,0]]},expected:[[7,null],[13,0],[11,4],[10,2],[1,0]],call:'new Solution().copyRandomList(LessonIO.randomList(new int[][]{{7,-1},{13,0},{11,4},{10,2},{1,0}}))',description:'复制带 next 和 random 指针的链表。每个输入元素是 [值, random 指向的下标]，null 表示空指针。新链表所有节点必须与原链表不同。',idea:'第一遍为每个原节点创建新节点，并记录原节点到副本的映射。第二遍通过映射复制 next、random 两种连接。',invariant:'连接副本之前，每个原节点都已经有唯一副本；副本的指针只指向副本节点。',time:'O(n)',space:'O(n)',stateLabel:'原节点 → 副本节点'},`class Solution {
    public Node copyRandomList(Node head) {
        Map<Node, Node> copies = new HashMap<>(); // @init
        for (Node current = head; current != null; current = current.next) { // @first
            copies.put(current, new Node(current.val)); // @copy
        }
        for (Node current = head; current != null; current = current.next) { // @second
            Node copy = copies.get(current); // @get
            copy.next = copies.get(current.next); // @next
            copy.random = copies.get(current.random); // @random
        }
        return copies.get(head); // @return
    }
}`,({head:input},emit)=>{if(!Array.isArray(input)||input.length>12)throw Error('随机链表演示最多 12 个节点');const nodes=[],original=input.map(pair=>{if(!Array.isArray(pair)||pair.length!==2)throw Error('节点格式为 [值, random下标或null]');integerValue(pair[0]);if(pair[1]!==null&&(!Number.isInteger(pair[1])||pair[1]<0||pair[1]>=input.length))throw Error('random 下标超出链表范围');return node(pair[0],nodes);});original.forEach((n,i)=>{n.next=original[i+1]||null;n.random=input[i][1]===null?null:original[input[i][1]];});const head=original[0]||null,copies=new Map(),show=structureSteps(emit,nodes),memory=()=>[...copies].map(([a,b])=>[a.id,b.id]);show('init','创建原节点到副本的映射。');for(let current=head;current;current=current.next){show('first','第一遍只创建副本，不复制连接。',{},[current],{current},memory());copies.set(current,node(current.val,nodes));show('copy','为原节点创建独立的新节点。',{},[current,copies.get(current)],{current,copy:copies.get(current)},memory());}for(let current=head;current;current=current.next){show('second','第二遍复制节点连接。',{},[current],{current},memory());const copy=copies.get(current);show('get','找到当前节点的副本。',{},[current,copy],{current,copy},memory());copy.next=copies.get(current.next)||null;show('next','next 指向原后继的副本。',{},[copy,copy.next],{current,copy},memory());copy.random=copies.get(current.random)||null;show('random','random 指向原随机节点的副本。',{},[copy,copy.random],{current,copy},memory());}const result=copies.get(head)||null;show('return','返回副本头；原链表连接保持原样。',{},[result],{head:result},memory());const out=[],ordered=[];for(let c=result;c;c=c.next)ordered.push(c);for(const c of ordered)out.push([c.val,c.random?ordered.indexOf(c.random):null]);return out;})
};
function integerValue(v){if(!Number.isInteger(v)||Math.abs(v)>100000)throw Error('节点值必须是绝对值不超过 100000 的整数');}
