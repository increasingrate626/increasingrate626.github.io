---
title: JAVA 集合
date: 2026-05-14 22:08:00
---

# Java 集合技术文档：Collection、Map、HashMap、并发集合与常见面试点

## 1. Java 集合核心知识图谱

Java 集合框架可以先按两条主线理解：一条是 `Collection`，负责存放单个元素；另一条是 `Map`，负责存放键值对。常见面试题基本都围绕存储结构、扩容、哈希冲突、线程安全和遍历一致性展开。

![Java 集合框架核心图谱](/images/tech-docs/java-collections-core-map.png)

## 2. 集合框架整体结构

Java 集合框架主要位于 `java.util` 包下，并在 `java.util.concurrent` 中提供并发容器。

常见分类：

- `List`：有序、可重复，典型实现有 `ArrayList`、`LinkedList`。
- `Set`：不允许重复，典型实现有 `HashSet`、`LinkedHashSet`、`TreeSet`。
- `Queue`：队列语义，典型实现有 `ArrayDeque`、`PriorityQueue`、`BlockingQueue`。
- `Map`：键值对映射，典型实现有 `HashMap`、`LinkedHashMap`、`TreeMap`、`ConcurrentHashMap`。

注意，`Map` 不继承 `Collection`，它是集合框架里的另一条独立接口体系。

## 3. List：ArrayList 与 LinkedList

### 3.1 ArrayList 的底层结构

`ArrayList` 底层是动态数组，本质上通过 `Object[]` 保存元素。

核心特点：

- 支持随机访问，`get(index)` 时间复杂度为 `O(1)`。
- 尾部追加元素通常很快，均摊时间复杂度为 `O(1)`。
- 在中间插入或删除元素时，需要移动后续元素，时间复杂度为 `O(n)`。
- 扩容时会创建新数组，并通过 `System.arraycopy()` 或 `Arrays.copyOf()` 迁移元素。

当新增元素前发现容量不足时，`ArrayList` 会扩容。常见实现中，新容量大约为旧容量的 `1.5` 倍。

下面的图示说明了数组型集合在插入元素时为什么需要移动元素。

![ArrayList 插入元素时的数据迁移](/images/tech-docs/java-collections-arraylist-copy.png)

### 3.2 LinkedList 的底层结构

`LinkedList` 底层是双向链表，每个节点保存当前元素、前驱节点和后继节点。

核心特点：

- 不支持真正的随机访问，按索引查找需要从头或尾遍历，时间复杂度为 `O(n)`。
- 在已定位到节点的情况下，插入和删除节点只需要改指针，时间复杂度为 `O(1)`。
- 每个节点都要额外保存前后指针，内存开销更高。
- 同时实现了 `List` 和 `Deque`，因此既可以当列表使用，也可以当双端队列使用。

很多人会简单认为 `LinkedList` 增删一定比 `ArrayList` 快，这个结论不完整。实际业务中，如果先要按下标定位元素，`LinkedList` 的定位成本往往会抵消它改指针的优势。

### 3.3 ArrayList 和 LinkedList 对比

| 维度 | ArrayList | LinkedList |
| --- | --- | --- |
| 底层结构 | 动态数组 | 双向链表 |
| 随机访问 | 快，`O(1)` | 慢，`O(n)` |
| 尾部追加 | 快，均摊 `O(1)` | 快，`O(1)` |
| 中间插入删除 | 需要移动元素，`O(n)` | 定位后改指针，定位本身 `O(n)` |
| 内存占用 | 较低 | 较高 |
| 典型场景 | 查询多、遍历多 | 队列、双端队列、已定位节点的插删 |

## 4. Set：去重集合

`Set` 的核心语义是不允许重复元素。不同实现的区别主要在于是否有序、是否排序，以及底层结构是什么。

### 4.1 HashSet

`HashSet` 底层由 `HashMap` 实现。向 `HashSet` 添加元素时，本质上是把元素作为 `HashMap` 的 key，value 则使用一个固定的占位对象。

因此，`HashSet` 判断元素是否重复依赖两个方法：

- `hashCode()`：先判断哈希值是否可能相同。
- `equals()`：当哈希值相同且不是同一个对象时，继续判断逻辑相等。

`HashSet.add()` 的核心逻辑可以简化理解为：

```java
public boolean add(E e) {
    return map.put(e, PRESENT) == null;
}
```

如果自定义对象要放入 `HashSet` 或作为 `HashMap` 的 key，一定要同时重写 `equals()` 和 `hashCode()`，并保证相等对象的哈希值也相等。

### 4.2 LinkedHashSet

`LinkedHashSet` 在 `HashSet` 的基础上维护插入顺序。它底层通常依赖 `LinkedHashMap`，既能利用哈希表提升查找速度，又能通过链表记录顺序。

适用场景：

- 既要去重，又要保留插入顺序。
- 需要稳定输出顺序的缓存、去重列表、日志处理等场景。

### 4.3 TreeSet

`TreeSet` 底层基于红黑树，元素会按照自然顺序或自定义比较器排序。

适用场景：

- 需要有序去重。
- 需要范围查询，例如 `subSet()`、`headSet()`、`tailSet()`。

注意，`TreeSet` 判断重复依赖比较结果是否为 `0`，而不是只看 `equals()`。如果比较器设计不合理，可能出现看似不同的对象被当成重复元素的问题。

## 5. Map：键值对集合

`Map` 保存的是 key-value 映射。常见实现的选择通常取决于是否需要排序、顺序、并发安全以及查询效率。

| 实现 | 底层结构 | 是否有序 | 典型复杂度 | 适用场景 |
| --- | --- | --- | --- | --- |
| `HashMap` | 数组 + 链表 + 红黑树 | 无序 | 平均 `O(1)` | 通用键值存储 |
| `LinkedHashMap` | 哈希表 + 双向链表 | 插入顺序或访问顺序 | 平均 `O(1)` | LRU、顺序遍历 |
| `TreeMap` | 红黑树 | 按 key 排序 | `O(log n)` | 有序映射、范围查询 |
| `Hashtable` | 哈希表 | 无序 | 平均 `O(1)` | 旧式同步容器，不推荐新代码使用 |
| `ConcurrentHashMap` | 数组 + 链表 + 红黑树 + CAS/锁 | 无序 | 平均 `O(1)` | 高并发键值存储 |

## 6. HashMap 底层原理

### 6.1 JDK 7 与 JDK 8 的结构差异

`HashMap` 的经典面试点是底层结构变化：

- JDK 7：数组 + 链表。
- JDK 8：数组 + 链表 + 红黑树。

JDK 8 引入红黑树的主要目的是降低哈希冲突严重时的查询成本。当某个桶中的链表过长时，查询会从 `O(n)` 退化得很明显；树化后可以优化到 `O(log n)`。

### 6.2 HashMap put 流程

`HashMap` 写入元素时，大致会经过计算哈希、定位数组下标、处理哈希冲突、必要时扩容等步骤。

![HashMap put 流程图](/images/tech-docs/java-collections-hashmap-put-flow.jpeg)

简化流程：

1. 根据 key 计算扰动后的 hash。
2. 如果 table 未初始化，则先初始化数组。
3. 使用 `(n - 1) & hash` 计算数组下标。
4. 如果桶为空，直接创建节点。
5. 如果桶不为空，判断 key 是否相同。
6. 如果是链表，尾插新节点；如果是红黑树，则按树节点插入。
7. 插入后检查是否需要树化或扩容。

### 6.3 hash 函数为什么要高低位异或

JDK 8 中常见的 hash 扰动逻辑如下：

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

`HashMap` 的数组长度通常是 `2` 的幂，定位下标时会使用：

```java
index = (n - 1) & hash;
```

如果只使用低位参与计算，而某些 key 的低位分布不好，就容易集中到同一个桶。高 16 位和低 16 位异或后，高位信息也会参与到低位计算中，能让哈希分布更均匀。

判断两个 key 是否相等时，`HashMap` 通常会先比较 hash 值；如果 hash 值不同，可以直接认为 key 不相等。如果 hash 值相同，再比较引用地址或调用 `equals()` 做最终判断。

### 6.4 哈希冲突解决方式

常见的哈希冲突解决方式有：

- 开放定址法：发生冲突时继续探测其他空位。
- 再哈希法：使用另一个哈希函数重新计算位置。
- 拉链法：数组桶中挂链表或其他结构。

`HashMap` 使用的是拉链法。JDK 8 中，当桶内链表足够长且数组容量达到要求时，会把链表转换成红黑树。

### 6.5 树化与退化阈值

常见阈值：

- 链表节点数大于 `8`，且数组长度大于等于 `64` 时，链表会树化。
- 红黑树节点数小于 `6` 时，会退化为链表。
- 如果链表长度超过阈值但数组长度还小于 `64`，优先扩容，而不是立即树化。

这样设计是因为：数组太小时，冲突可能主要来自容量不足，扩容比树化更直接；数组已经足够大时，冲突更可能来自 key 的哈希分布问题，此时树化更有价值。

## 7. HashMap 扩容机制

`HashMap` 的默认负载因子是 `0.75`。当元素数量超过 `capacity * loadFactor` 时，会触发扩容。

默认规则：

- 默认初始容量通常为 `16`。
- 默认负载因子为 `0.75`。
- 扩容后容量变为原来的 `2` 倍。
- 容量保持为 `2` 的幂，便于通过位运算计算下标。

`resize()` 的核心流程可以概括为：创建新数组、更新阈值、遍历旧数组、迁移节点。如果桶为空则跳过；如果桶里只有一个节点，直接计算新位置；如果桶里是红黑树，则拆分树节点；如果桶里是链表，则按低位链表和高位链表拆分。

JDK 8 扩容迁移时有一个重要优化：由于新容量是旧容量的两倍，一个节点在新数组中的位置只有两种可能：

- 保留在原索引 `j`。
- 移动到 `j + oldCap`。

判断依据是：

```java
(e.hash & oldCap) == 0
```

如果结果为 `0`，节点留在原索引；否则移动到原索引加旧容量的位置。这样不需要对每个节点重新完整计算哈希下标。

## 8. HashMap 是否线程安全

`HashMap` 不是线程安全的。多线程环境下并发读写可能出现以下问题：

- 多个线程同时 `put`，可能造成数据覆盖或丢失。
- 一个线程 `put`，另一个线程 `get`，可能读到中间状态。
- JDK 7 中并发扩容可能形成环形链表，导致查询时死循环。

解决方式：

- 使用 `Collections.synchronizedMap()` 包装。
- 使用 `ConcurrentHashMap`。
- 在业务层使用外部锁保护。
- 如果读多写少且数据量不大，可以考虑复制快照或不可变 Map。

新代码中，面向高并发场景通常优先考虑 `ConcurrentHashMap`，而不是 `Hashtable`。

## 9. ConcurrentHashMap

`ConcurrentHashMap` 是并发场景下最常用的 Map 实现。

### 9.1 JDK 7 与 JDK 8 的实现差异

JDK 7 中，`ConcurrentHashMap` 采用分段锁思想，底层由多个 `Segment` 组成，每个 `Segment` 类似一个小型哈希表，写操作锁住对应分段。

JDK 8 中，`ConcurrentHashMap` 取消了 `Segment` 数组结构，整体结构更接近 `HashMap`：

- 数组 + 链表 + 红黑树。
- 通过 CAS 初始化或插入空桶。
- 对非空桶的写操作使用 `synchronized` 锁住桶头节点。
- 读操作多数情况下不加锁，依赖 `volatile` 和内存可见性保证。

### 9.2 ConcurrentHashMap 的特点

核心特点：

- 不允许 key 或 value 为 `null`。
- 迭代器是弱一致性的，不会像 fail-fast 迭代器那样因为并发修改立刻抛异常。
- 适合高并发读写，但不代表复合操作天然原子。

例如下面的写法不是严格原子的：

```java
if (!map.containsKey(key)) {
    map.put(key, value);
}
```

应优先使用：

```java
map.putIfAbsent(key, value);
```

## 10. fail-fast 与 fail-safe

### 10.1 fail-fast

fail-fast 是快速失败机制。遍历集合时，迭代器会记录一个期望修改次数 `expectedModCount`。如果遍历过程中集合结构被外部修改，实际的 `modCount` 与期望值不一致，就会抛出 `ConcurrentModificationException`。

典型容器：

- `ArrayList`
- `HashMap`
- `HashSet`
- 大部分 `java.util` 包下的非并发集合

示例：

```java
List<String> list = new ArrayList<>();
list.add("a");
list.add("b");

for (String item : list) {
    if ("a".equals(item)) {
        list.remove(item); // 可能触发 ConcurrentModificationException
    }
}
```

正确方式可以使用迭代器自身的 `remove()`：

```java
Iterator<String> iterator = list.iterator();
while (iterator.hasNext()) {
    String item = iterator.next();
    if ("a".equals(item)) {
        iterator.remove();
    }
}
```

### 10.2 fail-safe

fail-safe 通常指遍历时不直接在原集合结构上迭代，而是在副本或弱一致视图上迭代，因此不会因为并发修改立即抛出 `ConcurrentModificationException`。

典型容器：

- `CopyOnWriteArrayList`
- `ConcurrentHashMap`
- `BlockingQueue` 的一些实现

需要注意，fail-safe 不等于一定能看到最新数据。比如 `CopyOnWriteArrayList` 的迭代器遍历的是创建迭代器那一刻的数组快照。

## 11. 线程安全的 List 实现方案

常见方案：

- `Collections.synchronizedList(new ArrayList<>())`
- `CopyOnWriteArrayList`
- 外部加锁
- 使用不可变集合

`Collections.synchronizedList()` 会为方法调用加同步，但复合操作仍然需要额外同步。例如边遍历边修改时，应手动对列表对象加锁。

`CopyOnWriteArrayList` 适合读多写少场景。它的写操作会复制底层数组，因此写入成本高；但读操作不加锁，迭代也稳定。

## 12. Queue 与 Deque

`Queue` 表示队列，典型语义是先进先出。常见实现包括：

- `LinkedList`：可作为队列或双端队列使用。
- `ArrayDeque`：数组实现的双端队列，通常比 `Stack` 更推荐用于栈和队列场景。
- `PriorityQueue`：优先队列，底层通常是堆，不保证整体有序，只保证队头元素优先级最高。
- `BlockingQueue`：阻塞队列，常用于生产者-消费者模型。

常见方法对比：

| 操作 | 抛异常方法 | 返回特殊值方法 |
| --- | --- | --- |
| 入队 | `add(e)` | `offer(e)` |
| 出队 | `remove()` | `poll()` |
| 查看队头 | `element()` | `peek()` |

一般业务代码更推荐使用 `offer()`、`poll()`、`peek()`，因为它们在失败时通过返回值表达结果，不会直接抛异常。

## 13. TreeMap 与红黑树

`TreeMap` 底层是红黑树，key 会按照自然顺序或比较器顺序排列。

特点：

- 查找、插入、删除时间复杂度为 `O(log n)`。
- 支持有序遍历。
- 支持范围查询。
- key 必须可比较，或者构造 `TreeMap` 时传入 `Comparator`。

与 `HashMap` 对比：

- `HashMap` 在哈希分布良好时查询效率更高，平均 `O(1)`。
- `TreeMap` 查询是 `O(log n)`，但能维护 key 的排序。
- 如果需要按 key 排序输出，`TreeMap` 比先放入 `HashMap` 再排序更自然。

## 14. Collections 与 Arrays 工具类

集合框架还提供了两个常用工具类：`Collections` 和 `Arrays`。

常见能力：

- `Collections.sort()`：对 List 排序。
- `Collections.binarySearch()`：二分查找。
- `Collections.synchronizedList()`：生成同步包装集合。
- `Collections.unmodifiableList()`：生成不可修改视图。
- `Arrays.sort()`：数组排序。
- `Arrays.asList()`：数组转固定大小 List。

`Arrays.asList()` 有一个常见坑：它返回的是数组的固定大小视图，不能执行 `add()` 或 `remove()`，否则会抛出 `UnsupportedOperationException`。

示例：

```java
List<String> list = Arrays.asList("a", "b");
list.add("c"); // UnsupportedOperationException
```

如果需要可变列表，应写成：

```java
List<String> list = new ArrayList<>(Arrays.asList("a", "b"));
list.add("c");
```

## 15. 常见集合选择建议

| 场景 | 推荐选择 |
| --- | --- |
| 需要按索引快速查询 | `ArrayList` |
| 需要双端队列 | `ArrayDeque` |
| 需要去重，不关心顺序 | `HashSet` |
| 需要去重并保留插入顺序 | `LinkedHashSet` |
| 需要有序去重 | `TreeSet` |
| 普通键值存储 | `HashMap` |
| 保留插入顺序或实现 LRU | `LinkedHashMap` |
| 按 key 排序 | `TreeMap` |
| 高并发 Map | `ConcurrentHashMap` |
| 读多写少 List | `CopyOnWriteArrayList` |
| 生产者-消费者模型 | `BlockingQueue` |

## 16. 高频面试题速记

### 16.1 ArrayList 和 LinkedList 有什么区别

答题思路：

- 先说底层结构：`ArrayList` 是动态数组，`LinkedList` 是双向链表。
- 再说访问效率：`ArrayList` 支持随机访问，`LinkedList` 不支持。
- 再说增删：`ArrayList` 中间增删要移动元素，`LinkedList` 定位后改指针即可。
- 最后补充实际选择：大多数普通列表场景优先使用 `ArrayList`；队列场景优先考虑 `ArrayDeque`。

### 16.2 HashMap 为什么容量是 2 的幂

原因：

- 可以用 `(n - 1) & hash` 替代取模，效率更高。
- 当容量为 `2` 的幂时，`n - 1` 的二进制低位全是 `1`，能更好地利用 hash 的低位。
- 扩容为两倍后，元素迁移只需要判断一个新增高位，位置要么不变，要么移动到 `原索引 + oldCap`。

### 16.3 HashMap 什么时候树化

桶内链表节点数超过阈值后，且数组容量达到 `64`，才会树化。否则优先扩容。

树化不是越早越好。红黑树节点更重，维护成本也更高；在数据量较小时，扩容通常更划算。

### 16.4 HashMap 为什么不是线程安全的

因为它没有对并发写做同步保护。多个线程同时修改底层数组、链表或红黑树时，可能出现数据覆盖、结构异常或读取中间状态。

### 16.5 HashSet 如何判断元素重复

`HashSet` 本质上调用 `HashMap.put()`。判断重复时先看 hash，再看 key 是否相等。自定义对象要正确重写 `equals()` 和 `hashCode()`。

### 16.6 ConcurrentHashMap 读操作为什么通常不加锁

它通过 `volatile`、CAS 和节点结构设计保证可见性。读操作大多只需要读取当前可见的数组和节点，不必像写操作一样加锁。

但这不意味着所有组合逻辑都是原子的。涉及“先判断再修改”的场景，应使用 `putIfAbsent()`、`computeIfAbsent()` 等原子方法。

## 17. 复习总结

Java 集合的主线可以压缩成几句话：

- `List` 关注顺序和重复，`ArrayList` 查询快，`LinkedList` 更偏链表和双端队列语义。
- `Set` 关注去重，`HashSet` 依赖 `HashMap`，`TreeSet` 依赖红黑树排序。
- `Map` 关注 key-value，`HashMap` 是最常用实现，`TreeMap` 适合排序，`ConcurrentHashMap` 适合并发。
- `HashMap` 的核心是哈希扰动、数组下标定位、冲突链表、红黑树、负载因子和扩容迁移。
- fail-fast 代表快速发现并发修改，fail-safe 代表遍历过程对并发修改更宽容，但不保证总能看到最新数据。

掌握这些结构和权衡后，集合相关问题基本都能从“底层结构 -> 时间复杂度 -> 线程安全 -> 使用场景”这条链路回答。
