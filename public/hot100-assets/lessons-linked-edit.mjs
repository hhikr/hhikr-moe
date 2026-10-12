import {lesson,array,integer} from './lesson-kit.mjs';
import {node,list,values,structureSteps} from './structures.mjs';
const base={mode:'linked',valueLabel:'节点值（图中编号表示身份）',stateLabel:'指针与连接'};
export const linkedEditLessons={
234:lesson({...base,id:234,signature:'public boolean isPalindrome(ListNode head)',sample:{head:[1,2,2,1]},expected:true,call:'new Solution().isPalindrome(LessonIO.list(1,2,2,1))',description:'判断链表从前向后与从后向前读取是否相同。使用常数额外空间；本解法比较后恢复原链表。',idea:'快慢指针找到前半段尾部，反转后半段后逐对比较。最后再次反转后半段，并接回原位置。',invariant:'比较指针分别沿前半段正向、后半段反向前进。',time:'O(n)',space:'O(1)'},`class Solution {
    public boolean isPalindrome(ListNode head) {
        if (head == null || head.next == null) return true; // @short
        ListNode slow = head, fast = head; // @init
        while (fast.next != null && fast.next.next != null) { // @middle
            slow = slow.next; // @slow
            fast = fast.next.next; // @fast
        }
        ListNode second = reverse(slow.next); // @reverse-call
        ListNode a = head, b = second; // @compare-init
        boolean answer = true; // @answer-init
        while (b != null) { // @compare-loop
            if (a.val != b.val) answer = false; // @compare
            a = a.next; b = b.next; // @advance
        }
        slow.next = reverse(second); // @restore
        return answer; // @return
    }
    private ListNode reverse(ListNode current) {
        ListNode prev = null; // @reverse-init
        while (current != null) { // @reverse-loop
            ListNode next = current.next; // @save
            current.next = prev; // @reverse
            prev = current; current = next; // @reverse-advance
        }
        return prev; // @reverse-return
    }
}`,({head:input},emit)=>{const nodes=[],head=list(input,nodes),show=structureSteps(emit,nodes);show('short',!head||!head.next?'长度不足两项，必定回文。':'链表至少两项，继续比较。',{},[head],{head});if(!head||!head.next)return true;let slow=head,fast=head;show('init','快慢指针寻找前半段尾部。',{},[head],{slow,fast});while(fast.next&&fast.next.next){show('middle','快指针还能前进两步。',{},[slow,fast],{slow,fast});slow=slow.next;show('slow','慢指针前进一步。',{},[slow,fast],{slow,fast});fast=fast.next.next;show('fast','快指针前进两步。',{},[slow,fast],{slow,fast});}function reverse(current){let prev=null;show('reverse-init','开始反转这段链表。',{},[current],{prev,current});while(current){show('reverse-loop','处理一个待反转节点。',{},[current],{prev,current});const next=current.next;show('save','保存后继。',{},[current,next],{prev,current,next});current.next=prev;show('reverse','改变 next 箭头。',{},[current,prev],{prev,current,next});prev=current;current=next;show('reverse-advance','两个指针前进。',{},[prev,current],{prev,current});}show('reverse-return','返回这段反转后的头。',{},[prev],{prev});return prev;}show('reverse-call','调用反转函数处理后半段。',{},[slow.next],{slow});const second=reverse(slow.next);let a=head,b=second;show('compare-init','分别从两半段的头开始比较。',{},[a,b],{a,b});let answer=true;show('answer-init','先假定两半段相同。',{answer},[],{a,b});while(b){show('compare-loop','后半段还有节点。',{answer},[a,b],{a,b});if(a.val!==b.val)answer=false;show('compare',a.val===b.val?'这一对数值相同。':'发现不同数值，答案为 false。',{answer},[a,b],{a,b});a=a.next;b=b.next;show('advance','移动到下一对节点。',{answer},[a,b],{a,b});}show('restore','再次反转后半段，恢复原链表。',{answer},[second],{slow,second});slow.next=reverse(second);show('return','原链表已恢复，返回判断结果。',{answer},[head],{head});return answer;}),
19:lesson({...base,id:19,signature:'public ListNode removeNthFromEnd(ListNode head, int n)',sample:{head:[1,2,3,4,5],n:2},expected:[1,2,3,5],call:'new Solution().removeNthFromEnd(LessonIO.list(1,2,3,4,5),2)',description:'删除链表倒数第 n 个节点并返回头节点。n 必须在 1 到链表长度之间。',idea:'哑节点可以统一删除头节点的情况。fast 先比 slow 多走 n 步，之后一起前进；fast 到尾节点时，slow 位于待删除节点之前。',invariant:'同步移动阶段，fast 与 slow 相隔 n 个 next 连接。',time:'O(n)',space:'O(1)'},`class Solution {
    public ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode dummy = new ListNode(0, head); // @dummy
        ListNode slow = dummy, fast = dummy; // @init
        for (int i = 0; i < n; i++) fast = fast.next; // @gap
        while (fast.next != null) { // @loop
            slow = slow.next; // @slow
            fast = fast.next; // @fast
        }
        slow.next = slow.next.next; // @remove
        return dummy.next; // @return
    }
}`,({head:input,n},emit)=>{const a=array(input,'head',{min:1,max:16});integer(n,'n',1,a.length);const nodes=[],head=list(a,nodes),dummy=node(0,nodes);dummy.next=head;const show=structureSteps(emit,nodes);show('dummy','哑节点连接原头节点。',{n},[dummy],{head,dummy});let slow=dummy,fast=dummy;show('init','两个指针从哑节点出发。',{n},[dummy],{slow,fast});for(let i=0;i<n;i++){fast=fast.next;show('gap','fast 提前走一步。',{i,n},[fast],{slow,fast});}while(fast.next){show('loop','fast 还没有到达尾节点。',{n},[slow,fast],{slow,fast});slow=slow.next;show('slow','slow 前进一步。',{n},[slow,fast],{slow,fast});fast=fast.next;show('fast','fast 前进一步，保持距离。',{n},[slow,fast],{slow,fast});}const removed=slow.next;slow.next=removed.next;show('remove','跳过待删除节点，修改前驱的 next。',{n,removed:removed.val},[slow,removed],{slow,fast});show('return','返回新的头节点。',{},[dummy.next],{head:dummy.next});return values(dummy.next);}),
24:lesson({...base,id:24,signature:'public ListNode swapPairs(ListNode head)',sample:{head:[1,2,3,4]},expected:[2,1,4,3],call:'new Solution().swapPairs(LessonIO.list(1,2,3,4))',description:'每两个相邻节点交换位置，返回新的头节点。必须修改节点连接，不能只交换节点值。最后不足两个节点时保留。',idea:'prev 指向待交换两个节点的前驱。先让 first 接上后续链，再让 second 接 first，最后让 prev 接 second；把前驱移到交换后的尾节点。',invariant:'prev 之前的节点已经按对交换，prev.next 是下一对的第一个节点。',time:'O(n)',space:'O(1)'},`class Solution {
    public ListNode swapPairs(ListNode head) {
        ListNode dummy = new ListNode(0, head), prev = dummy; // @init
        while (prev.next != null && prev.next.next != null) { // @loop
            ListNode first = prev.next, second = first.next; // @pair
            first.next = second.next; // @tail
            second.next = first; // @reverse
            prev.next = second; // @connect
            prev = first; // @advance
        }
        return dummy.next; // @return
    }
}`,({head:input},emit)=>{const nodes=[],head=list(input,nodes),dummy=node(0,nodes);dummy.next=head;let prev=dummy;const show=structureSteps(emit,nodes);show('init','哑节点作为第一对节点的前驱。',{},[dummy],{prev});while(prev.next&&prev.next.next){show('loop','剩余部分至少还有两个节点。',{},[prev.next,prev.next.next],{prev});const first=prev.next,second=first.next;show('pair','保存这一对节点。',{},[first,second],{prev,first,second});first.next=second.next;show('tail','first 先连接下一段链表。',{},[first],{prev,first,second});second.next=first;show('reverse','second 指向 first。',{},[first,second],{prev,first,second});prev.next=second;show('connect','前驱指向交换后的头 second。',{},[prev,second],{prev,first,second});prev=first;show('advance','first 成为下一对的前驱。',{},[prev],{prev});}show('return','所有完整节点对已交换。',{},[dummy.next],{head:dummy.next});return values(dummy.next);}),
25:lesson({...base,id:25,signature:'public ListNode reverseKGroup(ListNode head, int k)',sample:{head:[1,2,3,4,5],k:2},expected:[2,1,4,3,5],call:'new Solution().reverseKGroup(LessonIO.list(1,2,3,4,5),2)',description:'每 k 个节点反转一组，最后不足 k 个节点时保持原顺序。节点值不变，原地改变连接。',idea:'先检查是否有完整的 k 个节点，并保存下一组的头。把组内节点反转，最后连接前驱与新组头；原组头成为新尾和下一轮前驱。',invariant:'groupPrev 之前的完整分组都已处理；groupNext 保存当前组之后的链表。',time:'O(n)',space:'O(1)'},`class Solution {
    public ListNode reverseKGroup(ListNode head, int k) {
        ListNode dummy = new ListNode(0, head), groupPrev = dummy; // @init
        while (true) { // @loop
            ListNode kth = groupPrev; // @kth
            for (int i = 0; i < k && kth != null; i++) kth = kth.next; // @check
            if (kth == null) break; // @short
            ListNode groupNext = kth.next; // @next-group
            ListNode prev = groupNext, current = groupPrev.next; // @reverse-init
            while (current != groupNext) { // @reverse-loop
                ListNode next = current.next; // @save
                current.next = prev; // @reverse
                prev = current; current = next; // @advance
            }
            ListNode oldHead = groupPrev.next; // @old-head
            groupPrev.next = kth; // @connect
            groupPrev = oldHead; // @next-prev
        }
        return dummy.next; // @return
    }
}`,({head:input,k},emit)=>{integer(k,'k',1,16);const nodes=[],head=list(input,nodes),dummy=node(0,nodes);dummy.next=head;const show=structureSteps(emit,nodes);let groupPrev=dummy;show('init','哑节点统一处理第一组连接。',{k},[dummy],{groupPrev});while(true){show('loop','检查下一组是否完整。',{k},[groupPrev],{groupPrev});let kth=groupPrev;show('kth','从组前驱开始寻找第 k 个节点。',{k},[kth],{groupPrev,kth});for(let i=0;i<k&&kth;i++){kth=kth.next;show('check','沿链表向前走一步。',{i,k},[kth],{groupPrev,kth});}show('short',kth?'这一组完整，可以反转。':'剩余不足 k 个节点，保持原样。',{k},[kth],{groupPrev,kth});if(!kth)break;const groupNext=kth.next;show('next-group','保存下一组起点。',{k},[groupNext],{groupPrev,kth,groupNext});let prev=groupNext,current=groupPrev.next;show('reverse-init','反转后的组尾直接连接下一组。',{k},[current],{prev,current,groupNext});while(current!==groupNext){show('reverse-loop','当前节点仍在本组内。',{k},[current],{prev,current,groupNext});const next=current.next;show('save','保存原后继。',{k},[current,next],{prev,current,next});current.next=prev;show('reverse','当前 next 转向反转前缀。',{k},[current,prev],{prev,current,next});prev=current;current=next;show('advance','继续处理组内下一节点。',{k},[prev,current],{prev,current,groupNext});}const oldHead=groupPrev.next;show('old-head','原组头在反转后成为组尾。',{k},[oldHead],{groupPrev,kth,oldHead});groupPrev.next=kth;show('connect','前驱连接新的组头。',{k},[groupPrev,kth],{groupPrev,kth,oldHead});groupPrev=oldHead;show('next-prev','组尾成为下一轮前驱。',{k},[groupPrev],{groupPrev});}show('return','返回分组反转后的头。',{},[dummy.next],{head:dummy.next});return values(dummy.next);})
};
