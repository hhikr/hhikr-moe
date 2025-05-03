+++
date = '2025-05-03T15:40:24+08:00'
draft = false
title = '第3章：SQL——关系数据库标准语言'
summary = "数据库笔记"
tags = ["笔记", "数据管理基础"]
categories = ["StudyBase"]
seriesOpened = true
series = ["笔记-数据库"]
series_order = 3
+++

{{< katex >}} 


### 修改基本表的语法
```
ALTER TABLE <表名>
[ ADD[COLUMN] <新列名> <数据类型> [完整性约束] ]
[ ADD <表级完整性约束> ]
[ DROP [COLUMN] <列名> [CASCADE | RESTRICT] ]
[ DROP CONSTRAINT <完整性约束名> [RESTRICT | CASCADE] ]
[ ALTER COLUMN <列名> <数据类型> ];
```

### 各部分解释
- `<表名>`：要修改的基本表的名称。
- `ADD[COLUMN] <新列名> <数据类型> [列级完整性约束]`：用于向表中添加一个新列，可以同时指定该列的数据类型和完整性约束条件。
- `ADD <表级完整性约束>`：用于向表中添加新的表级完整性约束条件，例如主键、外键、唯一性约束等。
- `DROP [COLUMN] <列名> [CASCADE | RESTRICT]`：用于删除表中的列。
    - `CASCADE`：如果该列被其他对象（如外键、视图等）引用，则自动删除这些依赖对象。
    - `RESTRICT`：如果该列被其他对象引用，则拒绝删除该列。
- `DROP CONSTRAINT` 子句：

    - `DROP CONSTRAINT <完整性约束名> [RESTRICT | CASCADE]`：用于删除表中指定的完整性约束条件。
        - `RESTRICT`：如果该约束被其他对象依赖，则拒绝删除。
        - `CASCADE`：自动删除依赖该约束的所有相关对象。
- `ALTER COLUMN` 子句：
    - `ALTER COLUMN <列名> <数据类型>`：用于修改表中已有列的定义，包括数据类型等。注意，某些数据库系统可能不支持直接修改列名。

### 示例解释
#### 示例 3.8：向`Student`表增加“入学时间”列
`ALTER TABLE Student ADD S_entrance DATE;`
- 解释：向`Student`表中添加一个名为`S_entrance`的新列，数据类型为`DATE`（日期型）。
- 注意：不管表中是否已有数据，新增的列默认值为空值。

#### 示例 3.9：将年龄的数据类型由字符型改为整数
`ALTER TABLE Student ALTER COLUMN Sage INT;`
- 解释：将`Student`表中名为`Sage`的列的数据类型从字符型（假设原类型为`CHAR`或`VARCHAR`）修改为整数类型（`INT`）。
- 注意：在修改数据类型时，需要确保表中已有的数据符合新的数据类型要求，否则会报错。

#### 示例 3.10：增加课程名称必须取唯一值的约束条件
`ALTER TABLE Course ADD UNIQUE(Cname);`
- 解释：向`Course`表中添加一个表级完整性约束，要求`Cname`列的值必须唯一。


## 删除基本表的语法及示例解释

### 删除基本表的语法
`DROP TABLE <表名> [RESTRICT | CASCADE];`

### 各部分解释
- `<表名>`：要删除的基本表的名称。
- `RESTRICT`：限制性删除。
    - 如果该表被其他表的约束（如外键）引用，或者表上有依赖的对象（如视图、索引、触发器等），则不允许删除该表。
    - 这种方式更安全，防止误删除导致数据完整性问题。
- `CASCADE`：级联删除。
    - 删除该表时，同时删除所有依赖该表的对象，包括视图、索引、触发器等。
    - 这种方式更彻底，但需要谨慎使用，因为可能会导致大量相关对象被删除。

### 示例解释
#### 示例 3.11：删除`Student`表
```sql
DROP TABLE Student CASCADE;
```
- 解释：删除 `Student` 表，并且级联删除所有依赖该表的对象，如索引、视图、触发器等。
- 注意：使用 `CASCADE` 时，表及其所有相关对象都会被删除，操作不可逆。

#### 示例 3.12：删除表时的选择
假设存在一个视图 `IS_Student`，其定义如下：
```sql
CREATE VIEW IS_Student AS
SELECT Sno, Sname, Sage
FROM Student
WHERE Sdept = 'IS';
```

- **使用 `RESTRICT`**：
  ```sql
  DROP TABLE Student RESTRICT;
  ```
    - 解释：尝试删除 `Student` 表，但由于视图 `IS_Student` 依赖于该表，删除操作会失败，并报错：
      ```
      ERROR: cannot drop table Student because other objects depend on it
      ```
    - 注意：`RESTRICT` 选项会阻止删除任何有依赖关系的表，从而保护数据完整性。

- **使用 `CASCADE`**：
  ```sql
  DROP TABLE Student CASCADE;
  ```
    - 解释：删除 `Student` 表，并且级联删除所有依赖该表的对象，包括视图 `IS_Student`。
    - 注意：执行后会提示：
      ```
      NOTICE: drop cascades to view IS_Student
      ```
      表示视图 `IS_Student` 也被自动删除。

### 总结
- 使用 `DROP TABLE` 删除表时，`RESTRICT` 和 `CASCADE` 选项的选择取决于是否需要保留依赖对象：
    - 如果需要保留依赖对象，使用 `RESTRICT`。
    - 如果需要彻底删除表及其所有依赖对象，使用 `CASCADE`。


## 索引

### 索引的目的
- 建立索引的目的：加快查询速度。
- 由数据库管理员或表的拥有者建立。
- 由关系数据库管理系统自动完成维护。
- 关系数据库管理系统自动使用合适的索引作为存取路径，用户不必也不能显式地选择索引。

### 常见索引类型
- 顺序文件上的索引
- B+树索引
- 散列（hash）索引
- 位图索引

### 建立索引
#### 语句格式
```
CREATE [UNIQUE] [CLUSTER] INDEX <索引名> 
ON <表名>(<列名>[<次序>][,<列名>[<次序>]...]); 
```

#### 各部分解释
- `<表名>`：要建索引的基本表的名字。
    - 索引可以建立在该表的一列或多列上，各列名之间用逗号分隔。
- `<次序>`：指定索引值的排列次序，升序：`ASC`，降序：`DESC`。缺省值：`ASC`。
- `UNIQUE`：此索引的每一个索引值只对应唯一的数据记录。
- `CLUSTER`：表示要建立的索引是聚簇索引。

#### 示例 3.13：为学生-课程数据库中的表建立索引
```sql
CREATE UNIQUE INDEX Stusno ON Student(Sno);
CREATE UNIQUE INDEX Coucno ON Course(Cno);
CREATE UNIQUE INDEX SCno ON SC(Sno ASC, Cno DESC);
```
- `Student` 表按学号升序建唯一索引。
- `Course` 表按课程号升序建唯一索引。
- `SC` 表按学号升序和课程号降序建唯一索引。

### 修改 / 删除索引
#### 修改索引
`ALTER INDEX <旧索引名> RENAME TO <新索引名>;`

#### 示例 3.14：将 `SC` 表的 `SCno` 索引名改为 `SCSno`
```sql
ALTER INDEX SCno RENAME TO SCSno;
```

#### 删除索引
`DROP INDEX <索引名>;`

#### 示例 3.15：删除 `Student` 表的 `Stusname` 索引
```sql
DROP INDEX Stusname;
```
- 删除索引时，系统会从数据字典中删去有关该索引的描述。

### 数据字典
- 数据字典是关系数据库管理系统内部的一组系统表，它记录了数据库中所有定义信息：
    - 关系模式定义
    - 视图定义
    - 索引定义
    - 完整性约束定义
    - 各类用户对数据库的操作权限
    - 统计信息等
- 关系数据库管理系统在执行 SQL 的数据定义语句时，实际上就是在更新数据字典表中的相应信息。