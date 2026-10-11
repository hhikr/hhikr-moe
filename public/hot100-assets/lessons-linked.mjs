import {lesson,array,integer} from './lesson-kit.mjs';
import {node,list,values,structureSteps,cyclic} from './structures.mjs';
const base={mode:'linked',valueLabel:'节点值（节点身份由图中编号区分）',stateLabel:'指针与节点连接'};
export const linkedLessons={
206:lesson({...base,id:206,signature:'public ListNode reverseList(ListNode head)',sample:{head:[1,2,3,4,5]},expected:[5,4,3,2,1],call:'new Solution().reverseList(LessonIO.list(1,2,3,4,5))',description:'反转单链表，返回反转后的头节点。节点值不变，修改的是 next 指针。',idea:'保存当前节点的后继，再让当前节点指向已经反转的前缀。prev 和 current 逐步前进，直到原链表处理完毕。',invariant:'prev 是已反转前缀的头，current 是尚未处理后缀的头。',time:'O(n)',space:'O(1)'},`class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null, current = head; // @init
        while (current != null) { // @loop
            ListNode next = current.next; // @save
            current.next = prev; // @reverse
            prev = current; // @prev
            current = next; // @advance
        }
        return prev; // @return
    }
}`,({head:input},emit)=>{const nodes=[],head=list(input,nodes),show=structureSteps(emit,nodes);let prev=null,current=head;show('init','反转前缀为空，当前指针从头开始。',{},[],{prev,current});while(current){show('loop','当前节点仍存在。',{},[current],{prev,current});const next=current.next;show('save','先保存后继，防止改变连接后丢失剩余链表。',{},[current,next],{prev,current,next});current.next=prev;show('reverse','当前节点的箭头转向已反转前缀。',{},[current,prev],{prev,current,next});prev=current;show('prev','已反转前缀扩大一个节点。',{},[prev],{prev,current,next});current=next;show('advance','移动到原来的后继节点。',{},[current],{prev,current});}show('return','prev 成为反转后的头节点。',{},[prev],{prev});return values(prev);}),
160:lesson({...base,id:160,signature:'public ListNode getIntersectionNode(ListNode headA, ListNode headB)',sample:{listA:[4,1,8,4,5],listB:[5,6,1,8,4,5],skipA:2,skipB:3},expected:8,javaSetup:'ListNode common = LessonIO.list(8,4,5); ListNode headA = LessonIO.prepend(new int[]{4,1},common); ListNode headB = LessonIO.prepend(new int[]{5,6,1},common);',call:'new Solution().getIntersectionNode(headA,headB)',javaTransform:'LessonIO.nodeValue(__RESULT__)',description:'两条无环单链表可能共享同一段尾部，返回第一个公共节点。相交按节点身份判断，值相同不代表相交；示例输出是公共节点的值。skipA、skipB 表示公共部分的起始下标，均为 −1 表示不相交。',idea:'两个指针分别遍历 A→B 和 B→A。走完一条链就切换到另一条，两者走过的总长度相同，会在公共起点或 null 相遇。',invariant:'切换链表后，两个指针消除了两条链的长度差。',time:'O(m+n)',space:'O(1)'},`class Solution {
    public ListNode getIntersectionNode(ListNode headA, ListNode headB) {
        ListNode a = headA, b = headB; // @init
        while (a != b) { // @loop
            a = a == null ? headB : a.next; // @a
            b = b == null ? headA : b.next; // @b
        }
        return a; // @return
    }
}`,({listA,listB,skipA,skipB},emit)=>{const a=array(listA,'listA',{max:12}),b=array(listB,'listB',{max:12});integer(skipA,'skipA',-1,a.length-1);integer(skipB,'skipB',-1,b.length-1);const nodes=[];let headA,headB;if(skipA===-1&&skipB===-1){headA=list(a,nodes);headB=list(b,nodes);}else{if(skipA<0||skipB<0||JSON.stringify(a.slice(skipA))!==JSON.stringify(b.slice(skipB)))throw Error('公共尾部必须相同，或两个 skip 都为 −1');const common=list(a.slice(skipA),nodes);headA=list(a.slice(0,skipA),nodes,common);headB=list(b.slice(0,skipB),nodes,common);}const show=structureSteps(emit,nodes);let p=headA,q=headB;show('init','分别从 A、B 的头开始。',{},[p,q],{a:p,b:q,headA,headB});while(p!==q){show('loop','两个指针尚未指向同一个节点。',{},[p,q],{a:p,b:q});p=p===null?headB:p.next;show('a','A 指针前进；到达 null 后切换到 B。',{},[p,q],{a:p,b:q});q=q===null?headA:q.next;show('b','B 指针前进；到达 null 后切换到 A。',{},[p,q],{a:p,b:q});}show('return',p?'两个指针在公共起点相遇。':'两个指针都为 null，两条链不相交。',{answer:p?.val??null},[p],{a:p,b:q});return p?.val??null;}),
141:lesson({...base,id:141,signature:'public boolean hasCycle(ListNode head)',sample:{head:[3,2,0,-4],pos:1},expected:true,call:'new Solution().hasCycle(LessonIO.cycle(LessonIO.list(3,2,0,-4),1))',description:'判断链表是否存在环。演示输入 pos 表示尾节点连接到的下标，−1 表示没有环。pos 只用于构建输入，不是算法参数。',idea:'慢指针每次走一步，快指针每次走两步。如果有环，快指针最终追上慢指针；如果快指针先到 null，则没有环。',invariant:'存在环时，两指针在环内的相对距离每轮缩短一步。',time:'O(n)',space:'O(1)'},`class Solution {
    public boolean hasCycle(ListNode head) {
        ListNode slow = head, fast = head; // @init
        while (fast != null && fast.next != null) { // @loop
            slow = slow.next; // @slow
            fast = fast.next.next; // @fast
            if (slow == fast) return true; // @meet
        }
        return false; // @return
    }
}`, (input,emit)=>{const nodes=[],head=cyclic(input,nodes),show=structureSteps(emit,nodes);let slow=head,fast=head;show('init','快慢指针从同一节点出发。',{},[slow],{slow,fast});while(fast&&fast.next){show('loop','快指针还能前进两步。',{},[slow,fast],{slow,fast});slow=slow.next;show('slow','慢指针走一步。',{},[slow,fast],{slow,fast});fast=fast.next.next;show('fast','快指针走两步。',{},[slow,fast],{slow,fast});show('meet',slow===fast?'两个指针相遇，存在环。':'两个指针尚未相遇。',{},[slow,fast],{slow,fast});if(slow===fast)return true;}show('return','快指针到达链尾，不存在环。',{answer:false},[],{slow,fast});return false;}),
142:lesson({...base,id:142,signature:'public ListNode detectCycle(ListNode head)',sample:{head:[3,2,0,-4],pos:1},expected:2,call:'new Solution().detectCycle(LessonIO.cycle(LessonIO.list(3,2,0,-4),1))',javaTransform:'LessonIO.nodeValue(__RESULT__)',description:'若链表存在环，返回环入口节点，否则返回 null。演示中的 pos 用来构造尾部连接，输出是入口节点的值。',idea:'快慢指针先在环内相遇，再让 finder 从头节点出发，与 slow 同速前进。由相遇时的路程关系可得，两者会在入口相遇。',invariant:'第二阶段，两指针距离入口的剩余路程模环长相同。',time:'O(n)',space:'O(1)'},`class Solution {
    public ListNode detectCycle(ListNode head) {
        ListNode slow = head, fast = head; // @init
        while (fast != null && fast.next != null) { // @loop
            slow = slow.next; // @slow
            fast = fast.next.next; // @fast
            if (slow == fast) { // @meet
                ListNode finder = head; // @finder
                while (finder != slow) { // @entry-loop
                    finder = finder.next; // @finder-step
                    slow = slow.next; // @slow-step
                }
                return finder; // @found
            }
        }
        return null; // @return
    }
}`, (input,emit)=>{const nodes=[],head=cyclic(input,nodes),show=structureSteps(emit,nodes);let slow=head,fast=head;show('init','从头开始检测环。',{},[head],{slow,fast});while(fast&&fast.next){show('loop','快指针还能前进。',{},[slow,fast],{slow,fast});slow=slow.next;show('slow','慢指针前进一步。',{},[slow,fast],{slow,fast});fast=fast.next.next;show('fast','快指针前进两步。',{},[slow,fast],{slow,fast});show('meet',slow===fast?'找到环内相遇点。':'尚未相遇。',{},[slow,fast],{slow,fast});if(slow===fast){let finder=head;show('finder','finder 回到头节点。',{},[finder,slow],{finder,slow});while(finder!==slow){show('entry-loop','两个指针同速前进。',{},[finder,slow],{finder,slow});finder=finder.next;show('finder-step','finder 前进一步。',{},[finder,slow],{finder,slow});slow=slow.next;show('slow-step','slow 前进一步。',{},[finder,slow],{finder,slow});}show('found','在入口节点相遇。',{answer:finder.val},[finder],{finder,slow});return finder.val;}}show('return','不存在环，返回 null。',{answer:null},[],{slow,fast});return null;}),
21:lesson({...base,id:21,signature:'public ListNode mergeTwoLists(ListNode list1, ListNode list2)',sample:{list1:[1,2,4],list2:[1,3,4]},expected:[1,1,2,3,4,4],call:'new Solution().mergeTwoLists(LessonIO.list(1,2,4),LessonIO.list(1,3,4))',description:'合并两条非递减链表，返回非递减结果。通过连接原节点完成合并。',idea:'两个头节点中较小的一个，必然是剩余结果的最小值。把它接到 tail 后面，再移动对应链表指针。任意一条用完后，直接接上另一条。',invariant:'tail 之前的结果已经有序；未处理节点分别由 list1、list2 指向。',time:'O(m+n)',space:'O(1)'},`class Solution {
    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {
        ListNode dummy = new ListNode(0), tail = dummy; // @init
        while (list1 != null && list2 != null) { // @loop
            if (list1.val <= list2.val) { // @compare
                tail.next = list1; // @take-a
                list1 = list1.next; // @a
            } else {
                tail.next = list2; // @take-b
                list2 = list2.next; // @b
            }
            tail = tail.next; // @tail
        }
        tail.next = list1 == null ? list2 : list1; // @rest
        return dummy.next; // @return
    }
}`,({list1:listA,list2:listB},emit)=>{const nodes=[];let a=list(array(listA,'list1',{sorted:true,max:12}),nodes),b=list(array(listB,'list2',{sorted:true,max:12}),nodes);const dummy=node(0,nodes),show=structureSteps(emit,nodes);let tail=dummy;show('init','哑节点统一处理头节点连接。',{},[dummy],{list1:a,list2:b,tail});while(a&&b){show('loop','两条链都还有未处理节点。',{},[a,b],{list1:a,list2:b,tail});show('compare','比较两个当前头节点。',{},[a,b],{list1:a,list2:b,tail});if(a.val<=b.val){tail.next=a;show('take-a','较小的 A 节点接到结果尾部。',{},[tail,a],{list1:a,list2:b,tail});a=a.next;show('a','A 指针前进。',{},[a],{list1:a,list2:b,tail});}else{tail.next=b;show('take-b','较小的 B 节点接到结果尾部。',{},[tail,b],{list1:a,list2:b,tail});b=b.next;show('b','B 指针前进。',{},[b],{list1:a,list2:b,tail});}tail=tail.next;show('tail','结果尾指针前进。',{},[tail],{list1:a,list2:b,tail});}tail.next=a||b;show('rest','把剩余有序链整体接上。',{},[tail,a,b],{tail});show('return','返回哑节点之后的结果头。',{},[dummy.next],{head:dummy.next});return values(dummy.next);}),
2:lesson({...base,id:2,signature:'public ListNode addTwoNumbers(ListNode l1, ListNode l2)',sample:{l1:[2,4,3],l2:[5,6,4]},expected:[7,0,8],call:'new Solution().addTwoNumbers(LessonIO.list(2,4,3),LessonIO.list(5,6,4))',description:'两条非空链表按低位在前保存两个非负整数，每个节点是一位数字。返回相同表示方式的和。',idea:'从个位起逐位相加，同时携带进位。当前结果是 sum%10，下一位进位是 sum/10。两条链都结束后，仍可能需要一个额外进位节点。',invariant:'结果已完成较低位，carry 保存向下一位传递的进位。',time:'O(max(m,n))',space:'O(max(m,n))，输出'},`class Solution {
    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {
        ListNode dummy = new ListNode(0), tail = dummy; // @init
        int carry = 0; // @carry-init
        while (l1 != null || l2 != null || carry != 0) { // @loop
            int sum = carry + (l1 == null ? 0 : l1.val) + (l2 == null ? 0 : l2.val); // @sum
            tail.next = new ListNode(sum % 10); // @digit
            tail = tail.next; // @tail
            carry = sum / 10; // @carry
            if (l1 != null) l1 = l1.next; // @a
            if (l2 != null) l2 = l2.next; // @b
        }
        return dummy.next; // @return
    }
}`,({l1:listA,l2:listB},emit)=>{const a=array(listA,'l1',{min:1,max:12}),b=array(listB,'l2',{min:1,max:12});if([...a,...b].some(v=>v<0||v>9))throw Error('节点值必须是 0 到 9 的数字');const nodes=[];let l1=list(a,nodes),l2=list(b,nodes);const dummy=node(0,nodes),show=structureSteps(emit,nodes);let tail=dummy,carry=0;show('init','创建结果链表的哑节点。',{},[dummy],{l1,l2,tail});show('carry-init','初始进位为 0。',{carry},[],{l1,l2,tail});while(l1||l2||carry){show('loop','输入位或进位尚未处理完。',{carry},[l1,l2],{l1,l2,tail});const sum=carry+(l1?.val||0)+(l2?.val||0);show('sum',`当前两位加进位等于 ${sum}。`,{sum,carry},[l1,l2],{l1,l2,tail});tail.next=node(sum%10,nodes);show('digit','个位部分形成一个新结果节点。',{sum,carry},[tail.next],{l1,l2,tail});tail=tail.next;show('tail','结果尾指针移动到新节点。',{sum,carry},[tail],{l1,l2,tail});carry=Math.floor(sum/10);show('carry','十位部分作为下一轮进位。',{sum,carry},[],{l1,l2,tail});if(l1)l1=l1.next;show('a','第一条链移动到下一位。',{carry},[l1],{l1,l2,tail});if(l2)l2=l2.next;show('b','第二条链移动到下一位。',{carry},[l2],{l1,l2,tail});}show('return','所有数位和进位均已处理。',{},[dummy.next],{head:dummy.next});return values(dummy.next);})
};
