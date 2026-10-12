import {lesson,array,integer} from './lesson-kit.mjs';
import {node,tree,treeValues,values,structureSteps} from './structures.mjs';
const base={mode:'tree',valueLabel:'节点值',stateLabel:'递归与路径'};
function setup(input,emit){const nodes=[],root=tree(input.root,nodes);return {nodes,root,show:structureSteps(emit,nodes,'tree',root)};}
export const treePathLessons={
114:lesson({...base,id:114,signature:'public void flatten(TreeNode root)',sample:{root:[1,2,5,3,4,null,6]},expected:[1,2,3,4,5,6],javaSetup:'TreeNode root = LessonIO.tree(1,2,5,3,4,null,6);',call:'new Solution().flatten(root)',javaResult:'LessonIO.rightValues(root)',description:'原地把二叉树展开成前序顺序的链：每个节点 left 为 null，right 指向下一个节点。输出展示 right 链的值。',idea:'若当前节点有左子树，先找左子树最右节点，把原右子树接在它后面，再把整个左子树移到右边。随后沿 right 继续。',invariant:'current 之前的 right 链已符合前序顺序；剩余子树仍保留全部节点。',time:'O(n)',space:'O(1)'},`class Solution {
    public void flatten(TreeNode root) {
        TreeNode current = root; // @init
        while (current != null) { // @loop
            if (current.left != null) { // @check
                TreeNode predecessor = current.left; // @predecessor
                while (predecessor.right != null) { // @seek
                    predecessor = predecessor.right; // @move
                }
                predecessor.right = current.right; // @attach
                current.right = current.left; // @replace
                current.left = null; // @clear
            }
            current = current.right; // @advance
        }
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit);let current=root,predecessor=null;const step=(key,note)=>show(key,note,{},[current,predecessor],{current,predecessor});step('init','从根节点开始展开。');while(current){step('loop','当前节点存在。');step('check',current.left?'左子树需要移到右边。':'没有左子树，直接前进。');if(current.left){predecessor=current.left;step('predecessor','从左子树根寻找最右节点。');while(predecessor.right){step('seek','最右节点尚未找到。');predecessor=predecessor.right;step('move','沿右边继续寻找。');}step('seek','到达左子树最右节点。');predecessor.right=current.right;step('attach','原右子树接到左子树的末尾。');current.right=current.left;step('replace','左子树成为当前节点的右链。');current.left=null;step('clear','清空左引用，完成当前节点。');}current=current.right;predecessor=null;step('advance','沿 right 处理下一个节点。');}return values(root,'right');}),
105:lesson({...base,id:105,signature:'public TreeNode buildTree(int[] preorder, int[] inorder)',sample:{preorder:[3,9,20,15,7],inorder:[9,3,15,20,7]},expected:[3,9,20,null,null,15,7],call:'new Solution().buildTree(new int[]{3,9,20,15,7},new int[]{9,3,15,20,7})',javaTransform:'LessonIO.treeValues(__RESULT__)',description:'由不含重复值的前序和中序遍历构造二叉树。两数组必须描述同一棵树。输出为层序数组。',idea:'前序的下一项就是当前根。在中序中定位根，左右区间分别对应左右子树。前序游标按根、左、右消耗，每个节点只创建一次。',invariant:'build(left,right) 构建该中序闭区间，cursor 指向尚未使用的前序根。',time:'O(n)',space:'O(n)'},`class Solution {
    private int cursor;
    private final Map<Integer, Integer> index = new HashMap<>();
    public TreeNode buildTree(int[] preorder, int[] inorder) {
        cursor = 0; // @init
        index.clear(); // @clear
        for (int i = 0; i < inorder.length; i++) index.put(inorder[i], i); // @index
        return build(preorder, 0, inorder.length - 1); // @start
    }
    private TreeNode build(int[] preorder, int left, int right) {
        if (left > right) return null; // @empty
        int value = preorder[cursor++]; // @consume
        TreeNode root = new TreeNode(value); // @create
        int mid = index.get(value); // @mid
        root.left = build(preorder, left, mid - 1); // @left
        root.right = build(preorder, mid + 1, right); // @right
        return root; // @return
    }
}`, ({preorder:pre,inorder:ino},emit)=>{const preorder=array(pre,'preorder',{max:16}),inorder=array(ino,'inorder',{max:16});if(preorder.length!==inorder.length||new Set(preorder).size!==preorder.length||new Set(inorder).size!==inorder.length||preorder.some(v=>!inorder.includes(v)))throw Error('两序列必须长度相同、值互异且包含相同元素');const index=new Map(),nodes=[];let cursor=0,root=null;const show=(key,note,n=null,vars={})=>structureSteps(emit,nodes,'tree',root)(key,note,{cursor,preorder,inorder,...vars},[n],{current:n},[...index]);show('init','前序游标置零。');show('clear','清空中序位置表。');inorder.forEach((v,i)=>{index.set(v,i);show('index','记录值在中序中的位置。',null,{i,value:v});});show('start','构造整个中序区间。');function build(left,right,depth){show('empty',left>right?'空区间返回。':'当前区间非空。',null,{left,right,depth});if(left>right)return null;const value=preorder[cursor++];show('consume','取前序下一个根节点。',null,{left,right,value,depth});const n=node(value,nodes,depth);if(!root)root=n;show('create','创建当前根。',n,{left,right,value,depth});const mid=index.get(value);if(mid<left||mid>right)throw Error('前序和中序不能构成同一棵树');show('mid','根的位置将中序分成左右子树。',n,{left,right,mid,depth});n.left=build(left,mid-1,depth+1);show('left','连接构造完成的左子树。',n,{left,right,mid,depth});n.right=build(mid+1,right,depth+1);show('right','连接构造完成的右子树。',n,{left,right,mid,depth});show('return','返回当前子树根。',n,{left,right,mid,depth});return n;}root=build(0,inorder.length-1,0);return treeValues(root);}),
437:lesson({...base,id:437,signature:'public int pathSum(TreeNode root, int targetSum)',sample:{root:[10,5,-3,3,2,null,11,3,-2,null,1],targetSum:8},expected:3,call:'new Solution().pathSum(LessonIO.tree(10,5,-3,3,2,null,11,3,-2,null,1),8)',description:'统计和等于 targetSum 的向下路径数量。路径不必从根开始，也不必在叶子结束，但只能沿父到子的方向。',idea:'记录当前祖先路径的前缀和出现次数。到达前缀 sum 时，之前的 sum−target 每出现一次，就对应一条以当前节点结尾的路径。返回父层前撤销当前前缀，防止混入其他分支。',invariant:'count 只保存当前根到父节点路径上的前缀；初始 0 出现一次。',time:'O(n)，哈希表平均情况',space:'O(h)'},`class Solution {
    public int pathSum(TreeNode root, int targetSum) {
        Map<Long, Integer> count = new HashMap<>(); // @init
        count.put(0L, 1); // @zero
        return visit(root, 0L, targetSum, count); // @start
    }
    private int visit(TreeNode node, long sum, int target, Map<Long, Integer> count) {
        if (node == null) return 0; // @empty
        sum += node.val; // @sum
        int result = count.getOrDefault(sum - target, 0); // @match
        count.put(sum, count.getOrDefault(sum, 0) + 1); // @add
        result += visit(node.left, sum, target, count); // @left
        result += visit(node.right, sum, target, count); // @right
        count.put(sum, count.get(sum) - 1); // @remove
        return result; // @return
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit),target=integer(input.targetSum,'targetSum'),count=new Map();const step=(key,note,n,vars={})=>show(key,note,{target,...vars},[n],{current:n},[...count].filter(([,v])=>v>0));step('init','建立路径前缀计数表。',root);count.set(0,1);step('zero','空前缀计数为 1，允许路径从根开始。',root);step('start','开始向下搜索。',root);function visit(n,sum,depth){step('empty',n?'进入节点。':'空子树贡献 0。',n,{sum,depth});if(!n)return 0;sum+=n.val;step('sum','将当前节点加入前缀和。',n,{sum,depth});let result=count.get(sum-target)||0;step('match','查询能形成目标路径的祖先前缀数量。',n,{sum,result,needed:sum-target,depth});count.set(sum,(count.get(sum)||0)+1);step('add','当前前缀加入路径，供后代查询。',n,{sum,result,depth});step('left','搜索左子树。',n,{sum,result,depth});result+=visit(n.left,sum,depth+1);step('right','搜索右子树。',n,{sum,result,depth});result+=visit(n.right,sum,depth+1);count.set(sum,count.get(sum)-1);step('remove','离开节点，撤销本层前缀。',n,{sum,result,depth});step('return','返回这棵子树中的路径数量。',n,{sum,result,depth});return result;}return visit(root,0,0);}),
236:lesson({...base,id:236,signature:'public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q)',sample:{root:[3,5,1,6,2,0,8,null,null,7,4],p:5,q:1},expected:3,javaSetup:'TreeNode root = LessonIO.tree(3,5,1,6,2,0,8,null,null,7,4); TreeNode p = LessonIO.find(root,5), q = LessonIO.find(root,1);',call:'new Solution().lowestCommonAncestor(root,p,q)',javaTransform:'LessonIO.nodeValue(__RESULT__)',description:'返回两个指定节点的最近公共祖先。节点可以是自己的祖先。演示用互异节点值指定 p、q，两节点都必须存在。',idea:'遇到 p 或 q 就向上返回该节点。左右都返回非空，说明目标分居两侧，当前节点就是最近公共祖先；否则继续向上传递找到的一侧。',invariant:'递归返回空、单个目标或已确定的公共祖先。',time:'O(n)',space:'O(h)'},`class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        if (root == null || root == p || root == q) return root; // @base
        TreeNode left = lowestCommonAncestor(root.left, p, q); // @left
        TreeNode right = lowestCommonAncestor(root.right, p, q); // @right
        if (left != null && right != null) return root; // @meet
        return left != null ? left : right; // @return
    }
}`, (input,emit)=>{const {root,nodes,show}=setup(input,emit);if(new Set(nodes.map(n=>n.val)).size!==nodes.length)throw Error('演示需要节点值互异');const p=nodes.find(n=>n.val===input.p),q=nodes.find(n=>n.val===input.q);if(!p||!q)throw Error('p、q 必须是树中存在的节点值');function visit(n,depth){const step=(key,note,extra={})=>show(key,note,{depth,...extra},[n,p,q],{current:n,p,q});step('base',!n?'空子树返回 null。':n===p||n===q?'找到目标节点，直接返回。':'当前不是目标，继续查找。');if(!n||n===p||n===q)return n;step('left','搜索左子树。');const left=visit(n.left,depth+1);step('right','搜索右子树。',{left:left?.val??null});const right=visit(n.right,depth+1);step('meet',left&&right?'两侧各找到目标，当前节点是公共祖先。':'目标没有分居当前节点两侧。',{left:left?.val??null,right:right?.val??null});if(left&&right)return n;const result=left||right;step('return','向上传递非空结果。',{result:result?.val??null});return result;}return visit(root,0)?.val??null;}),
124:lesson({...base,id:124,signature:'public int maxPathSum(TreeNode root)',sample:{root:[-10,9,20,null,null,15,7]},expected:42,call:'new Solution().maxPathSum(LessonIO.tree(-10,9,20,null,null,15,7))',description:'在非空二叉树中寻找节点值之和最大的简单路径。路径至少包含一个节点，可以从任意节点开始和结束。',idea:'负贡献可以丢弃。当前节点尝试用左右两侧组成完整路径更新 best；向父节点只能返回其中一侧，否则会发生分叉。best 从最小值开始，保证全负树仍能返回一个节点。',invariant:'gain 返回以当前节点为起点、可向父节点延伸的单侧最大贡献。',time:'O(n)',space:'O(h)'},`class Solution {
    private int best;
    public int maxPathSum(TreeNode root) {
        best = Integer.MIN_VALUE; // @init
        gain(root); // @start
        return best; // @answer
    }
    private int gain(TreeNode node) {
        if (node == null) return 0; // @empty
        int left = Math.max(0, gain(node.left)); // @left
        int right = Math.max(0, gain(node.right)); // @right
        best = Math.max(best, node.val + left + right); // @update
        return node.val + Math.max(left, right); // @return
    }
}`, (input,emit)=>{const {root,show}=setup(input,emit);if(!root)throw Error('最大路径和要求非空树');let best=-2147483648;show('init','从最小整数开始，保留全负树的正确答案。',{best},[root],{current:root});show('start','后序汇总可延伸的路径贡献。',{best},[root],{current:root});function gain(n,depth){show('empty',n?'计算当前节点贡献。':'空子树贡献为 0。',{best,depth},[n],{current:n});if(!n)return 0;show('left','取得左侧贡献，负数舍弃为 0。',{best,depth},[n],{current:n});const left=Math.max(0,gain(n.left,depth+1));show('right','取得右侧贡献，负数舍弃为 0。',{best,left,depth},[n],{current:n});const right=Math.max(0,gain(n.right,depth+1));best=Math.max(best,n.val+left+right);show('update','左右两侧与当前节点构成完整候选路径。',{best,left,right,candidate:n.val+left+right,depth},[n,n.left,n.right],{current:n});const result=n.val+Math.max(left,right);show('return','向父节点只返回较好的一侧。',{best,left,right,result,depth},[n],{current:n});return result;}gain(root,0);show('answer','返回全树最大路径和。',{best},[root],{root});return best;})
};
