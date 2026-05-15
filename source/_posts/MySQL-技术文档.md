---
title: MySQL
date: 2026-05-15 15:25:00
---

# MySQL 技术文档：SQL 执行、索引、事务、锁、日志与优化

## 1. MySQL 核心知识图谱

MySQL 的知识体系可以按六条主线理解：SQL 基础、执行流程、索引、事务、锁、日志与复制。日常开发和面试中的大部分问题，都能回到这几条主线中定位。

![MySQL 核心知识图谱](/images/tech-docs/mysql-core-map.png)

## 2. SQL 基础

### 2.1 内连接与外连接

`JOIN` 用于把多张表按条件关联起来。

| 类型 | 含义 |
| --- | --- |
| `INNER JOIN` | 只返回两张表中满足连接条件的记录 |
| `LEFT JOIN` | 返回左表所有记录，右表匹配不到时用 `NULL` 填充 |
| `RIGHT JOIN` | 返回右表所有记录，左表匹配不到时用 `NULL` 填充 |

常见示例：

```sql
SELECT u.id, u.name, o.order_no
FROM user u
INNER JOIN orders o ON u.id = o.user_id;
```

如果要保留左表中没有订单的用户，应使用 `LEFT JOIN`：

```sql
SELECT u.id, u.name, o.order_no
FROM user u
LEFT JOIN orders o ON u.id = o.user_id;
```

### 2.2 CHAR 与 VARCHAR

`CHAR` 是固定长度字符串，`VARCHAR` 是可变长度字符串。

| 类型 | 特点 | 适用场景 |
| --- | --- | --- |
| `CHAR` | 固定长度，不足会填充，读取简单 | 长度固定的数据，如状态码、性别、定长编号 |
| `VARCHAR` | 可变长度，节省空间 | 长度变化较大的文本，如昵称、标题、地址 |

一般业务字段优先考虑 `VARCHAR`，除非字段长度天然固定。

### 2.3 BLOB 与 TEXT

| 类型 | 存储内容 | 字符集 | 适用场景 |
| --- | --- | --- | --- |
| `BLOB` | 二进制数据 | 无字符集 | 图片、文件、序列化二进制内容 |
| `TEXT` | 大文本数据 | 有字符集 | 文章正文、评论、长描述 |

实际业务中，图片和文件通常不建议直接放进 MySQL，而是放对象存储或文件系统，MySQL 只保存地址和元数据。

### 2.4 DROP、DELETE 与 TRUNCATE

| 操作 | 作用 | 是否删除表结构 | 是否可回滚 | 是否触发逐行删除 |
| --- | --- | --- | --- | --- |
| `DROP` | 删除整张表 | 是 | 通常不可回滚 | 否 |
| `DELETE` | 删除满足条件的行 | 否 | 在事务中可回滚 | 是 |
| `TRUNCATE` | 清空整张表 | 否 | 通常不可回滚 | 否 |

`DELETE` 更适合按条件删除业务数据；`TRUNCATE` 更适合清空临时表；`DROP` 用于移除表结构。

### 2.5 常用 MySQL 函数

字符串函数：

- `CONCAT()`：拼接字符串。
- `LENGTH()`：返回字节长度。
- `SUBSTRING()`：截取子串。
- `REPLACE()`：替换字符串。
- `LOWER()` / `UPPER()`：大小写转换。
- `TRIM()`：去除两端空格。

聚合函数：

- `COUNT()`：统计数量。
- `SUM()`：求和。
- `AVG()`：平均值。
- `MAX()` / `MIN()`：最大值和最小值。
- `GROUP_CONCAT()`：将多行值拼接为一个字符串。

日期函数：

- `NOW()`：当前日期时间。
- `DATE_FORMAT()`：格式化日期。
- `DATEDIFF()`：计算日期差。
- `TIMESTAMPDIFF()`：按指定单位计算时间差。

### 2.6 隐式类型转换

MySQL 会在某些表达式中进行隐式类型转换：

- 浮点数与整数运算时，整数可能转换为浮点数。
- 字符串与数字比较或运算时，字符串可能转换为数字。
- 字符串列与数字比较时，可能导致索引失效。

不推荐写法：

```sql
SELECT * FROM user WHERE phone = 13800138000;
```

如果 `phone` 是字符串列，应写成：

```sql
SELECT * FROM user WHERE phone = '13800138000';
```

## 3. 一条 SQL 的执行流程

一条 SQL 从客户端发送到 MySQL 后，会经过连接器、解析器、优化器、执行器和存储引擎。

![一条 SQL 在 MySQL 中如何执行](/images/tech-docs/mysql-sql-execution-flow.png)

典型流程：

1. 客户端与 MySQL 建立连接。
2. 连接器负责身份认证、权限校验和连接管理。
3. 解析器进行词法分析、语法分析，生成语法树。
4. 预处理器检查表、字段、权限等信息。
5. 优化器基于成本选择执行计划。
6. 执行器按执行计划调用存储引擎接口。
7. 存储引擎读取索引页或数据页。
8. MySQL 返回结果给客户端。

MySQL 8.0 已移除查询缓存。现在更重要的是写出稳定可优化的 SQL，并通过 `EXPLAIN` 观察执行计划。

## 4. 存储引擎

### 4.1 InnoDB

InnoDB 是 MySQL 默认存储引擎。

特点：

- 支持事务。
- 支持行级锁。
- 支持外键。
- 使用聚簇索引组织数据。
- 通过 redo log 保证崩溃恢复能力。
- 通过 undo log 和 MVCC 支持一致性读。

### 4.2 MyISAM

MyISAM 是较老的存储引擎。

特点：

- 不支持事务。
- 不支持行级锁，主要是表级锁。
- 索引和数据分开存储，属于非聚簇索引。
- 崩溃恢复能力弱于 InnoDB。

新业务一般不推荐优先使用 MyISAM。

### 4.3 MEMORY

MEMORY 表的数据存储在内存中，速度快，但服务重启后数据会丢失。它支持哈希索引和 B 树索引，适合临时性、高速访问的数据场景。

## 5. InnoDB 索引结构

InnoDB 使用 B+ 树作为主要索引结构。

![InnoDB 索引结构与回表](/images/tech-docs/mysql-innodb-index-btree.png)

### 5.1 聚簇索引

InnoDB 的主键索引就是聚簇索引。聚簇索引的叶子节点保存完整行数据，因此索引和数据不是分开存储的。

如果表没有显式主键，InnoDB 会优先选择唯一非空索引作为聚簇索引；如果仍没有，会生成隐藏的行 ID。

主键建议：

- 尽量使用自增或趋势递增主键。
- 尽量保持较短。
- 尽量稳定，不频繁修改。

自增主键适合 InnoDB，是因为新增数据通常追加到 B+ 树右侧，页分裂和数据移动成本更低。

### 5.2 二级索引与回表

二级索引的叶子节点保存的是索引列值和主键值，不保存完整行数据。

如果查询的数据不在二级索引中，MySQL 需要：

1. 先通过二级索引定位主键。
2. 再拿主键回到聚簇索引查询完整行。

这个过程叫回表。

示例：

```sql
CREATE INDEX idx_name ON user(name);

SELECT age FROM user WHERE name = 'Alice';
```

如果 `age` 不在 `idx_name` 中，就需要回表。

### 5.3 覆盖索引

如果查询需要的字段都能从二级索引中拿到，就不需要回表，这就是覆盖索引。

```sql
CREATE INDEX idx_name_age ON user(name, age);

SELECT name, age FROM user WHERE name = 'Alice';
```

此时查询字段 `name`、`age` 都在联合索引中，可以减少随机 I/O。

### 5.4 联合索引与最左匹配

联合索引遵循最左匹配原则。

假设有索引：

```sql
CREATE INDEX idx_a_b_c ON t(a, b, c);
```

可以较好利用索引的条件：

```sql
WHERE a = 1
WHERE a = 1 AND b = 2
WHERE a = 1 AND b = 2 AND c = 3
```

不能充分利用该索引的条件：

```sql
WHERE b = 2
WHERE b = 2 AND c = 3
```

联合索引设计时，应把选择性高、查询中更常用、更适合排序或范围过滤的字段放在合适位置。

## 6. 索引失效

常见索引失效场景：

- 对索引列使用函数。
- 对索引列进行表达式计算。
- 字符串列没有加引号，发生隐式类型转换。
- 使用左模糊或左右模糊匹配，例如 `LIKE '%abc'`。
- `OR` 前后条件中有一侧没有索引。
- 联合索引不符合最左匹配原则。
- 范围查询后面的联合索引列无法继续充分利用。

示例：

```sql
-- 索引列被函数包裹，容易失效
SELECT * FROM user WHERE DATE(create_time) = '2026-05-15';

-- 更推荐写成范围查询
SELECT * FROM user
WHERE create_time >= '2026-05-15 00:00:00'
  AND create_time <  '2026-05-16 00:00:00';
```

`LIKE` 左模糊无法走普通 B+ 树索引的原因是：B+ 树按索引值从左到右有序，只有从前缀开始匹配时，才能利用有序性定位范围。

## 7. 索引优化建议

适合建立索引的字段：

- 主键和唯一键。
- 区分度高的字段。
- 经常出现在 `WHERE`、`JOIN`、`GROUP BY`、`ORDER BY` 中的字段。
- 多个字段经常组合查询时，可以考虑联合索引。

不适合建立索引的字段：

- 区分度很低的字段，例如性别、布尔状态。
- 很少被查询过滤的字段。
- 更新非常频繁且业务收益不高的字段。
- 超长字段，除非使用前缀索引或全文索引。

优化方向：

- 主键尽量自增。
- 使用覆盖索引减少回表。
- 使用前缀索引降低索引体积。
- 避免 `SELECT *`。
- 避免索引列计算和隐式类型转换。
- 通过 `EXPLAIN` 验证执行计划。

## 8. EXPLAIN

`EXPLAIN` 用于查看 SQL 的执行计划。

常见字段：

| 字段 | 含义 |
| --- | --- |
| `id` | 查询编号，值越大通常越先执行 |
| `select_type` | 查询类型 |
| `table` | 当前访问的表 |
| `type` | 访问类型 |
| `possible_keys` | 可能使用的索引 |
| `key` | 实际使用的索引 |
| `rows` | 预估扫描行数 |
| `Extra` | 额外信息 |

`type` 常见值从差到好大致为：

```text
ALL -> index -> range -> ref -> eq_ref -> const -> system
```

常见解释：

- `ALL`：全表扫描。
- `index`：全索引扫描。
- `range`：索引范围扫描。
- `ref`：非唯一索引等值扫描。
- `eq_ref`：唯一索引关联扫描。
- `const`：结果最多一条的主键或唯一索引扫描。

`Extra` 常见信息：

- `Using index`：使用覆盖索引。
- `Using where`：存储引擎返回数据后，Server 层继续过滤。
- `Using temporary`：使用临时表。
- `Using filesort`：需要额外排序。

## 9. 事务基础

事务具有 ACID 四大特性：

| 特性 | 含义 |
| --- | --- |
| Atomicity 原子性 | 要么全部成功，要么全部失败 |
| Consistency 一致性 | 事务前后数据满足约束和业务一致性 |
| Isolation 隔离性 | 并发事务之间互不干扰或按规则隔离 |
| Durability 持久性 | 事务提交后数据持久保存 |

## 10. 事务隔离、MVCC 与锁

事务并发问题主要包括脏读、不可重复读和幻读。

![事务隔离、MVCC 与 InnoDB 锁](/images/tech-docs/mysql-mvcc-locks.png)

### 10.1 并发问题

| 问题 | 含义 |
| --- | --- |
| 脏读 | 一个事务读到了另一个未提交事务修改过的数据 |
| 不可重复读 | 同一事务内前后两次读取同一行，结果不同 |
| 幻读 | 同一事务内多次范围查询，结果集行数不同 |

### 10.2 隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
| --- | --- | --- | --- |
| 读未提交 | 可能 | 可能 | 可能 |
| 读提交 | 不可能 | 可能 | 可能 |
| 可重复读 | 不可能 | 不可能 | 可能 |
| 串行化 | 不可能 | 不可能 | 不可能 |

MySQL InnoDB 默认隔离级别是可重复读。它通过 MVCC 解决快照读的一致性问题，通过 Next-Key Lock 等锁机制解决当前读下的幻读问题。

### 10.3 MVCC

MVCC 是多版本并发控制。它让普通 `SELECT` 在很多情况下不需要加锁，也能读到一致性快照。

核心组成：

- 隐藏字段 `trx_id`：记录最近一次修改该行的事务 ID。
- 隐藏字段 `roll_pointer`：指向 undo log 中的历史版本。
- undo log：保存旧版本数据。
- ReadView：定义当前事务能看见哪些版本。

快照读示例：

```sql
SELECT * FROM user WHERE id = 1;
```

当前读示例：

```sql
SELECT * FROM user WHERE id = 1 FOR UPDATE;
UPDATE user SET name = 'Alice' WHERE id = 1;
DELETE FROM user WHERE id = 1;
```

快照读主要依赖 MVCC；当前读会读取最新数据，并可能加锁。

## 11. InnoDB 锁

### 11.1 锁的粒度

MySQL 中常见锁粒度：

- 全局锁：锁住整个数据库实例。
- 表级锁：锁住整张表。
- 行级锁：锁住索引记录或范围。
- 页级锁：锁住数据页，较少作为重点讨论。

InnoDB 的行锁是加在索引上的。如果查询条件没有命中索引，可能扫描大量记录并加锁，严重时接近锁表效果。

### 11.2 常见行锁

| 锁类型 | 含义 |
| --- | --- |
| Record Lock | 记录锁，锁住某条索引记录 |
| Gap Lock | 间隙锁，锁住索引记录之间的间隙 |
| Next-Key Lock | 临键锁，记录锁 + 间隙锁 |
| Insert Intention Lock | 插入意向锁，插入前对间隙加的特殊锁 |

在可重复读隔离级别下，InnoDB 常通过 Next-Key Lock 防止当前读出现幻读。

### 11.3 update 不走索引的风险

如果 `UPDATE` 的 `WHERE` 条件没有使用索引，InnoDB 可能进行全表扫描，并对大量记录或范围加 Next-Key Lock。

危险写法：

```sql
UPDATE account SET balance = balance - 100 WHERE phone = '13800138000';
```

如果 `phone` 没有索引，这条语句可能扫描并锁住大量记录。

## 12. 日志体系

MySQL 重要日志包括 undo log、redo log 和 binlog。

![MySQL 日志体系与两阶段提交](/images/tech-docs/mysql-logs-2pc-replication.png)

### 12.1 undo log

undo log 是回滚日志。

作用：

- 支持事务回滚。
- 支持 MVCC 读取历史版本。

例如事务把 `balance` 从 `100` 改成 `80`，undo log 会记录修改前的版本，回滚或快照读时可以使用。

### 12.2 redo log

redo log 是 InnoDB 的重做日志，记录数据页的物理修改。

作用：

- 保证事务持久性。
- 支持崩溃恢复。
- 配合 WAL 机制，先写日志，再择机刷数据页。

WAL 是 Write-Ahead Logging，即先写日志再写数据。事务提交前先把修改记录写入 redo log，即使数据页还没刷盘，宕机后也可以通过 redo log 恢复。

### 12.3 binlog

binlog 是 MySQL Server 层的归档日志，记录逻辑变更。

作用：

- 主从复制。
- 数据备份和恢复。
- 审计数据变更。

binlog 常见格式：

- `STATEMENT`：记录 SQL 语句。
- `ROW`：记录行数据变化。
- `MIXED`：混合模式。

## 13. binlog 与 redo log 的区别

| 对比项 | binlog | redo log |
| --- | --- | --- |
| 所属层 | Server 层 | InnoDB 存储引擎 |
| 日志类型 | 逻辑日志 | 物理日志 |
| 写入方式 | 追加写，文件写满后新建 | 循环写，空间固定 |
| 主要用途 | 主从复制、备份恢复 | 崩溃恢复、保证持久性 |
| 记录范围 | 所有支持 binlog 的引擎变更 | InnoDB 数据页修改 |

binlog 可以理解为“做了什么操作”，redo log 更接近“哪个数据页的什么位置被改了”。

## 14. 两阶段提交

两阶段提交用于保证 redo log 和 binlog 的一致性。

简化流程：

1. 写 undo log。
2. 修改 Buffer Pool 中的数据页。
3. 写 redo log，状态为 prepare。
4. 写 binlog。
5. 写 redo log，状态为 commit。
6. 事务提交成功。

为什么需要两阶段提交？

如果没有两阶段提交，可能出现 redo log 写成功但 binlog 没写成功，或 binlog 写成功但 redo log 状态不一致的问题。这会导致主库事务状态和从库复制结果不一致。

两阶段提交让恢复时可以根据 redo log 和 binlog 的状态判断事务应该提交还是回滚。

## 15. 主从复制

MySQL 主从复制的核心依赖 binlog。

基本流程：

1. 主库提交事务并写入 binlog。
2. 从库 IO 线程读取主库 binlog。
3. 从库写入 relay log。
4. 从库 SQL 线程读取 relay log 并重放。
5. 从库数据追赶主库。

常见复制模式：

- 异步复制：主库提交后不等待从库确认。
- 半同步复制：至少等待一个从库确认收到日志。
- 组复制：更强的一致性和高可用方案。

## 16. count 统计

`COUNT()` 用于统计符合条件的记录数。

常见性能理解：

```text
COUNT(1) ≈ COUNT(*) > COUNT(主键) > COUNT(字段)
```

说明：

- `COUNT(*)` 和 `COUNT(1)` 不取具体字段值，通常会选择成本较低的索引树扫描。
- `COUNT(主键)` 需要读取主键值。
- `COUNT(字段)` 需要判断字段是否为 `NULL`，如果没有合适索引，成本可能更高。

在 InnoDB 中，精确统计通常需要扫描索引，不能像某些引擎那样直接保存全表精确行数。

## 17. 深度分页

深度分页常见问题：

```sql
SELECT * FROM orders ORDER BY id LIMIT 1000000, 100;
```

MySQL 需要先扫描并跳过大量数据，再返回后面的 100 条，成本很高。

优化方式之一是基于上一次查询的最大主键继续查：

```sql
SELECT *
FROM orders
WHERE id > #{last_id}
ORDER BY id
LIMIT 100;
```

这种方式适合按主键或趋势递增字段翻页的场景。

## 18. DATETIME 与 TIMESTAMP

| 类型 | 特点 |
| --- | --- |
| `DATETIME` | 直接存储日期时间值，与时区无关 |
| `TIMESTAMP` | 存储 UTC 时间戳，显示时受时区影响 |

业务系统中，如果需要记录用户输入的本地日期时间，常用 `DATETIME`；如果需要记录事件发生的绝对时间点，并考虑跨时区显示，可以使用 `TIMESTAMP` 或统一使用 UTC 时间策略。

## 19. 金额字段类型

金额不建议使用 `FLOAT` 或 `DOUBLE`，因为二进制浮点数可能存在精度误差。

推荐：

```sql
amount DECIMAL(18, 2)
```

或者在业务中以整数单位存储，例如分：

```sql
amount_cent BIGINT
```

## 20. 分库分表

当单表数据量、写入压力或存储容量逐渐超过单机承载能力时，可以考虑分库分表。经验上，单表达到数百万到千万级数据时，就要关注查询模式、索引大小、写入压力和归档策略。

常见方式：

- 垂直拆分：按业务模块或字段冷热拆分。
- 水平拆分：按用户 ID、订单 ID、时间等规则拆分数据行。

分库分表带来的问题：

- 跨库 Join 变复杂。
- 分布式事务成本上升。
- 全局唯一 ID 需要单独设计。
- 聚合查询、排序、分页更复杂。
- 扩容迁移需要规划。

分库分表不是第一选择。优先考虑索引优化、SQL 优化、冷热归档、读写分离、缓存和硬件资源升级。

## 21. 乐观锁与悲观锁

悲观锁认为并发冲突经常发生，因此先加锁再操作。

```sql
SELECT * FROM account WHERE id = 1 FOR UPDATE;
```

乐观锁认为冲突较少，更新时通过版本号或时间戳判断数据是否被别人修改。

```sql
UPDATE account
SET balance = balance - 100,
    version = version + 1
WHERE id = 1
  AND version = 10;
```

如果影响行数为 `0`，说明版本不匹配，更新失败，需要重试或提示用户。

## 22. 高频面试题速记

### 22.1 什么情况下会回表

使用二级索引查询时，如果查询字段不在二级索引中，就需要根据主键回到聚簇索引读取完整行。

避免方式：

- 使用覆盖索引。
- 减少不必要字段。
- 避免 `SELECT *`。

### 22.2 什么是索引下推

索引下推是 Index Condition Pushdown，简称 ICP。它会把部分 Server 层过滤条件下推到存储引擎层执行，减少回表次数。

例如联合索引 `(name, age)`，查询：

```sql
SELECT * FROM user
WHERE name LIKE 'A%'
  AND age = 18;
```

存储引擎可以在扫描索引时尽量先过滤 `age` 条件，减少回表。

### 22.3 为什么 3 层 B+ 树能存很多数据

B+ 树的非叶子节点只保存索引键和指针，单个页能容纳大量目录项。即使树高只有 3 层，也可以通过高扇出定位到大量叶子节点，因此能承载千万级甚至更多数据。

这也是 MySQL 单次索引查询通常只需要少量随机 I/O 的原因。

### 22.4 可重复读下如何解决幻读

普通 `SELECT` 是快照读，InnoDB 通过 MVCC 和 ReadView 保证同一事务内读到一致快照。

`SELECT ... FOR UPDATE`、`UPDATE`、`DELETE` 属于当前读，InnoDB 通过记录锁、间隙锁和临键锁阻止其他事务在范围内插入新记录。

### 22.5 什么情况下会锁表

常见情况：

- 使用表级锁。
- DDL 操作引发元数据锁等待。
- `UPDATE` / `DELETE` 条件没有命中索引，导致大范围扫描并加锁。
- 事务长时间不提交，持有大量行锁。

排查时可以关注：

```sql
SHOW PROCESSLIST;
SHOW ENGINE INNODB STATUS;
```

以及 `performance_schema` 中的锁等待信息。

## 23. 复习总结

MySQL 的核心链路可以这样串起来：

- SQL 进入 MySQL 后，经连接器、解析器、优化器、执行器，最终访问存储引擎。
- InnoDB 通过 B+ 树组织索引和数据，主键索引是聚簇索引，二级索引可能回表。
- 索引优化的目标是减少扫描行数、减少回表、避免排序和临时表。
- 事务隔离依赖 MVCC、ReadView、undo log 和锁机制。
- redo log 保证崩溃恢复，binlog 支持复制和备份，两阶段提交保证两者一致。
- 锁加在索引上，SQL 是否命中索引会直接影响并发性能。

排查 MySQL 问题时，可以按“SQL 写法 -> 执行计划 -> 索引结构 -> 事务与锁 -> 日志与复制”这条链路逐层定位。
