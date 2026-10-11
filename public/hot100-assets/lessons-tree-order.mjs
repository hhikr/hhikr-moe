import {lesson,array,integer} from './lesson-kit.mjs';
import {node,tree,treeValues,structureSteps} from './structures.mjs';
const base={mode:'tree',valueLabel:'节点值',stateLabel:'遍历与顺序'};
function setup(input,emit){const nodes=[],root=tree(input.root,nodes);return {nodes,root,show:structureSteps(emit,nodes,'tree',root)};}
export const treeOrderLessons={
102:lesson({...base,id:102,signature:'public List<List<Integer>> levelOrder(TreeNode root)',sample:{root:[3,9,20,null,null,15,7]},expected:[[3],[9,20],[15,7]],call:'new Solution().levelOrder(LessonIO.tree(3,9,20,null,null,15,7))',description:'按从上到下、每层从左到右的顺序返回节点值，每层独立成一个数组。',idea:'队列保存待处理节点。每轮先固定队列长度，这个长度正好是当前层的节点数。新入队的孩子留到下一轮。',invariant:'外层循环开始时，队列恰好包含下一层全部节点。',time:'O(n)',space:'O(w)，w 为最大层宽'},`class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> result = new ArrayList<>(); // @init
        if (root == null) return result; // @empty
        Deque<TreeNode> queue = new ArrayDeque<>(); // @queue
        queue.add(root); // @enqueue
        while (!queue.isEmpty()) { // @loop
            int size = queue.size(); // @size
            List<Integer> level = new ArrayList<>(); // @level
            for (int i = 0; i < size; i++) { // @each
                TreeNode node = queue.remove(); // @take
                level.add(node.val); // @record
                if (node.left != null) queue.add(node.left); // @left
                if (node.right != null) queue.add(node.right); // @right
            }
            result.add(level); // @append
        }
        return result; // @return
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit),result=[],queue=[];const step=(key,note,n=null,vars={})=>show(key,note,{queue:queue.map(n=>`#${n.id}`),result,...vars},[n,...queue],{current:n});step('init','建立按层分组的结果表。');step('empty',root?'根节点存在。':'空树返回空结果。');if(!root)return result;step('queue','建立先进先出队列。');queue.push(root);step('enqueue','根节点入队。',root);while(queue.length){step('loop','处理队列中的当前层。');const size=queue.length;step('size','固定当前层的节点数。',null,{size});const level=[];step('level','建立当前层结果。',null,{size,level});for(let i=0;i<size;i++){step('each','只取固定数量的节点。',null,{i,size,level});const n=queue.shift();step('take','队头节点出队。',n,{i,size,level});level.push(n.val);step('record','记录当前节点的值。',n,{i,size,level});if(n.left)queue.push(n.left);step('left','非空左孩子加入队尾。',n,{i,size,level});if(n.right)queue.push(n.right);step('right','非空右孩子加入队尾。',n,{i,size,level});}result.push(level);step('append','当前层完成，下一轮处理孩子。');}step('return','返回逐层结果。');return result;}),
199:lesson({...base,id:199,signature:'public List<Integer> rightSideView(TreeNode root)',sample:{root:[1,2,3,null,5,null,4]},expected:[1,3,4],call:'new Solution().rightSideView(LessonIO.tree(1,2,3,null,5,null,4))',description:'从树的右侧观察，返回每一层最右边可见节点的值。',idea:'深度优先遍历时先进入右子树。每个深度第一次访问的节点就是该层最右节点，之后同层节点不再加入结果。',invariant:'result 中每个已出现深度的值，都是右优先遍历首次遇到的节点。',time:'O(n)',space:'O(h)'},`class Solution {
    public List<Integer> rightSideView(TreeNode root) {
        List<Integer> result = new ArrayList<>(); // @init
        visit(root, 0, result); // @start
        return result; // @return
    }
    private void visit(TreeNode node, int depth, List<Integer> result) {
        if (node == null) return; // @empty
        if (depth == result.size()) result.add(node.val); // @record
        visit(node.right, depth + 1, result); // @right
        visit(node.left, depth + 1, result); // @left
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit),result=[];const step=(key,note,n,depth)=>show(key,note,{depth,result},[n],{current:n});step('init','建立右视图结果。',root,0);step('start','从深度 0 开始右优先遍历。',root,0);function visit(n,d){step('empty',n?'访问非空节点。':'空子树返回。',n,d);if(!n)return;if(d===result.length)result.push(n.val);step('record','这一层第一次遇到的节点才写入结果。',n,d);step('right','先访问右子树，优先占据下一层。',n,d);visit(n.right,d+1);step('left','右子树完成，再访问左子树。',n,d);visit(n.left,d+1);}visit(root,0);step('return','返回每层第一个访问到的值。',root,0);return result;}),
108:lesson({...base,id:108,signature:'public TreeNode sortedArrayToBST(int[] nums)',sample:{nums:[-10,-3,0,5,9]},expected:[0,-10,5,null,-3,null,9],call:'new Solution().sortedArrayToBST(new int[]{-10,-3,0,5,9})',javaTransform:'LessonIO.treeValues(__RESULT__)',description:'将严格递增数组构造成高度平衡的二叉搜索树。本课程始终选择区间下中点，因此演示与 Java 输出一致；题目允许其他平衡结果。',idea:'中点作为根，左半区构造左子树，右半区构造右子树。两边节点数最多相差一，递归保证高度平衡。',invariant:'build(left,right) 构造恰好包含该闭区间元素的平衡搜索树。',time:'O(n)',space:'O(log n)，不计结果树'},`class Solution {
    public TreeNode sortedArrayToBST(int[] nums) {
        return build(nums, 0, nums.length - 1); // @start
    }
    private TreeNode build(int[] nums, int left, int right) {
        if (left > right) return null; // @empty
        int mid = left + (right - left) / 2; // @mid
        TreeNode root = new TreeNode(nums[mid]); // @create
        root.left = build(nums, left, mid - 1); // @left
        root.right = build(nums, mid + 1, right); // @right
        return root; // @return
    }
}`, ({nums:input},emit)=>{const nums=array(input,'nums',{sorted:true,max:16});if(new Set(nums).size!==nums.length)throw Error('nums 必须严格递增');const nodes=[];let root=null;const show=(key,note,n,vars)=>structureSteps(emit,nodes,'tree',root)(key,note,{nums,...vars},[n],{current:n});show('start','从整个数组区间开始构造。',null,{left:0,right:nums.length-1});function build(left,right,depth){show('empty',left>right?'空区间返回 null。':'区间非空，需要选择根。',null,{left,right,depth});if(left>right)return null;const mid=left+Math.floor((right-left)/2);show('mid','选择区间下中点。',null,{left,right,mid,depth});const n=node(nums[mid],nodes,depth);if(!root)root=n;show('create','创建中点节点。',n,{left,right,mid,depth});const a=build(left,mid-1,depth+1);n.left=a;show('left','左半区构造完成，连接左孩子。',n,{left,right,mid,depth});const b=build(mid+1,right,depth+1);n.right=b;show('right','右半区构造完成，连接右孩子。',n,{left,right,mid,depth});show('return','当前区间的平衡子树完成。',n,{left,right,mid,depth});return n;}root=build(0,nums.length-1,0);return treeValues(root);}),
98:lesson({...base,id:98,signature:'public boolean isValidBST(TreeNode root)',sample:{root:[5,1,4,null,null,3,6]},expected:false,call:'new Solution().isValidBST(LessonIO.tree(5,1,4,null,null,3,6))',description:'判断是否为严格二叉搜索树：每个节点的整个左子树都小于它，整个右子树都大于它。相等也不合法。',idea:'递归传入允许值的开区间。进入左边缩小上界，进入右边提高下界；祖先的限制会一路传下去。用 long 边界避免 int 极值冲突。',invariant:'节点必须严格位于所有祖先共同确定的 (low, high) 内。',time:'O(n)',space:'O(h)'},`class Solution {
    public boolean isValidBST(TreeNode root) {
        return valid(root, Long.MIN_VALUE, Long.MAX_VALUE); // @start
    }
    private boolean valid(TreeNode node, long low, long high) {
        if (node == null) return true; // @empty
        if (node.val <= low || node.val >= high) return false; // @check
        boolean left = valid(node.left, low, node.val); // @left
        return left && valid(node.right, node.val, high); // @right
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit);show('start','根的允许范围没有有限边界。',{},[root],{current:root});function valid(n,low,high,depth){const vars={low:Number.isFinite(low)?low:'−∞',high:Number.isFinite(high)?high:'+∞',depth};show('empty',n?'检查当前节点。':'空树符合搜索树条件。',vars,[n],{current:n});if(!n)return true;show('check',n.val<=low||n.val>=high?'节点越过祖先限制，返回 false。':'节点处于允许开区间。',vars,[n],{current:n});if(n.val<=low||n.val>=high)return false;show('left','左子树的上界缩小到当前值。',vars,[n],{current:n});const left=valid(n.left,low,n.val,depth+1);show('right',left?'右子树的下界提高到当前值。':'左子树非法，短路返回。',{...vars,left},[n],{current:n});return left&&valid(n.right,n.val,high,depth+1);}return valid(root,-Infinity,Infinity,0);}),
230:lesson({...base,id:230,signature:'public int kthSmallest(TreeNode root, int k)',sample:{root:[3,1,4,null,2],k:1},expected:1,call:'new Solution().kthSmallest(LessonIO.tree(3,1,4,null,2),1)',description:'在二叉搜索树中寻找第 k 小的节点值，k 从 1 开始。演示要求输入为有效搜索树。',idea:'搜索树的中序遍历严格递增。用显式栈模拟递归，沿左边压栈，弹出时记录一个值，数到 k 就返回。',invariant:'已弹出的节点是递增序列的前缀；栈顶是下一次回溯的位置。',time:'O(h+k)',space:'O(h)'},`class Solution {
    public int kthSmallest(TreeNode root, int k) {
        Deque<TreeNode> stack = new ArrayDeque<>(); // @init
        TreeNode current = root; // @current
        while (current != null || !stack.isEmpty()) { // @loop
            while (current != null) { // @descend
                stack.push(current); // @push
                current = current.left; // @left
            }
            current = stack.pop(); // @pop
            if (--k == 0) return current.val; // @count
            current = current.right; // @right
        }
        throw new IllegalArgumentException("k 超出节点数"); // @invalid
    }
}`, (input,emit)=>{const {root,nodes,show}=setup(input,emit);let k=integer(input.k,'k',1,nodes.length);function valid(n,l=-Infinity,r=Infinity){return !n||(n.val>l&&n.val<r&&valid(n.left,l,n.val)&&valid(n.right,n.val,r));}if(!valid(root))throw Error('root 必须是有效二叉搜索树');const stack=[];let current=root;const step=(key,note)=>show(key,note,{k,stack:stack.map(n=>`#${n.id}`)},[current],{current});step('init','建立显式递归栈。');step('current','current 从根开始。');while(current||stack.length){step('loop','当前节点或栈中仍有未访问节点。');while(current){step('descend','尽可能沿左边下降。');stack.push(current);step('push','当前节点压栈，等待左子树完成。');current=current.left;step('left','移动到左孩子。');}current=stack.pop();step('pop','左边已完成，弹出下一个中序节点。');k--;step('count',k===0?'计数达到第 k 个，返回当前值。':'还未达到目标，继续遍历。');if(k===0)return current.val;current=current.right;step('right','转入右子树。');}throw Error('k 超出节点数');})
};
