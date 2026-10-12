import java.util.*;

class ListNode {
    public int val;
    public ListNode next;
    public ListNode(int val) { this.val = val; }
    public ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class TreeNode {
    public int val;
    public TreeNode left, right;
    public TreeNode(int val) { this.val = val; }
    public TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}

class Node {
    public int val;
    public Node next, random;
    public Node(int val) { this.val = val; }
}

public class LessonIO {
    public static ListNode list(int... values) {
        ListNode dummy = new ListNode(0), tail = dummy;
        for (int value : values) { tail.next = new ListNode(value); tail = tail.next; }
        return dummy.next;
    }
    public static ListNode prepend(int[] values, ListNode tail) {
        for (int i = values.length - 1; i >= 0; i--) tail = new ListNode(values[i], tail);
        return tail;
    }
    public static ListNode cycle(ListNode head, int position) {
        if (position < 0 || head == null) return head;
        ListNode target = head, tail = head;
        for (int i = 0; i < position; i++) target = target.next;
        while (tail.next != null) tail = tail.next;
        tail.next = target;
        return head;
    }
    public static Integer nodeValue(ListNode node) { return node == null ? null : node.val; }
    public static Integer nodeValue(TreeNode node) { return node == null ? null : node.val; }
    public static Object treeValues(TreeNode root) { return root == null ? Collections.emptyList() : normalized(root); }
    public static Object listValues(ListNode head) { return head == null ? Collections.emptyList() : normalized(head); }
    public static Object randomValues(Node head) { return head == null ? Collections.emptyList() : normalized(head); }
    public static List<Integer> rightValues(TreeNode root) { List<Integer> values = new ArrayList<>(); while (root != null) { values.add(root.val); root = root.right; } return values; }
    public static TreeNode tree(Integer... values) {
        if (values.length == 0 || values[0] == null) return null;
        TreeNode root = new TreeNode(values[0]);
        Deque<TreeNode> queue = new ArrayDeque<>(); queue.add(root);
        int i = 1;
        while (!queue.isEmpty() && i < values.length) {
            TreeNode node = queue.remove();
            if (values[i] != null) { node.left = new TreeNode(values[i]); queue.add(node.left); } i++;
            if (i < values.length && values[i] != null) { node.right = new TreeNode(values[i]); queue.add(node.right); } i++;
        }
        return root;
    }
    public static TreeNode find(TreeNode root, int value) {
        if (root == null || root.val == value) return root;
        TreeNode left = find(root.left, value);
        return left != null ? left : find(root.right, value);
    }
    public static Node randomList(int[][] values) {
        Node[] nodes = new Node[values.length];
        for (int i = 0; i < nodes.length; i++) nodes[i] = new Node(values[i][0]);
        for (int i = 0; i < nodes.length; i++) {
            nodes[i].next = i + 1 < nodes.length ? nodes[i + 1] : null;
            nodes[i].random = values[i][1] < 0 ? null : nodes[values[i][1]];
        }
        return nodes.length == 0 ? null : nodes[0];
    }
    public static Object normalized(Object x) {
        if (x instanceof ListNode node) {
            List<Integer> values = new ArrayList<>(); Set<ListNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
            while (node != null) { if (!seen.add(node)) throw new IllegalStateException("结果链表存在环"); values.add(node.val); node = node.next; }
            return values;
        }
        if (x instanceof TreeNode root) {
            List<Integer> values = new ArrayList<>(); List<TreeNode> queue = new ArrayList<>(); queue.add(root);
            Set<TreeNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
            for (int i = 0; i < queue.size(); i++) {
                TreeNode node = queue.get(i);
                if (node == null) values.add(null);
                else { if (!seen.add(node)) throw new IllegalStateException("结果树包含重复引用"); values.add(node.val); queue.add(node.left); queue.add(node.right); }
            }
            while (!values.isEmpty() && values.get(values.size()-1) == null) values.remove(values.size()-1);
            return values;
        }
        if (x instanceof Node head) {
            List<Node> nodes = new ArrayList<>(); for (Node node = head; node != null; node = node.next) { if (nodes.contains(node)) throw new IllegalStateException("结果链表存在环"); nodes.add(node); }
            List<List<Integer>> values = new ArrayList<>(); for (Node node : nodes) values.add(Arrays.asList(node.val, node.random == null ? null : nodes.indexOf(node.random)));
            return values;
        }
        return x;
    }
    public static String format(Object x) {
        x = normalized(x);
        if (x == null) return "null";
        if (x instanceof String || x instanceof Character) return "\"" + x.toString().replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\"";
        List<String> parts = new ArrayList<>();
        if (x.getClass().isArray()) {
            for (int i = 0; i < java.lang.reflect.Array.getLength(x); i++) parts.add(format(java.lang.reflect.Array.get(x, i)));
            return "[" + String.join(",", parts) + "]";
        }
        if (x instanceof Iterable<?> iterable) { for (Object value : iterable) parts.add(format(value)); return "[" + String.join(",", parts) + "]"; }
        return x.toString();
    }
}
