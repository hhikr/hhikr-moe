+++
date = '2025-05-12T16:53:00+08:00'
draft = true
title = '编译原理Lab笔记'
summary = "编译原理笔记"
tags = ["笔记", "编译原理"]
categories = ["StudyBase"]
seriesOpened = true
series = ["笔记-编译原理"]
series_order = -1
+++

{{< katex >}} 

## Lab5: 线性扫描寄存器分配算法

### terminology

- `Live Interval`: 存活区间，指的是一个变量从被定义到作用域结束的行数的区间。本次实验，一个变量的存活区间是`[M, N]`，$M$是变量第一次出现的地方，$N$是变量最后一次出现的地方，这和定义不同，但是勉强能用

- `startpoint\endpoint`对于存活区间`[M, N]`，$M$称为`startpoint`，$N$称为`endpoint`

- `Spill`：寄存器溢出，指的是所有通用寄存器都被占用了。

### 算法伪代码与解析

```pseudo
active ← {} // 当前占用寄存器的存活区间集合 (按 endpoint 排序)

foreach LiveInterval i:      // (按 startpoint 从小到大遍历)
    ExpireOldIntervals(i)    // 释放已结束的区间占用的寄存器
    if length(active) == R:  // 如果所有寄存器已用完
        SpillAtInterval(i)   // 执行溢出
    else:
        register[i] ← 从空闲寄存器池分配一个寄存器
        将 i 加入 active，并按 endpoint 排序

// 辅助函数: 释放已结束的区间
function ExpireOldIntervals(i):
    foreach j ∈ active (按 endpoint 从小到大遍历):
        if endpoint[j] ≥ startpoint[i]:
            return  // j 仍然存活，不能释放
        从 active 移除 j
        将 register[j] 放回空闲寄存器池

// 辅助函数: 处理溢出
function SpillAtInterval(i):
    spill ← active 中最后一个区间 (即 endpoint 最大的)
    if endpoint[spill] > endpoint[i]:
        // 被使用的寄存器中，最后存活的变量比当前变量活得久
        // 让 i 占用 spill 的寄存器, spill 被溢出到内存
        register[i] ← register[spill]
        location[spill] ← 分配新的栈空间
        从 active 移除 spill
        将 i 加入 active
    else: 
        // 直接溢出 i, 不占用寄存器
        location[i] ← 分配新的栈空间
```

## Lab6: 常量传播相关算法

常量传播（Constant Propagation）是一种经典的数据流分析技术，用于在编译时发现变量在程序执行过程中是否始终保持某个常量值，并将相关表达式替换为该常量，从而优化代码。

在常量传播的数据流分析中，“前驱”指的是在控制流图（CFG, Control Flow Graph）中，某个基本块B的所有直接前面可以到达B的基本块。也就是说，如果程序的执行路径可以从基本块A直接跳转到基本块B，那么A就是B的前驱。

`in[B]`和`out[B]`是用来记录每个基本块 B 在数据流分析过程中的变量信息的结构。`in[B]`表示在进入基本块B之前，各个变量的状态（比如是常量、NAC还是UNDEF）；`out[B]`表示在执行完B之后，各个变量的状态。这两个数据结构通常是“映射”或“字典”，键是变量名，值是该变量的状态。比如，`in[B][x] = 5` 表示变量 x 在进入 B 之前是常量 5，`out[B][y] = NAC` 表示变量 y 在 B 之后不是常量。

如果你还想了解worklist算法的具体流程或例子，也可以继续问！

### 数据流值的含义

- `UNDEF`：表示变量未初始化，尚未赋值。
- `CONST(c)`：表示变量的值是常量c。
- `NAC`（Not a Constant）：表示变量不是常量，或者在不同路径上取不同值，无法确定为单一常量。

### 算法整体流程

```pseudo
Initialize:
  for all blocks B:
    in[B] ← UNDEF
    out[B] ← UNDEF
  worklist ← all blocks

While worklist not empty:
  B ← remove from worklist
  old_out ← out[B]

  in[B] ← meet{ out[P] | P ∈ predecessors[B] }
  out[B] ← transfer(B, in[B])

  if out[B] != old_out:
    add all successors of B to worklist
```

1. 初始化`Initialize`：对每个基本块B，`in[B]`和`out[B]`都初始化为UNDEF。将所有基本块加入工作队列`worklist`。
2. 主循环：只要`worklist`不为空，就不断取出一个基本块B进行处理：
   - 保存当前`out[B]`为`old_out`。
   - 计算`in[B]`，它是所有B前驱块P的`out[P]`的`meet`结果。
   - 用`transfer`函数根据`in[B]`和B内的语句，计算新的`out[B]`。
   - 如果`out[B]`发生变化，则将B的所有后继块加入worklist，等待后续处理。

#### `meet`函数

`meet`操作则发生在有多个前驱的基本块。因为一个基本块可能有多个不同的执行路径到达，所以它的`in[B]`需要综合所有前驱的out信息。meet的作用就是把所有前驱的out合并起来，得到`in[B]`。

```pseudo
function meet(x, y):
  if x == y: return x
  if x == UNDEF: return y
  if y == UNDEF: return x
  return NAC
```

`meet`函数用于合并多个前驱块的常量信息：

- 如果两个值相等，返回该值。
- 如果有一个是UNDEF，返回另一个。
- 如果两者都不是UNDEF且不相等，说明变量在不同路径上取不同值，返回NAC。

#### `transfer`函数

`transfer`函数的作用是模拟基本块内部语句的执行过程。它根据`in[B]`（即进入基本块时变量的状态），顺序处理B中的每条语句，推导出`out[B]`（即离开基本块时变量的状态）。`transfer`的本质是“**状态转移**”，它描述了变量在基本块内部如何变化。每次`transfer`的结果会更新`out[B]`，如果`out[B]`发生变化，说明有新的信息需要传播到后续的基本块。

```pseudo
function transfer(B, in_vals):
  vals ← copy of in_vals
  for stmt in B:
    match stmt:
      case v = n:
        vals[v] ← vals[n]

      case v = x op y:
        vx ← vals[x]
        vy ← vals[y]

        if vx and vy are both const:
          vals[v] ← evaluate(vx op vy)
        else if vx == NAC or vy == NAC:
          vals[v] ← NAC
        else:
          vals[v] ← UNDEF
        
      case ...
  return vals
```

`transfer`函数根据基本块的输入常量信息和块内的每条语句，更新变量的常量状态：

- 对于赋值语句`v = n`，将n的常量信息赋给v。
- 对于二元运算`v = x op y`，如果x和y都是常量，则直接计算结果并赋给v；如果有任一为NAC，则v为NAC；否则v为UNDEF。
- 其他语句类型可按类似方式处理。
