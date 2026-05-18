---
title: Redis
date: 2026-05-15 16:12:00
---

# Redis 技术文档：数据结构、持久化、缓存问题、分布式锁与高可用

## 1. Redis 核心知识图谱

Redis 是一个以内存为核心的高性能键值数据库，常用于缓存、分布式锁、排行榜、计数器、消息队列、共享 Session、限流和实时数据场景。学习 Redis 可以围绕六条主线展开：基础与应用、数据类型、高性能原因、持久化、缓存问题、高可用与集群。

![Redis 核心知识图谱](/images/tech-docs/redis-core-map.png)

## 2. Redis 与 MySQL 的区别

| 维度 | Redis | MySQL |
| --- | --- | --- |
| 数据模型 | 键值数据库，支持多种内存数据结构 | 关系型数据库，表、行、列模型 |
| 存储位置 | 主要存储在内存中，可持久化到磁盘 | 主要存储在磁盘中，通过 Buffer Pool 加速 |
| 性能特点 | 读写极快，适合高频访问 | 支持复杂查询、事务和持久化一致性 |
| 查询能力 | 以 key 访问为主，不擅长复杂关系查询 | 支持 SQL、Join、事务、索引优化 |
| 典型场景 | 缓存、计数、排行榜、分布式锁、消息队列 | 业务主库、订单、账户、事务数据 |

Redis 不是 MySQL 的替代品。更常见的架构是：MySQL 作为主数据源，Redis 作为高性能缓存或辅助数据结构。

## 3. Redis 常见应用场景

常见场景：

- 缓存热点数据，降低数据库压力。
- 计数器，例如点赞数、阅读量、库存预扣。
- 排行榜，例如使用 `ZSET` 维护分数排名。
- 分布式锁，例如 `SET key value NX PX`。
- 共享 Session。
- 白名单、黑名单、去重集合。
- 消息队列，例如 `List`、`Stream`。
- 限流，例如固定窗口、滑动窗口、令牌桶。

选择 Redis 时要记住：它快，但不是无限快；它在内存中工作，所以大 key、热 key、缓存雪崩和持久化策略都会影响稳定性。

## 4. Redis 为什么快

Redis 快主要来自几个方面：

![Redis 高性能原因与 I/O 多路复用](/images/tech-docs/redis-io-multiplexing.png)

### 4.1 基于内存

Redis 的主要数据存储在内存中，避免了传统磁盘随机 I/O 的高延迟。

### 4.2 单线程执行命令

Redis 的核心命令执行模型长期以单线程为主，避免了多线程竞争锁和上下文切换成本。

需要注意，Redis 的“单线程”主要指网络 I/O 事件处理和键值读写命令执行的主流程。持久化、异步删除、集群同步等能力可能由后台线程或子进程协助完成。

### 4.3 高效数据结构

Redis 为不同数据类型设计了紧凑且高效的底层结构，例如 SDS、listpack、quicklist、hashtable、skiplist 等。

### 4.4 I/O 多路复用

Redis 使用 I/O 多路复用处理大量客户端连接。

常见模型对比：

| 模型 | 特点 |
| --- | --- |
| `select` | 每次调用都要复制 fd 集合，并遍历查找就绪 fd，有数量限制 |
| `poll` | 没有最大 fd 数量限制，但仍要复制并遍历 fd 集合 |
| `epoll` | 内核维护监听集合，只返回就绪 fd，适合大量连接 |

`epoll` 的核心接口：

- `epoll_create`：创建 epoll 实例。
- `epoll_ctl`：添加、修改或删除监听 fd。
- `epoll_wait`：等待并返回就绪事件。

## 5. Redis 数据类型与底层结构

Redis 对外提供逻辑数据类型，对内会根据数据规模和版本选择不同编码。

![Redis 数据类型与底层结构](/images/tech-docs/redis-data-structures.png)

### 5.1 String

`String` 是最基础的数据类型，可以存储字符串、整数、浮点数、JSON、序列化内容等。

常见命令：

```redis
SET user:1:name Alice
GET user:1:name
INCR article:1:view_count
SETEX token:1 3600 abc
```

典型场景：

- 缓存对象 JSON。
- 计数器。
- 分布式锁。
- 简单配置。

### 5.2 List

`List` 是有序列表，常用于消息列表和简单队列。

```redis
LPUSH queue:order order-1
RPOP queue:order
```

Redis 新版本中，List 底层通常使用 `quicklist`，可以理解为多个紧凑列表节点组成的双向链表。

### 5.3 Hash

`Hash` 适合保存对象的多个字段。

```redis
HSET user:1 name Alice age 18
HGET user:1 name
HMGET user:1 name age
```

适合场景：

- 用户信息。
- 商品属性。
- 对象局部字段更新。

当对象很大但每次只读写部分字段时，Hash 往往比把整个 JSON 放进 String 更合适。

### 5.4 Set

`Set` 是无序不重复集合。

```redis
SADD article:1:likes user:1 user:2
SISMEMBER article:1:likes user:1
SCARD article:1:likes
```

典型场景：

- 去重。
- 白名单、黑名单。
- 共同关注、交集并集差集。

### 5.5 ZSet

`ZSet` 是有序集合，每个元素都有一个 score。

```redis
ZADD rank:score 100 user:1
ZREVRANGE rank:score 0 9 WITHSCORES
```

典型场景：

- 排行榜。
- 延迟队列。
- 按权重排序的数据。

`ZSet` 常见底层结构包括 listpack 和 skiplist。元素较少且体积较小时使用紧凑结构；数据规模变大后会使用跳表和字典。

跳表节点中通常包含：

- `score`：排序分值。
- `member`：元素值。
- 多层 forward 指针。
- span 跨度，用于排名计算。

### 5.6 Bitmap、HyperLogLog 与 Stream

`Bitmap` 适合按位统计：

```redis
SETBIT sign:2026-05 user_id 1
GETBIT sign:2026-05 user_id
```

`HyperLogLog` 适合估算 UV，内存占用小，但结果是近似值。

```redis
PFADD uv:home user:1 user:2
PFCOUNT uv:home
```

`Stream` 是 Redis 5.0 引入的消息流结构，支持消息 ID、消费者组、ACK 等机制，更适合消息队列场景。

## 6. 渐进式 rehash

Redis 的字典底层使用哈希表。扩容时，如果一次性迁移所有数据，会造成明显阻塞，因此 Redis 使用渐进式 rehash。

核心思路：

1. 准备两个哈希表：`ht[0]` 和 `ht[1]`。
2. 平时数据在 `ht[0]`。
3. 扩容时为 `ht[1]` 分配更大的空间。
4. 新写入的数据直接放入 `ht[1]`。
5. 每次查询、插入、删除时，顺带把 `ht[0]` 的一部分数据迁移到 `ht[1]`。
6. 迁移完成后释放 `ht[0]`，把 `ht[1]` 设置为新的 `ht[0]`。

这样可以把一次大迁移拆成多次小迁移，降低阻塞风险。

## 7. Redis 持久化

Redis 主要有 RDB、AOF 和混合持久化。

![Redis 持久化：RDB、AOF 与混合持久化](/images/tech-docs/redis-persistence.png)

### 7.1 RDB

RDB 是快照持久化，会把某一时刻的内存数据保存为 RDB 文件。

特点：

- 文件紧凑。
- 恢复速度快。
- 适合备份和全量复制。
- 可能丢失最近一次快照之后的数据。

常见触发方式：

- `SAVE`：阻塞主线程生成快照。
- `BGSAVE`：fork 子进程生成快照，主进程继续处理请求。

### 7.2 AOF

AOF 是追加日志持久化，会记录写命令。

特点：

- 数据完整性通常比 RDB 更好。
- 文件可能更大。
- 恢复时需要重放命令，速度可能慢于 RDB。

AOF 写回策略：

| 策略 | 含义 | 特点 |
| --- | --- | --- |
| `always` | 每次写命令后都同步刷盘 | 可靠性高，性能低 |
| `everysec` | 每秒刷盘一次 | 性能和可靠性折中，常用 |
| `no` | 交给操作系统决定刷盘时机 | 性能高，丢失风险更大 |

### 7.3 AOF 重写

AOF 长期追加会变大。Redis 可以通过 `BGREWRITEAOF` 重写 AOF。

重写不是简单压缩旧文件，而是根据当前内存状态生成一份更短的新 AOF。例如一个 key 被连续修改 100 次，新 AOF 只需要记录最终状态。

### 7.4 混合持久化

混合持久化在 AOF 重写过程中生效：

1. 子进程先把当前内存数据以 RDB 格式写入新 AOF 文件。
2. 主进程继续处理写命令，并写入重写缓冲区。
3. 子进程完成全量写入后，把增量命令以 AOF 格式追加进去。
4. 新文件替换旧 AOF。

混合持久化兼顾 RDB 的恢复速度和 AOF 的数据完整性。

## 8. Redis 事务与 Lua

Redis 事务通过 `MULTI`、`EXEC`、`DISCARD`、`WATCH` 等命令实现。

```redis
MULTI
INCR stock:1
DECR balance:1
EXEC
```

Redis 事务特点：

- 命令会按顺序执行。
- 执行期间不会被其他客户端命令插入。
- 不支持传统关系型数据库那样的自动回滚。

从 ACID 角度看：

- 原子性：Redis 事务不完全等同数据库事务；Lua 脚本可以保证脚本执行过程的原子性。
- 隔离性：单线程执行命令，脚本执行期间不会被打断。
- 持久性：取决于 RDB/AOF 配置。
- 一致性：需要业务和命令设计共同保证。

Lua 脚本适合把多个 Redis 命令打包为原子操作。

## 9. Redis 分布式锁

Redis 分布式锁的常见写法：

```redis
SET lock_key unique_value NX PX 30000
```

含义：

- `NX`：只有 key 不存在时才设置成功。
- `PX 30000`：设置 30 秒过期时间，避免死锁。
- `unique_value`：锁持有者标识，避免误删别人的锁。

释放锁时不能简单 `DEL lock_key`，应使用 Lua 脚本保证“校验锁持有者 + 删除锁”的原子性。

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

如果业务执行时间可能超过锁过期时间，需要续期机制，例如 WatchDog。续期也要谨慎，避免锁长期不释放。

## 10. 缓存问题与解决方案

Redis 缓存问题主要包括缓存穿透、缓存击穿、缓存雪崩、热 key、大 key 和缓存一致性。

![Redis 缓存问题与分布式锁](/images/tech-docs/redis-cache-locks.png)

### 10.1 缓存穿透

缓存穿透是指请求的数据在缓存和数据库中都不存在，请求绕过缓存直接打到数据库。

解决方式：

- 缓存空值，并设置较短过期时间。
- 使用布隆过滤器拦截一定不存在的 key。
- 做参数校验，过滤非法请求。

布隆过滤器优点：

- 内存效率高。
- 查询速度快。

缺点是可能误判存在，但不会误判不存在。

### 10.2 缓存击穿

缓存击穿是指某个热点 key 过期瞬间，大量请求同时打到数据库。

解决方式：

- 互斥锁：同一时间只允许一个线程回源加载缓存。
- 逻辑过期：缓存不物理过期，由后台异步刷新。
- 热点 key 不设置过期时间，后台更新。

### 10.3 缓存雪崩

缓存雪崩是指大量 key 同时过期，或 Redis 实例不可用，导致请求大量打到数据库。

解决方式：

- 过期时间增加随机值。
- 核心数据不设置统一过期时间，采用后台刷新。
- 限流、熔断、降级。
- 构建 Redis 高可用集群。
- 多级缓存兜底。

### 10.4 缓存一致性

常见策略：

- 先更新数据库，再删除缓存。
- 删除缓存失败时通过消息队列重试。
- 设置过期时间作为兜底。
- 延迟双删降低并发读写导致的不一致窗口。

典型流程：

```text
更新数据库 -> 删除缓存 -> 如果删除失败，投递 MQ 重试 -> 依赖过期时间兜底
```

不建议先更新缓存再更新数据库，因为数据库失败会让缓存保存脏数据。

### 10.5 热 key

热 key 是指访问频率非常高的 key。

解决方式：

- 本地缓存。
- 读写分离，将读请求分流到从节点。
- 热 key 多副本，分散到不同 Redis 分片。
- 对热点接口限流。

### 10.6 大 key

大 key 可能导致网络阻塞、内存分布不均、删除阻塞、迁移困难。

常见标准：

- String 类型 value 大于 1MB。
- Hash、List、Set、ZSet 等集合元素数量超过 1 万。

解决方式：

- 拆分大对象为多个 key。
- 对对象部分字段访问时，使用 Hash 拆分字段。
- 使用 `UNLINK` 异步删除，避免 `DEL` 阻塞。
- 使用 `SCAN` 分批处理，避免一次性遍历大量 key。
- 对大量相似 String key，可以按桶拆成多个 Hash。

## 11. 过期删除与内存淘汰

### 11.1 过期删除策略

Redis 常见过期删除策略：

- 定时删除：设置过期时间时创建定时事件，到期立即删除。
- 惰性删除：访问 key 时检查是否过期，过期则删除。
- 定期删除：周期性随机抽取一部分 key 检查并删除过期 key。

Redis 采用“惰性删除 + 定期删除”的组合，在 CPU 消耗和内存释放之间取得平衡。

### 11.2 内存淘汰策略

当 Redis 使用内存超过 `maxmemory` 后，会根据配置的淘汰策略删除 key。

常见策略：

- `noeviction`：不淘汰，写入时报错。
- `allkeys-lru`：在所有 key 中淘汰最近最少使用的 key。
- `volatile-lru`：在设置了过期时间的 key 中淘汰最近最少使用的 key。
- `allkeys-random`：在所有 key 中随机淘汰。
- `volatile-random`：在设置了过期时间的 key 中随机淘汰。
- `volatile-ttl`：优先淘汰剩余 TTL 更短的 key。
- `allkeys-lfu`：在所有 key 中淘汰访问频率低的 key。
- `volatile-lfu`：在设置了过期时间的 key 中淘汰访问频率低的 key。

缓存场景常见选择是 `allkeys-lru` 或 `allkeys-lfu`，具体要看访问模式。

## 12. 主从复制、哨兵与 Cluster

Redis 的高可用体系主要包括主从复制、Sentinel 和 Redis Cluster。

![Redis 高可用：主从复制、Sentinel 与 Cluster](/images/tech-docs/redis-ha-cluster.png)

### 12.1 主从复制

主从复制的作用：

- 数据冗余。
- 故障恢复。
- 读写分离。
- 高可用基础。

第一次同步通常包含三个阶段：

1. 建立连接、协商同步。
2. 主库生成 RDB 并发送给从库，完成全量复制。
3. 主库把同步期间的新写命令发送给从库。

完成第一次同步后，主从之间基于长连接进行命令传播。

网络断开后，如果从库重新连接时所需数据还在 `repl_backlog_buffer` 中，可以进行增量复制；如果已经不在缓冲区中，则需要重新全量复制。

主从复制的问题：

- 不能分担主节点写压力。
- 异步复制可能丢数据。
- 主从延迟会影响读一致性。
- 网络异常时可能发生脑裂。

### 12.2 Sentinel

Sentinel 是哨兵，用于监控主从节点并执行故障转移。

核心职责：

- 监控：检查主从节点是否存活。
- 选主：主节点故障后，从从节点中选出新主节点。
- 通知：把新主节点信息通知客户端和其他节点。

搭建哨兵时常配置主节点名称、主节点 IP、端口以及 `quorum`。

哨兵节点之间通过 Redis 发布订阅机制相互发现。

故障转移过程：

1. 判断主节点主观下线。
2. 多个哨兵投票确认客观下线。
3. 选出一个从节点作为新主节点。
4. 让其他从节点复制新主节点。
5. 通知客户端。
6. 旧主节点恢复后降级为从节点。

### 12.3 脑裂

脑裂是指原主节点与哨兵、从节点网络断开，但仍能和部分客户端通信。哨兵可能选出新主节点，导致短时间内两个主节点都对外提供服务。

当原主节点恢复后，会被降级为从节点，并与新主节点全量同步。原主节点在隔离期间接收的写入可能丢失。

缓解方式：

- 配置 `min-replicas-to-write`。
- 配置 `min-replicas-max-lag`。
- 让主节点在无法连接足够从节点时拒绝写入。
- 缩短故障检测和客户端重连时间。

### 12.4 Redis Cluster

Redis Cluster 使用哈希槽管理数据分布。

核心规则：

```text
slot = CRC16(key) % 16384
```

Redis Cluster 一共有 16384 个槽，每个 key 根据哈希结果映射到某个槽，槽再分配给具体节点。

常见重定向：

- `MOVED`：客户端访问的槽不在当前节点，节点返回正确节点地址，客户端更新路由。
- `ASK`：槽迁移过程中临时重定向，客户端只对本次请求访问目标节点。

Redis Cluster 可以分担读写和存储压力，但跨槽多 key 操作会受限制。需要让相关 key 落在同一槽时，可以使用 hash tag，例如：

```text
user:{1001}:profile
user:{1001}:orders
```

## 13. Redis 常见命令速查

String：

```redis
SET key value
GET key
INCR counter
EXPIRE key 60
```

Hash：

```redis
HSET user:1 name Alice age 18
HGET user:1 name
HGETALL user:1
```

Set：

```redis
SADD tags redis mysql
SISMEMBER tags redis
SMEMBERS tags
```

ZSet：

```redis
ZADD rank 100 user:1
ZRANGE rank 0 9 WITHSCORES
ZREVRANGE rank 0 9 WITHSCORES
```

List：

```redis
LPUSH queue task1
RPOP queue
BRPOP queue 5
```

安全扫描：

```redis
SCAN 0 MATCH user:* COUNT 100
```

## 14. 高频面试题速记

### 14.1 Redis 为什么快

可以从四点回答：

- 数据主要在内存中。
- 核心命令执行是单线程，避免锁竞争。
- 数据结构高效。
- 使用 I/O 多路复用处理大量连接。

### 14.2 RDB 和 AOF 有什么区别

RDB 是快照，文件紧凑、恢复快，但可能丢失最后一次快照后的数据。AOF 是追加写命令，数据完整性更好，但文件更大，恢复可能更慢。

### 14.3 缓存穿透、击穿、雪崩区别

- 穿透：查不存在的数据，缓存和数据库都没有。
- 击穿：热点 key 过期，大量请求同时打到数据库。
- 雪崩：大量 key 同时过期或 Redis 整体不可用。

### 14.4 Redis 分布式锁如何保证安全

加锁使用：

```redis
SET lock_key unique_value NX PX 30000
```

解锁使用 Lua 脚本校验 value 后删除，避免误删其他线程持有的锁。

### 14.5 ZSet 底层如何实现

数据较小时使用紧凑结构；数据变大后通常使用跳表和字典。跳表按 score 排序，支持范围查询和排名计算。

### 14.6 Redis Cluster 为什么是 16384 个槽

Redis Cluster 通过固定数量的槽把 key 和节点解耦。节点扩容或缩容时迁移槽即可，不需要对所有 key 重新映射。16384 个槽在路由表大小、迁移粒度和管理成本之间取得平衡。

## 15. 复习总结

Redis 的核心可以压缩成几句话：

- Redis 快，主要因为内存、单线程命令执行、高效数据结构和 I/O 多路复用。
- Redis 的逻辑类型背后有不同编码，数据规模变化会影响底层结构。
- RDB 适合快照备份和快速恢复，AOF 适合更好的数据完整性，混合持久化兼顾两者。
- 缓存穿透、击穿、雪崩、热 key 和大 key 都是稳定性问题，不只是性能问题。
- 分布式锁要保证加锁原子性、锁值唯一、过期时间和 Lua 安全解锁。
- 主从复制解决冗余和读扩展，Sentinel 解决故障转移，Cluster 解决水平扩展。

排查 Redis 问题时，可以按“请求模式 -> key 规模 -> 数据结构 -> 持久化策略 -> 复制延迟 -> 集群路由”这条链路逐层定位。
