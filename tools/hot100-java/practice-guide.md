# Java 练习的输入输出

每道题的初始程序包含 `Solution` 方法和 `Main` 示例调用。实现算法后，可以编译运行，或比对本题原始示例。练习需要连接包含 `javac` 的本机 JDK。

## 使用题目的方法签名

保留初始代码中的方法签名，用自己的算法替换 `UnsupportedOperationException`。`Main` 已提供示例参数及输出转换；直接点击“运行并比对本题示例”即可检查输出。

例如，反转链表的方法接收 `ListNode`，返回反转后的头节点。示例调用把数组值构造成链表，再把返回的节点转换为可读输出：

```java
ListNode head = LessonIO.list(1, 2, 3, 4, 5);
ListNode reversed = new Solution().reverseList(head);
System.out.println(LessonIO.format(LessonIO.listValues(reversed)));
```

正确输出为 `[5,4,3,2,1]`。方法式练习的参数来自 `Main`，无需填写标准输入。修改 `Main` 的参数后，点击“编译并运行”检查新结果；示例比对按钮仍以本题原始示例为目标。

## 读取标准输入

需要练习控制台输入时，可以把编辑器内容替换为完整 `Main` 程序，并在“标准输入 stdin”中填写数据。例如，以下程序读取两个整数并输出它们的和：

```java
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int a = scanner.nextInt();
        int b = scanner.nextInt();
        System.out.println(a + b);
    }
}
```

标准输入填写 `3 4`，点击“编译并运行”，输出应为 `7`。空格和换行都可分隔 `nextInt()` 读取的整数。当前运行接口一次提交全部标准输入，不提供程序运行期间的交互式输入。

## 构造链表和树

练习环境提供 `ListNode`、`TreeNode`、随机链表的 `Node` 及 `LessonIO`，无需重复声明这些类。

| 数据 | 构造方式 | 输出方式 |
| --- | --- | --- |
| 单链表 | `LessonIO.list(1, 2, 3)` | `LessonIO.format(LessonIO.listValues(head))` |
| 二叉树 | `LessonIO.tree(1, null, 2, 3)` | `LessonIO.format(LessonIO.treeValues(root))` |
| 随机链表 | `LessonIO.randomList(new int[][]{{7,-1},{13,0}})` | `LessonIO.format(LessonIO.randomValues(head))` |
| 数组、集合及标量 | 使用 Java 类型直接构造 | `LessonIO.format(value)` |

树按层序构造，`null` 表示缺少节点。随机链表每行是节点值及 `random` 目标下标，`-1` 表示没有目标。环形链表、相交链表及对象操作题使用各自初始程序中的构造方式。

## 阅读运行结果

“运行并比对本题示例”要求标准输出包含一个结果值。保留初始程序的 `LessonIO.format` 调用，可以统一输出数组、节点结构、字符串和数值；额外的调试输出会影响示例比对。题目允许不同排列时，比对会按该题的规则处理输出顺序。

“本题示例通过”只证明当前程序通过给定示例。动画中的自定义输入不会自动替换练习程序的参数；需要测试其他输入时，修改 `Main` 或标准输入，并自行核对结果。

编译错误会显示 `Main.java` 的行号，编辑器可定位到错误行。程序运行最多 5 秒，输出最多 64 KB。草稿按题目保存在当前浏览器；载入参考解法或恢复初始代码后，可用“撤销代码替换”取回上一份草稿。
