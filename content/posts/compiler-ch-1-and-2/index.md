+++
date = '2025-05-03T10:42:33+08:00'
draft = false
title = 'Chapter 1&2 Intro to Compilers&Tools'
summary = "编译原理笔记：了解编译器设计的大致流程，和构建编译器的相关工具"
tags = ["笔记", "编译原理", "概述"]
categories = ["StudyBase"]
seriesOpened = true
series = ["编译原理笔记"]
series_order = 1
+++

# Part I Compilers

## 一、基本了解：Compiler, Interpreter 和 Linker

### 什么是 Compiler？

- 编译器的作用就是将[源语言](shattered.md#源语言)转换为[目标语言](shattered.md#目标语言)，以便计算机能够执行。
  {{< figure src="../../_GeneralResources/Pasted%20image%2020250302205843.png" title="600" >}}
- 一些编译器（称作 `transpiler`）还尝试把源语言转换成另一种目标语言，比如热门的 ` C->Rust `

### 什么是 Interpreter?

- 逐条读取源代码，并一条条的翻译成机器语言并执行。
- 不会生成独立的目标代码，每次执行都要从头翻译，这个意义上，效率比编译器低
- 一个特殊的变体：[Java](shattered.md#Java%20is%20special%20compiler%20+%20interpreter%20+%20just-in-time%20compiler%20(`JLT`))

### 什么是 Linker?

- 将多个文件（Compilation units 说是）组合成一个文件——可执行文件或者库
  编译与链接的流程：
    - {{< figure src="../../_GeneralResources/Pasted%20image%2020250302211726.png" title="" >}}
    - 其中，
        - `-O1` 中的 `-O` 是[编译优化选项](shattered.md#编译优化选项)；
        - `-l` 是[链接选项](shattered.md#链接选项)。

## 二、编译器的具体编译流程

{{< figure src="../../_GeneralResources/Pasted%20image%2020250302212657.png" title="title" >}}

> IR 指的是[中间表示](shattered.md#中间表示) (intermediate representation)

- 前端：读取文件信息（词法语法语义）；将代码转化成 IR
- 中端：“从 IR 到 IR”, 是 machine-independent optimization
- 后端：也有machine-independent optimization，还有最终目标代码的生成

### Front End

#### Lexical analysis

词法分析

-  {{< figure src="../../_GeneralResources/Pasted%20image%2020250302215544.png" title="900" >}}
-  {{< figure src="../../_GeneralResources/Pasted%20image%2020250302215521.png" title="900" >}}

> Find `lexemes` according to `patterns`, and create `tokens`

将文件中的字符（根据预订的 `pattern`）分割成一个个语素 `Lexeme`, 创造一个个 `token`

- Lexeme: 人类理解的一个字符串
- Pattern: 表征字符串的性质，通常是 regex. 如果没有 pattern 匹配到文件中的某个内容，就产生 `Lexical Errors`
- Token: 词法分析中的输出，源代码的基本单元：
  `Token=<token-class, attribute>`
  如 `INTEGER, 42`, `L_PAREN, (`

#### Syntax Analysis

语法分析

- {{< figure src="../../_GeneralResources/Pasted%20image%2020250302215913.png" title="" >}}

> Create the (abstract) syntax tree (**AST**)

创建语法树。

Symbol table, symbol tree…

#### Semantic Analysis

语义分析

- {{< figure src="../../_GeneralResources/Pasted%20image%2020250302220338.png" title="" >}}

1. 主要任务是检查程序的语义是否正确，即使程序通过了语法分析，也不一定意味着它是有效的。例如：
    - 检查变量是否已**声明**。
    - 检查**类型**是否匹配。
    - 检查**操作符**是否适用于操作数。
2. 添加语义信息：语义分析会为抽象语法树（AST）的每个节点**添加语义信息**，这些信息通常包括：
    - 类型信息：变量、表达式和函数的类型。
    - 作用域信息：变量和函数的作用域。
    - 符号表信息：符号表中存储的变量和函数的定义。

#### IR Generation

根据 [AST](Chapter%201&2%20Intro%20to%20Compilers&Tools.md#Syntax%20Analysis) 生成 IR, 如三地址码

-  {{< figure src="../../_GeneralResources/Pasted%20image%2020250302220745.png" title="700" >}}
- {{< figure src="../../_GeneralResources/Pasted%20image%2020250302220753.png" title="700" >}}
- {{< figure src="../../_GeneralResources/Pasted%20image%2020250302220825.png" title="700" >}}

### Middle End

中端针对 IR, 提供了和机器无关的优化. IR 相对源码，提供了更易处理的标准形式；相对目标码，提供了其机器无关的上层抽象。（机器无关：和硬件处理和指令集差异无关，任何 ISA 通用）

### Back End

> Translate IR to machine code
> (Meanwhile) Perform machine-dependent optimization

- Instruction Selection
    - 不同格式风格的指令各有优劣。
    - {{< figure src="../../_GeneralResources/Pasted%20image%2020250302221800.png" title="" >}}
- Register Allocation
    - 寄存器比内存快得多，但是个数有限，所以分配寄存器要有一定的优化策略，~~这不是乱搞的~~
- Instruction Scheduling (指令调度)
    - 目标机器通常提供支持**指令级并行**（Instruction-Level Parallelism, ILP）的硬件资源，如多**个执行单元、超标量架构或多发射处理器**。指令调度的目标是生成能够**充分利用**这些并行资源的机器代码，从而提高程序的执行效率。

# Part || Tools

看你的 PPT 去,,

## Programming languages

{{< figure src="../../_GeneralResources/Pasted%20image%2020250303212704.png" title="500" >}}

### 函数式编程（Functional Programming）

1. 定义
    - 函数式编程仅包含函数，**不改变状态或数据**。每个函数都是独立的，**不依赖于外部状态**。
    - 也就是说，不存在全局变量了。

2. 函数式编程的核心是通过**组合和应用函数来解决问题**。

3. 函数可以作为参数传递，也可以返回新的函数。


以下是关于**逻辑编程（Logic Programming）**的笔记，结合了你提供的例子：

---

### 逻辑编程（Logic Programming）

#### 1. 定义
逻辑编程是一种基于数学逻辑的编程范式，通过声明事实（Facts）和规则（Rules）来描述问题，而不是直接指定解决问题的步骤。

#### 2. 核心概念
- 事实（Facts）：表示已知的、不可改变的陈述。
- 规则（Rules）：表示基于事实推导出新结论的逻辑关系。
- 查询（Queries）：通过逻辑推理引擎验证或推导出新的事实。

#### 3. 示例
以下是一个逻辑编程的简单示例，使用了事实、规则和查询：

##### 事实（Facts）
```prolog
rainy("Nanjing").
rainy("Beijing").
cold("Beijing").
```
> 声明了两个城市（南京和北京）的天气情况。`rainy("Nanjing")` 表示南京是多雨的，`rainy("Beijing")` 和 `cold("Beijing")` 表示北京是多雨且寒冷的。

##### 规则（Rules）
```prolog
snowy(C) :- rainy(C), cold(C).
```
> 规则表示如果一个城市既多雨又寒冷，那么它就是下雪的。`snowy(C)` 是结论，`rainy(C)` 和 `cold(C)` 是前提条件。

##### 查询（Queries）
```prolog
?- snowy(X).
```
> 查询所有满足 `snowy` 条件的城市。逻辑引擎会根据事实和规则进行推理，输出符合条件的城市。

#### 特点
- 逻辑编程是**声明式**的，程序员只需要声明事实和规则，而不需要指定具体的执行步骤。
- 逻辑引擎会**自动进行推理**，根据事实和规则推导出新的结论。
- 逻辑编程适合解决复杂的逻辑问题，如推理、规划和知识表示。

以下是关于**类型系统（Type Systems）**的笔记，严格按照要求格式化：

## `Type Systems` 类型系统

### `Static Typing` /  `Dynamic Typing`
- 静态类型: 在编译时获取类型信息。
  例如 Java 中，
  ```Java
String str = "Hello"; // 被静态存储
str = 5; // 报错，因为str类型已经被staticcally(编译时)确定
  ```
- 动态类型: 在运行时获取类型信息。
  Python 中，
  ```python
str = "Hello" # 此时是string
str = 5       # 变成整型，不会报错
  ```

### `Strong Typing` /  `Weak Typing`
- 强类型: 类型区分严格，不允许隐式类型转换。
  Python 中，
  ```python
str = 5 + "hello" #报错，python其实是强类型
  ```
  注意 py 是动态类型，编写时不要显示标注类型，但*不是弱类型*！
- 弱类型: 类型区分较宽松，允许隐式类型转换。
  Php:
  ```php
$str = 5 + "hello" # string 在php中被隐式cast成0,所以结果是0
  ```

## Scoping 作用域


### Static Scoping（静态作用域）
根据程序的**源代码结构**来确定变量的作用域
- 变量的作用域在编译时确定，与程序的结构（如函数嵌套）相关。
- 函数中引用的变量在定义时就绑定到其最近的外部作用域。
- 便于代码理解和优化，现代语言（如 C、Python、JavaScript 等）大多采用静态作用域。

### Dynamic Scoping（动态作用域）
根据程序的 **运行时状态（调用栈）** 来确定变量的作用域。
- 变量的作用域在运行时确定，与函数调用顺序相关。
- 函数中引用的变量绑定到最近的调用环境中的变量。
- 更灵活，但难以理解和优化，主要用于某些脚本语言（如 Emacs Lisp）。

## Function Invocation

{{< figure src="../../_GeneralResources/Pasted%20image%2020250303220234.png" title="500" >}}

## Virtual Functions 虚函数


- 虚函数是在基类中声明的成员函数，可以被派生类重新定义 `override`。
- 虚函数允许实现多态（Polymorphism），即通过基类指针或引用调用函数时，会调用实际对象的版本。
- 虚函数必须是`non-private`、`non-static`且`non-final`。
- 在 Java 中，任何非私有、非静态且非 `final` 的方法**都是**虚函数，可以被 overridden.

### 示例代码
```java
1. void add(List<Integer> list, Integer y) {
2.     list.add(y); // 调用的是ArrayList.add()还是LinkedList.add()？
3. }
```

- 在上述代码中，`List` 是一个接口，`ArrayList` 和 `LinkedList` 是其实现类。
- 调用 `list.add(y)` 时，实际调用的方法取决于 `list` 的运行时类型（即实际对象的类型），而不是其声明类型。这是虚函数（多态）的典型行为。