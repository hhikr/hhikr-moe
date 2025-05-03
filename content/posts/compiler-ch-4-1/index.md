+++
date = '2025-05-03T11:28:42+08:00'
draft = false
title = 'Chapter 4-1 CFL & PDA'
summary = "编译原理笔记"
tags = ["笔记", "编译原理"]
categories = ["StudyBase"]
seriesOpened = true
series = ["笔记-编译原理"]
series_order = 4
+++

{{< katex >}}


## PART I: Context-Free Language

### CFG: Context Free Grammar

CFG 定义为一个一个一个四元组：\\(G = (N, T, S, P)\\)
1. \\(N\\): 非终结符 `non-terminal` 有限集
2. \\(T\\): 终结符 `terminal` 有限集。终结符和非终结符不重合。
3. \\(S\\): 作为起点的非终结符，\\(S \in N\\)
4. \\(P\\): production rules  $$A \to a$$ \\(A \in N\\), 是非终结符；\\(a \in (N \cup T)^*\\), 是某些终结符和非终结符的连接（或者单个符）

### CFG 的 Derivation: \\(\Rightarrow_G\\)

#### Intro
推导 (deviation) 是 CFG 的运算法则，用来从几个 production rules 推导到更多的 CFL.
- 推导方式：
    - Assumption: \\(A \to \gamma\\)
    - Deviation: \\(\alpha A \beta ~\Rightarrow_G ~\alpha \gamma \beta\\)（可以省略下标 G, 如果语境比较清晰）
    - 跳步骤、连续推导的符号：\\(\Rightarrow^*\\)
      {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309100640.png" title="400" >}}

这就是“上下文无关”的体现：assumption 所包含的性质不随这个单元的前面连接的东西 (\\(\alpha\\)) 或者后面连接的东西 (\\(\beta\\)) 的出现与否而改变

#### CFL: Context Free Language

$$
L(G) = \{w \in T^*:~S \Rightarrow^*w\}
$$

> CFL语言中的词是非终结符的集合，并且都能根据 CFG 的文法推导出来。

#### Left-Most Deviation \\(\Rightarrow_{lm}\\)
- 最左推导
- 每一步推导都只把左边的 non-terminal 换成 terminal
- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309101319.png" title="500" >}}


- 最右推导 \\(\Rightarrow_{rm}\\) 类似喵

### Parse Trees / Syntax Trees 语法树
- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309102414.png" title="" >}}
> 上文中，给定一个终结符串，用最左推导构成的语法树。

- 推导其实是建立语法树的过程。
- 语法树可以通过根据 production rules，从某个非终结符开始，进行一定顺序的推导（如最左/最右推导）构成
- 树中每个叶都是终结符，每个节点都是非终结符。

#### Ambiguity

- Ambiguity 描述了 CFG 的一种性质：如果 CFG 构成的 CGL 中的一个字符串可以有多个不同的语法树，那么这个 CFG 是有二义性的；如果 CFL 的所有字符串都有唯一树的与之对应，那这个 CFG 就没有二义性。
  {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309103137.png" title="" >}}

#### Inherent Ambiguity

1. 有些 CFL 只有 ambiguous 的语法，也就是说对于这些语言我们无法消除其二义性。
2. 并没有一个明确的算法来判定一个语法是否有二义性！
3. 并没有一个公式化的算法来消除所有能消除二义性的 CFL 的二义性！

#### (try to) Eliminating Ambiguity

有几个尝试消除其二义性的方法

##### 1. Priority&Associativity
提高某些运算符的优先级，先推导它们。
- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309105306.png" title="600" >}}

##### 2. 重写文法

比如 `if-else` 的二义性
- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309105559.png" title="600" >}}
- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309105625.png" title="400" >}}

#### Using Ambiguous Grammar (生肉)
- Given that we cannot always eliminate ambiguity, just use it!
- We will discuss how we use ambiguous grammar in the next Lecture when introducing specific parsing techniques

#### All regular languages are context-free languages.
{{< figure src="../../../_GeneralResources/Pasted%20image%2020250309110423.png" title="600" >}}

## PART II: Push-Down Automata

### Intro

[来，复习一下 CFL](Chapter%204-1%20CFL%20&%20PDA.md#CFL%20Context%20Free%20Language)

[来，复习一下Reg Lang和DFA/NFA的等价性](../Lexical%20Analysis-词法分析/Chapter%203-2%20Lexical%20Analysis.md#定义)

- Regular language = DFA/NFA
- Context-free language = PDA = \\(NFA + Stack (z0)\\)

AI: PDA（Pushdown Automata，下推自动机）是一种理论计算模型，它扩展了有限自动机（DFA/NFA）的能力，通过引入一个栈（stack）来存储和检索信息。这个名字中的“push-down”（下推）源于其核心操作：在处理输入符号时，PDA 可以将符号推入栈（push）或从栈中弹出符号（pop），从而实现对输入的动态记忆和回溯能力。这种栈结构使得 PDA 能够处理具有嵌套结构或递归性质的语言，例如括号匹配或嵌套的函数调用，而这些是有限自动机无法处理的。下推自动机是研究上下文无关语言（CFG）的重要工具，它在编译原理中用于语法分析阶段，帮助解析程序代码的结构，确保其符合语言的语法规则。
- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309111807.png" title="600" >}}

### 形式化定义：七元组
一个 NPDA/PDA 可以定义为以下形式

$$
P = (Q, \Sigma, \Gamma, \delta, q_0, z_0, F)
$$

- \\(Q\\) 状态的有限集
- \\(\Sigma\\) 输入字符串的字母表
- \\(\Gamma\\) 可以入栈出栈的字母表
- \\(\delta\\) trasition function
    -  \\(Q \times ( \Sigma \cup \{\epsilon\} )\times \Gamma \to 2^{Q \times\Gamma^*}\\)
    - 左边：输入的字符和入栈的字符；
    - 右边：到达的状态和目前在栈内的字符 (的连接)。Non-destiministic, 所以是幂集。
- \\(q_0\\) 初始状态
- \\(z_0\\) 栈内的初始字符 (stack start symbol)
- \\(F\\) final state 的集合，\\(F \subseteq Q\\)

### Instantaneous Description
Instantaneous Description 是对 PDA 在某个状态的描述：
$$
(q, w, \gamma)
$$
- \\(q\\): 当前状态
- \\(w\\): 剩余没有进入状态机的输入
- \\(\gamma\\): 栈中剩下的内容

针对一个转换函数：
$$(q, \alpha) \in \delta(p, a, X)$$
- \\(p\\) 是之前的状态，\\(q\\) 是转换函数之后的状态
- \\(X\\) 是要出栈的元素, \\(\alpha\\) 是入栈的函数
- \\(a\\) 是下一步的输入

我们有：
$$
(p, aw, X\beta) \vdash_M(q, w, \alpha\beta)
$$

### Language of PDA
PDA 既有入栈出栈，又有状态转移，因此有两种角度来定义 language, 并且可以证明二者其实等价。
#### Acceptance by final states
一个 string 能被 PDA 接受，如果
- 所有的输入都被消耗
- 最终可以停留在一个 final state
  PDA 定义的语言自然是这些 stirng 的集合：
  $$
  L(M) = \{w \in \Sigma^*: (q_0, w, z_0) \vdash^*_M (q_f, \epsilon, u),~~ q_f \in F, ~u \in \Gamma^*\}
  $$

#### Acceptance by empty stack
一个 string 能被 PDA 接受，如果
- 所有的输入都被消耗
- 最终栈是空的
  PDA 定义的语言自然是这些 stirng 的集合：
  $$
  L(M) = \{w \in \Sigma^*: (q_0, w, z_0) \vdash^*_M (\textcolor{red}{q}, \epsilon, \textcolor{red}{\epsilon}),~~ \textcolor{red}{q \in Q}\}
  $$

#### 等价？
如果一个语言可以通过某种 PDA 通过最终状态接受，那么也存在另一个 PDA 可以通过空栈接受相同的语言，反之亦然。
- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309123551.png" title="600" >}}
- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309123631.png" title="" >}}


## PART III: CFG = PDA

### 1. \\(CFG \subseteq PDA\\)

> 如何从 CFG 构造一个 PDA?

对于个 [CFG 四元组](#CFG%20Context%20Free%20Grammar)，我们可以构造一个等价的 [PDA 七元组](#形式化定义：七元组)；令这个 PDA：
$$
({q}, T, T \cup N, \delta, q, S, \varnothing)
$$
解析：
1. 只有一个状态，并且没有 final state. 也就是说这个 PDA 是 [Acceptance by empty stack](Chapter%204-1%20CFL%20&%20PDA.md#Acceptance%20by%20empty%20stack) 的；
2. 输入都是终结符，栈中的既可以是终结符也可以是非终结符；
3. 初始状态时栈中只有一个作为起点的非终结符。

> CFG 的规则如何向 PDA 的规则转化？

对一个目标是空栈的 PDA, 状态不要紧，我们只关注 PDA 栈的变化：从栈顶开始 peek,
1. 如果栈中遇到一个非终结符 \\(A\\)，就把他 pop 出来，再入栈 CFG 中的 production rules 规定的推导 \\(A \to \gamma\\) 中的 \\(\gamma\\):
   $$
   \delta(q, \epsilon, A) = \{(q, \beta): A \to \beta \in P\}
   $$
2. 如果遇到一个终结符 \\(a\\)，就直接把他**读取**并**弹出**:
   $$
   \delta(q, a, a)= \{(q, \epsilon)\}
   $$

### 2.  \\(PDA \subseteq CFG\\)

> 如何从一个（可能有点特殊的）PDA 构造 CFG?

我们还是只讨论 [Acceptance by empty stack](#Acceptance%20by%20empty%20stack) 的 PDA, 为了方便我们忽略最终状态。对任何一个 PDA, 写成 \\((Q, \Sigma, \Gamma, \delta, q_0, z_0, \varnothing)\\), 我们找到一个 CFG 写作
$$
CFG(N, \Sigma, P, S),~~~ N=\{S\} \cup \{N_{p X q}:p, q \in Q, X \in \Gamma\}
$$
解析：
1. 定义非终结符集合：非终结符不仅包括起点的 non-terminal, 还包含 PDA 中任意一个路径，即把这个路径连同起点终点构造成一个包含了其特征的非终结符，叫做 \\(N_{pXq}\\), 代表从 p 状态转移到 q 状态，弹出 \\(X\\).
2. 定义 production rules：
    1. 对于 PDA 任意一个状态 \\(q\\)，存在 rule: 初始的非终结符 \\(\to\\) 从 \\(q_0\\) 到 \\(q\\)、弹出 \\(z_0\\) 剩下空栈的路径
       $$
       \forall p \in Q: S \to N_{q_0 z_0 p} \in P
       $$
    2. 对于一个消耗输入 \\(a\\), 弹出 \\(X\\) 不压入任何字符的路径，存在 rule:
       $$
       (q, \epsilon) \in \delta(p, a, X) \Rightarrow N_{pXq}\to a \in P
       $$
    3. 对于一个消耗 \\(a\\), 弹出 \\(X\\) 并压入 \\(X_1X_2 \ldots X_k\\) 的路径，存在 rule:
       $$
       (q, X_1X_2\ldots X_k) \in \delta(p,a,X) \Rightarrow N_{pXp_k} \to aN_{qX_1p_1}N_{p_1X_2p_2}\ldots N_{p_{k-1}X_kp_k} \in P
       $$

例子：
- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309164507.png" title="1000" >}}

### DPDA: Deterministic PDA

在任何时刻，对于给定的输入符号或栈顶符号（这俩任意一个一样都不行），最多只有一个转移动作。

- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309164929.png" title="" >}}
- CFL 一定有 PDA, 但是不一定有 DPDA.
- DPDA 的语言是没有二义性的！

## PART IV: Properties of CFL

### CLosure Properties
给定两个 CFL \\(L_1\\) 和 \\(L_2\\)（对应的 CFG 起始非终结符分别是 \\(S_1\\) \\(S_2\\)）, 以下的语言也是 CFL：

1. \\(L_1 \cup L_2\\)
   {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309165419.png" title="" >}}
2. \\(L_1L_2\\)
   {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309165449.png" title="" >}}
3. \\(L^*_1\\)
   {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309165518.png" title="" >}}
4. \\(L_1^R\\)
   {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309165611.png" title="" >}}

### Intersection of CFL
1. \\(L_1 \cap L_2\\)
    - 证明：取 \\(L_1=\{a^nb^nc^m\},L_2=\{a^nb^mc^m\}\\)，则 \\(L_1 \cap L_2 = \{a^nb^nc^n\}\\), 这不显然不是 CFL?
2. \\(\overline{L_1}\\)
    - 证明：\\(L_1 \cap L_2 = \overline{\overline{L_1} \cup \overline{L_2}}\\) 如果非一定是 CFL, 那前面的交就一定是了。
3. \\(L_1-L_2\\)
    - 证明：\\(\overline{L_1} = \Sigma^* - L_1\\)

但是一个 CFL 和一个 RL 的交是 CFL: 构建一个模拟 CFL 的 NPDA、一个模拟 RL 的 DFA, 把他们交起来

### Application of the Properties

-  {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309171905.png" title="800" >}}
> 为什么 \\(a^nb^n\\) 是 CFL? 因为能把他构造成一个很基础的 PDA.

- {{< figure src="../../../_GeneralResources/Pasted%20image%2020250309172448.png" title="800" >}}

### Decidable Properties
CFG（上下文无关文法）的可判定性质（Decidable Properties）是指可以通过算法来确定其结果的性质。

#### 1. 给定一个 CFG, CFL 是否为空？
检查起始非终结符是否没有被使用，或者无效使用 \\(e.g.~S\to S\\)

#### 2. 给定一个 CFG, CFL 是否无限？
算法：
1. **移除无用的非终结符**：  
   无用的非终结符是指那些既不能推导出终结符字符串，也不能出现在任何可推导出终结符字符串的产生式中的非终结符。通过移除这些非终结符，可以简化文法，同时不影响其生成的语言。

2. **移除单元产生式和空产生式**：  
   单元产生式是指形如 \\(A \rightarrow B\\) 的产生式，其中 \\(A\\) 和 \\(B\\) 都是**单个**非终结符；空产生式是指形如 \\(A \rightarrow \epsilon\\) 的产生式。移除这些产生式可以进一步简化文法，同时便于后续分析。

3. **构建剩余非终结符的依赖图**：  
   依赖图是一个有向图，其中每个节点代表一个非终结符，边 \\(A \rightarrow B\\) 表示在某个产生式中，非终结符 \\(A\\) 可以直接或间接推导出非终结符 \\(B\\)。通过构建依赖图，可以直观地表示非终结符之间的推导关系。

4. **检查依赖图中是否存在环**：  
   如果依赖图中存在环，说明存在至少一个非终结符可以通过自身或一系列非终结符的推导最终回到自身。这种循环结构表明文法可以无限地生成字符串，因此生成的语言是无限的。如果没有环，则生成的语言是有限的。

通过上述步骤，可以判断一个 CFG 生成的语言是否是无限的。

#### 3. 给定一个 CFG, 某个字符串是否属于其 CFL?
- 算法 1：构造 NPDA, 看看 NPDA 能否接受这个 String
- 算法 2：[the CYK algorithm (O (n3))](https://en.wikipedia.org/wiki/CYK_algorithm)


### Undecidable Properties
- CFG 是否有二义性
- CFG 是否有[不可避免的二义性](Chapter%204-1%20CFL%20&%20PDA.md#Inherent%20Ambiguity)
- 两个 CFG 的交是否为空
- 两个 CFG 是否等价
- 某个 CFG 是否可以等价为 \\(\Sigma^*\\)

## PART V: Pumping Lemma for CFL

### Chomsky Normal Form

一种 CFG 的标准形式。如果 CFG 的所有 production rule 都是如下形式：
1. \\(A \to BC\\)
2. \\(A \to a\\)
3. \\(S\to\epsilon\\)
   其中 \\(a\\) 是终结符，\\(ABC\\) 是非终结符，\\(S\\) 是起始非终结符
   那么这个 CFG 就是 CNF.

### 语法树是一个二叉树。

### 上下文无关语言的泵引理

**定义**：
泵引理可以用于证明一个语言不是上下文无关语言（CFL）。它指出，如果一个语言是上下文无关的，那么所有足够长的字符串都必须满足某些“可泵性”条件。

**泵引理的陈述**：
设 \\(L\\) 是一个上下文无关语言（CFL）。则存在一个常数 \\(p\\)（称为泵长度），使得对于任何字符串 \\(s \in L\\)，只要 \\(|s| \geq p\\)，就可以将 \\(s\\) 分解为 \\(s = uvwxy\\)，满足以下条件：
1. \\(|vx| \geq 1\\)（即 \\(v\\) 和 \\(x\\) 至少有一个非空）
2. \\(|vwx| \leq p\\)（即 \\(vwx\\) 的长度不超过 \\(p\\)）
3. 对于所有 \\(i \geq 0\\)，字符串 \\(uv^iwx^iy\\) 仍然属于 \\(L\\)。

**解释**：
- **条件 1**：确保至少有一个部分可以被“泵”（即重复）。
- **条件 2**：限制“可泵部分”的长度，使其在某个局部范围内。
- **条件 3**：无论“泵”的次数多少，生成的字符串仍然属于语言 \\(L\\)。

**应用**：
泵引理主要用于证明某个语言不是上下文无关的。如果一个语言违反了泵引理的条件，则该语言不是上下文无关语言。

**示例**：
假设 \\(L = \{a^n b^n c^n \mid n \geq 1\}\\)。假设 \\(L\\) 是上下文无关的，那么存在一个泵长度 \\(p\\)。选择字符串 \\(s = a^p b^p c^p\\)，根据泵引理，\\(s\\) 可以被分解为 \\(uvwxy\\)，满足上述条件。然而，无论怎样分解，都无法保证 \\(uv^iwx^iy\\) 仍然属于 \\(L\\)（因为 \\(a\\)、\\(b\\) 和 \\(c\\) 的数量必须严格相等）。因此，\\(L\\) 不是上下文无关语言。

**注意**：
- 泵引理只能用来证明一个语言**不是**上下文无关的，不能用来证明一个语言是上下文无关的。
- 对于某些语言，可能需要尝试多个字符串才能找到违反泵引理的反例。