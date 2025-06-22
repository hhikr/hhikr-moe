+++
date = '2025-06-04T10:57:44+08:00'
draft = true
title = '编译原理复习指北'
summary = "根据课程PPT和最后一节课的重点梳理进行的简单的复习指北。"
tags = ["笔记", "编译原理"]
categories = ["StudyBase"]
seriesOpened = true
series = ["笔记-编译原理"]
series_order = -1
+++

{{< katex >}} 

考试结构：六道大题。

### 前端

词法分析，语法分析，中间代码生成

#### 必考：regex->NFA->DFA->minDFA

regular language是用NFA定义的。regex只是用来描述regular language的。

但是定义的时候从regex开始然后是正则语言，然后是NFA，然后是DFA，然后是minDFA。

#### CFG

了解CFG语法（开卷）；把正则表达式转换为CFG。

#### PARSER

消除左递归：用中间变量替换。

LL(1) 文法：从左到右扫描；最左推导；每次预测一个token。

考试一般不需要把分析表画出来，但是可能会要根据题目给的语法，用公式填写FIRST和FOLLOW。

#### ir gen: 写三地址码

三地址码索引不需要乘数据占bit大小，目标代码生成的时候才乘。

SSA：两个特点一个好处（提供非常精确的控制流信息）

#### 支配关系

定义：支配，后支配，严格支配，立即支配……不要想着到时候翻资料。

支配前沿：dominance frontier。构建SSA非常关键的部分。迭代的支配前沿可以构建SSA，考试也许不会搞这么复杂，但是一定会给出代码让你写出SSA.

### 中端

#### 数据流分析

基本概念一定要清楚。in/out一定成立的dataflow facts 数据流方程：传递函数，合并函数

流敏感：每一个程序点的结果能够被得知

worklist算法

最基本的分析：reaching definition, available expression, live variables （有可能要写概念，能产生什么样的结果etc）一定要会

#### 符号执行

要记得什么是path/flow/context sensitivity


- **Path sensitivity（路径敏感性）**：分析时区分程序中不同执行路径上的状态和信息。
- **Flow sensitivity（流敏感性）**：分析时考虑程序语句的执行顺序，跟踪变量随控制流的变化。
- **Context sensitivity（上下文敏感性）**：分析时区分函数在不同调用上下文中的行为和状态。


路径敏感遇到的问题：path explosion/constraint solving/external function call

最容易考到的还是数学部分，求解path constraints。命题逻辑->SAT->DPLL->Tseitin，一阶逻辑->SMT

#### Pointer Analysis

两个分析最基本的区别：两个constraint长什么样子，要回求解（动态的传递闭包）

#### Datalog Analysis

最重要的还是Reaching Definition

Reaching Definitions by Datalog

### 后端

#### 指令选择

没太多内容，给你一个三地址，把对应伪汇编码写出来。注意地址的计算、寻址模式等，千万别写错了；以及上文提到的，要乘数据占bit大小。

#### 寄存器分配

寄存器大于内存。物理寄存器有限。
为什么需要寄存器分配？真可能考这种送分的，别不要。

两种算法：local(JIT c1) global（JIT c2）

MAXLIVE, k怎么计算，以及具体的寄存器分配算法

#### 指令调度
硬件角度：可以更好利用处理器的并行性 软件角度：重排指令，让更高并行度的指令放在靠近的位置，方便硬件执行
送分：为什么需要指令调度，软硬件两方面回答

局部、全局，全局涉及代码移动不会考，只会考基本块内部的调度

