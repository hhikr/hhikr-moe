+++
date = '2025-05-12T16:53:00+08:00'
draft = false
title = '编译原理Lab笔记'
summary = "编译原理笔记"
tags = ["笔记", "编译原理"]
categories = ["StudyBase"]
seriesOpened = true
series = ["笔记-编译原理"]
series_order = -1
+++

{{< katex >}} 

## 线性扫描寄存器分配算法

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
