import {lesson} from './lesson-kit.mjs';
import {tree,treeValues,structureSteps} from './structures.mjs';
const base={mode:'tree',valueLabel:'节点值',stateLabel:'递归状态'};
function setup(input,emit){const nodes=[],root=tree(input.root,nodes);return {nodes,root,show:structureSteps(emit,nodes,'tree',root)};}
export const treeLessons={
94:lesson({...base,id:94,signature:'public List<Integer> inorderTraversal(TreeNode root)',sample:{root:[1,null,2,3]},expected:[1,3,2],call:'new Solution().inorderTraversal(LessonIO.tree(1,null,2,3))',description:'返回二叉树的中序遍历：先左子树，再当前节点，最后右子树。root 使用层序数组，null 表示空位置。',idea:'每个递归调用负责一棵子树。左子树返回后才记录当前值，所以结果按左、根、右排列。',invariant:'visit 返回时，这棵子树的中序结果已完整追加到结果表。',time:'O(n)',space:'O(h)，不计结果表'},`class Solution {
    public List<Integer> inorderTraversal(TreeNode root) {
        List<Integer> result = new ArrayList<>(); // @init
        visit(root, result); // @start
        return result; // @return
    }
    private void visit(TreeNode node, List<Integer> result) {
        if (node == null) return; // @empty
        visit(node.left, result); // @left
        result.add(node.val); // @record
        visit(node.right, result); // @right
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit),result=[];const display=(key,n,note,depth)=>show(key,note,{depth,result:[...result]},[n],{current:n});display('init',root,'建立空结果表。',0);display('start',root,'从根节点开始遍历。',0);function visit(n,depth){display('empty',n,n?'节点存在，继续递归。':'空子树返回。',depth);if(!n)return;display('left',n,'进入左子树。',depth);visit(n.left,depth+1);result.push(n.val);display('record',n,'左子树完成，记录当前节点。',depth);display('right',n,'进入右子树。',depth);visit(n.right,depth+1);}visit(root,0);display('return',root,'所有节点均按中序记录。',0);return result;}),
104:lesson({...base,id:104,signature:'public int maxDepth(TreeNode root)',sample:{root:[3,9,20,null,null,15,7]},expected:3,call:'new Solution().maxDepth(LessonIO.tree(3,9,20,null,null,15,7))',description:'求二叉树的最大深度，即根到最远叶子路径上的节点数。空树深度为 0。',idea:'当前树深度等于左右子树深度较大者加一。递归返回值代表子树高度，逐层向根汇总。',invariant:'每次返回的值都是当前子树的真实最大深度。',time:'O(n)',space:'O(h)'},`class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0; // @empty
        int left = maxDepth(root.left); // @left
        int right = maxDepth(root.right); // @right
        return Math.max(left, right) + 1; // @return
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit);function depth(n,d){show('empty',n?'当前节点存在。':'空子树高度为 0。',{depth:d},[n],{current:n});if(!n)return 0;show('left','计算左子树高度。',{depth:d},[n],{current:n});const left=depth(n.left,d+1);show('right','左子树返回，计算右子树高度。',{depth:d,left},[n],{current:n});const right=depth(n.right,d+1),answer=Math.max(left,right)+1;show('return','选择较大高度，再加上当前节点。',{depth:d,left,right,answer},[n],{current:n});return answer;}return depth(root,0);}),
226:lesson({...base,id:226,signature:'public TreeNode invertTree(TreeNode root)',sample:{root:[4,2,7,1,3,6,9]},expected:[4,7,2,9,6,3,1],call:'new Solution().invertTree(LessonIO.tree(4,2,7,1,3,6,9))',javaTransform:'LessonIO.treeValues(__RESULT__)',description:'将每个节点的左右子树交换，返回翻转后的根节点。输出仍为层序数组。',idea:'先翻转两个子树，再交换左右引用。节点身份和值都不变，图中的边随代码赋值改变。',invariant:'递归返回时，当前子树内的每一对左右连接都已交换。',time:'O(n)',space:'O(h)'},`class Solution {
    public TreeNode invertTree(TreeNode root) {
        if (root == null) return null; // @empty
        TreeNode left = invertTree(root.left); // @left
        TreeNode right = invertTree(root.right); // @right
        root.left = right; // @set-left
        root.right = left; // @set-right
        return root; // @return
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit);function invert(n,depth){show('empty',n?'当前子树需要翻转。':'空子树返回 null。',{depth},[n],{current:n});if(!n)return null;show('left','递归翻转左子树。',{depth},[n],{current:n});const left=invert(n.left,depth+1);show('right','递归翻转右子树。',{depth},[n],{current:n,left});const right=invert(n.right,depth+1);n.left=right;show('set-left','左引用指向原右子树。',{depth},[n,right],{current:n,left,right});n.right=left;show('set-right','右引用指向原左子树，交换完成。',{depth},[n,left],{current:n,left,right});show('return','返回翻转后的子树根。',{depth},[n],{current:n});return n;}invert(root,0);return treeValues(root);}),
101:lesson({...base,id:101,signature:'public boolean isSymmetric(TreeNode root)',sample:{root:[1,2,2,3,4,4,3]},expected:true,call:'new Solution().isSymmetric(LessonIO.tree(1,2,2,3,4,4,3))',description:'判断二叉树是否关于根节点镜像对称。必须同时比较结构和值。',idea:'成对比较两棵树：根值相等，而且 A 的左边与 B 的右边、A 的右边与 B 的左边分别对称。',invariant:'mirror(a,b) 检查这两棵子树是否互为镜像。',time:'O(n)',space:'O(h)'},`class Solution {
    public boolean isSymmetric(TreeNode root) {
        return root == null || mirror(root.left, root.right); // @start
    }
    private boolean mirror(TreeNode a, TreeNode b) {
        if (a == null || b == null) return a == b; // @empty
        if (a.val != b.val) return false; // @compare
        boolean outer = mirror(a.left, b.right); // @outer
        return outer && mirror(a.right, b.left); // @inner
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit);show('start','从根的左右子树开始比较。',{},[root],{root});function mirror(a,b,depth){show('empty','空节点需要成对出现。',{depth},[a,b],{a,b});if(!a||!b)return a===b;show('compare',a.val===b.val?'节点值相同。':'节点值不同，返回 false。',{depth},[a,b],{a,b});if(a.val!==b.val)return false;show('outer','比较外侧：左子树的左边与右子树的右边。',{depth},[a,b],{a,b});const outer=mirror(a.left,b.right,depth+1);show('inner',outer?'比较内侧。':'外侧不对称，短路返回。',{depth,outer},[a,b],{a,b});return outer&&mirror(a.right,b.left,depth+1);}return !root||mirror(root.left,root.right,0);}),
543:lesson({...base,id:543,signature:'public int diameterOfBinaryTree(TreeNode root)',sample:{root:[1,2,3,4,5]},expected:3,call:'new Solution().diameterOfBinaryTree(LessonIO.tree(1,2,3,4,5))',description:'求任意两个节点之间最长路径的边数。路径可以不经过根节点。',idea:'经过某节点的最长路径是左高度加右高度。每个节点都尝试更新全局直径，而递归只向父节点返回单侧高度。',invariant:'best 记录已处理节点中的最大左右高度之和；height 返回单侧高度。',time:'O(n)',space:'O(h)'},`class Solution {
    private int best;
    public int diameterOfBinaryTree(TreeNode root) {
        best = 0; // @init
        height(root); // @start
        return best; // @answer
    }
    private int height(TreeNode node) {
        if (node == null) return 0; // @empty
        int left = height(node.left); // @left
        int right = height(node.right); // @right
        best = Math.max(best, left + right); // @update
        return Math.max(left, right) + 1; // @return
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit);let best=0;show('init','直径初始为 0。',{best},[],{});show('start','后序计算每个节点的高度。',{best},[root],{current:root});function height(n,depth){show('empty',n?'当前节点存在。':'空子树高度为 0。',{best,depth},[n],{current:n});if(!n)return 0;show('left','取得左高度。',{best,depth},[n],{current:n});const left=height(n.left,depth+1);show('right','取得右高度。',{best,depth,left},[n],{current:n});const right=height(n.right,depth+1);best=Math.max(best,left+right);show('update','左右高度相加，就是经过当前节点的路径边数。',{best,left,right,depth},[n,n.left,n.right],{current:n});const answer=Math.max(left,right)+1;show('return','向父节点返回一条可延伸的高度。',{best,answer,depth},[n],{current:n});return answer;}height(root,0);show('answer','返回所有候选路径中的最大边数。',{best},[root],{root});return best;})
};
