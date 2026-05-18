---
title: JAVA 并发
date: 2026-05-14 22:32:00
---

# Java 并发技术文档：线程、JMM、锁、AQS、并发容器与线程池

## 1. Java 并发核心知识图谱

Java 并发可以按五条主线学习：线程基础、线程安全三要素、锁与 AQS、并发容器、线程池。面试中很多问题看似分散，本质都能回到这几条主线上。

![Java 并发核心图谱](/images/tech-docs/java-concurrency-core-map.png)

## 2. 线程安全三要素

线程安全通常围绕三个关键词展开：原子性、可见性、有序性。

| 要素 | 含义 | 常见解决方式 |
| --- | --- | --- |
| 原子性 | 一个操作不可被中断，要么全部成功，要么全部失败 | `synchronized`、`Lock`、CAS、原子类 |
| 可见性 | 一个线程修改共享变量后，其他线程能及时看到 | `volatile`、`synchronized`、`final`、锁释放与获取 |
| 有序性 | 程序执行顺序符合预期，不被危险重排序破坏 | `volatile`、锁、happens-before 规则 |

写并发代码时，不要只问“有没有加锁”，更要问这段代码是否同时满足原子性、可见性和有序性。

## 3. 线程与协程

### 3.1 线程是什么

线程是操作系统调度 CPU 的基本执行单元。一个 Java 进程中可以有多个线程，它们共享进程内存空间，但每个线程有自己的程序计数器、虚拟机栈和本地方法栈。

线程适合表达并发任务，但线程不是免费的。创建、销毁、调度和上下文切换都会消耗系统资源。

### 3.2 协程是什么

协程是一种更轻量级的并发单元，通常由程序或运行时自己调度，不直接依赖操作系统内核线程调度。它适合在单线程或少量线程上承载大量 I/O 密集型任务。

协程的关键特点：

- 调度成本更低。
- 更适合 I/O 密集型高并发。
- 通常采用协作式调度。
- 阻塞点需要由运行时管理，否则可能阻塞底层线程。

Java 传统并发以线程和线程池为主。现代 Java 中也可以关注虚拟线程，但理解线程、锁、JMM 和线程池仍然是基础。

## 4. 线程创建方式

Java 中创建线程常见方式有三种：

### 4.1 继承 Thread

```java
class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println("running");
    }
}

new MyThread().start();
```

### 4.2 实现 Runnable

```java
Runnable task = () -> System.out.println("running");
new Thread(task).start();
```

### 4.3 实现 Callable

`Callable` 可以返回结果，也可以抛出异常，通常配合 `FutureTask` 或线程池使用。

```java
Callable<Integer> task = () -> 1 + 1;
FutureTask<Integer> futureTask = new FutureTask<>(task);
new Thread(futureTask).start();

Integer result = futureTask.get();
```

注意，真正启动新线程应调用 `start()`。如果直接调用 `run()`，只是普通方法调用，不会开启新线程。

## 5. 线程生命周期

Java 线程主要有六种状态：`NEW`、`RUNNABLE`、`BLOCKED`、`WAITING`、`TIMED_WAITING`、`TERMINATED`。

![Java 线程生命周期](/images/tech-docs/java-concurrency-thread-lifecycle.png)

简要说明：

- `NEW`：线程对象已创建，但还没有调用 `start()`。
- `RUNNABLE`：可运行状态，包括就绪和运行中。
- `BLOCKED`：等待获取 `synchronized` 监视器锁。
- `WAITING`：无限期等待，需要其他线程唤醒。
- `TIMED_WAITING`：有超时时间的等待。
- `TERMINATED`：线程执行结束。

线程上下文切换是指 CPU 从运行一个线程转向运行另一个线程的过程。频繁切换会带来寄存器保存、恢复、调度、缓存失效等开销。

## 6. 如何停止一个线程

### 6.1 interrupt

`interrupt()` 会把线程的中断标志设置为 `true`，但不会强行杀死线程。线程是否退出，取决于线程自身是否检查并响应中断。

常见写法：

```java
while (!Thread.currentThread().isInterrupted()) {
    doWork();
}
```

当线程处于 `sleep()`、`wait()`、`join()` 等阻塞方法中时，被中断会抛出 `InterruptedException`，同时清除中断标志。通常应恢复中断标志或明确退出。

```java
try {
    Thread.sleep(1000);
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
}
```

### 6.2 stop

`Thread.stop()` 已不推荐使用。它会强制终止线程，可能导致对象状态不一致、锁被异常释放、资源泄露等问题。

推荐方式是使用中断、共享停止标志或线程池的关闭方法。

## 7. 线程间通信方式

常见线程通信方式：

- 共享变量：配合 `volatile` 或锁保证可见性和互斥。
- `wait()` / `notify()` / `notifyAll()`：基于对象监视器的等待通知。
- `Lock` + `Condition`：更灵活的条件队列。
- `BlockingQueue`：生产者-消费者模型的常用选择。
- `CountDownLatch` / `CyclicBarrier` / `Semaphore`：并发协作工具。
- `Exchanger`：两个线程之间交换数据。
- `CompletableFuture`：异步编排和结果传递。

高层并发工具通常比手写 `wait()` / `notify()` 更安全，也更容易维护。

## 8. sleep 和 wait 的区别

| 对比项 | `sleep()` | `wait()` |
| --- | --- | --- |
| 所属类 | `Thread` | `Object` |
| 是否释放锁 | 不释放已持有的锁 | 会释放当前对象监视器锁 |
| 使用前提 | 任意地方可调用 | 必须在同步代码块或同步方法中调用 |
| 唤醒方式 | 时间到或被中断 | `notify()`、`notifyAll()`、超时或被中断 |
| 线程状态 | `TIMED_WAITING` | `WAITING` 或 `TIMED_WAITING` |

`wait()` 通常要放在循环中判断条件，避免虚假唤醒。

```java
synchronized (lock) {
    while (!condition) {
        lock.wait();
    }
    doSomething();
}
```

## 9. Java 内存模型与 happens-before

Java 内存模型简称 JMM，用来定义线程之间如何通过内存进行交互。它关注的核心问题是：一个线程写入共享变量后，另一个线程什么时候能看见。

每个线程可以把共享变量读入自己的工作内存中操作，最终再同步回主内存。如果没有正确的同步手段，不同线程看到的值可能不一致。

常见 happens-before 规则：

- 程序次序规则：同一个线程内，前面的操作先行发生于后面的操作。
- 监视器锁规则：一次 unlock 先行发生于后续对同一把锁的 lock。
- volatile 变量规则：对 volatile 变量的写先行发生于后续对它的读。
- 线程启动规则：`Thread.start()` 先行发生于启动线程中的动作。
- 线程终止规则：线程中的所有操作先行发生于其他线程检测到它已终止。
- 传递性：如果 A 先行发生于 B，B 先行发生于 C，则 A 先行发生于 C。

## 10. volatile

### 10.1 volatile 保证什么

`volatile` 主要保证可见性和一定的有序性，但不保证复合操作的原子性。

例如：

```java
private volatile boolean running = true;
```

一个线程修改 `running = false` 后，其他线程能尽快看到这个变化。

但下面的代码即使用了 `volatile`，也不是线程安全的：

```java
private volatile int count = 0;

public void increment() {
    count++;
}
```

`count++` 包含读取、加一、写回三个步骤，不是一个不可分割的原子操作。

### 10.2 volatile 如何保证可见性

线程写 volatile 变量时，JVM 会在合适位置插入写屏障，将修改刷新到主内存，并阻止前面的普通写被重排序到 volatile 写之后。

线程读 volatile 变量时，JVM 会插入读屏障，使本地缓存中相关变量失效，从主内存读取最新值，并阻止后面的普通读写被重排序到 volatile 读之前。

### 10.3 volatile 如何保证有序性

volatile 的重排序约束可以简化理解为：

- volatile 写之前的操作不能被重排序到 volatile 写之后。
- volatile 读之后的操作不能被重排序到 volatile 读之前。
- 对同一个 volatile 变量的写先行发生于后续读。

## 11. synchronized

### 11.1 synchronized 可以修饰什么

`synchronized` 可以修饰实例方法、静态方法和代码块。

```java
public synchronized void instanceMethod() {
    // 锁是当前对象 this
}

public static synchronized void staticMethod() {
    // 锁是当前 Class 对象
}

public void block() {
    synchronized (this) {
        // 锁是 this
    }
}
```

### 11.2 synchronized 保证什么

`synchronized` 可以同时保证原子性、可见性和有序性。

- 原子性：同一时刻只有一个线程能进入同一把锁保护的临界区。
- 可见性：线程释放锁前的修改，对后续获取同一把锁的线程可见。
- 有序性：锁规则形成 happens-before 关系。

### 11.3 synchronized 锁升级

JDK 早期对 `synchronized` 做了大量优化。常见锁状态包括无锁、偏向锁、轻量级锁、重量级锁。

需要注意，偏向锁在较新 JDK 中已经逐步弱化甚至移除，面试中更重要的是理解优化思路：当没有竞争时尽量降低加锁成本；当出现竞争时逐步升级，必要时进入操作系统互斥量。

常见升级路径可以理解为：

```text
无锁 -> 偏向锁 -> 轻量级锁 -> 重量级锁
```

锁升级通常不可逆，目的是在不同竞争程度下取得性能平衡。

## 12. ReentrantLock 与 AQS

`ReentrantLock` 是 `java.util.concurrent.locks` 包下的可重入锁。它底层依赖 AQS，也就是 `AbstractQueuedSynchronizer`。

![AQS 与 ReentrantLock 工作流程](/images/tech-docs/java-concurrency-aqs-reentrantlock.png)

### 12.1 ReentrantLock 特点

相比 `synchronized`，`ReentrantLock` 提供了更丰富的能力：

- 可重入。
- 可中断获取锁：`lockInterruptibly()`。
- 可尝试获取锁：`tryLock()`。
- 可设置公平锁或非公平锁。
- 可创建多个 `Condition` 条件队列。

### 12.2 公平锁与非公平锁

非公平锁会先尝试让当前线程直接通过 CAS 抢锁，抢不到再进入 AQS 队列。它吞吐量通常更高，但可能让等待时间较长的线程继续等待。

公平锁会先检查 AQS 队列中是否已有前驱节点。如果有，就排队等待；如果没有，才尝试获取锁。它更符合先来先服务，但吞吐量通常低一些。

### 12.3 lock 流程

简化流程：

1. 判断 `state` 是否为 `0`。
2. 非公平锁会先 CAS 抢锁；公平锁会先检查队列前驱。
3. 抢锁成功后，把当前线程设置为 owner，并把 `state` 置为 `1`。
4. 如果当前线程已经持有锁，说明是可重入获取，`state + 1`。
5. 如果锁被其他线程持有，则进入 AQS 队列等待。

### 12.4 unlock 流程

简化流程：

1. 判断当前线程是否是持锁线程。
2. 将 `state - 1`。
3. 如果 `state` 不为 `0`，说明还有重入层数，锁并未真正释放。
4. 如果 `state` 为 `0`，清空 owner。
5. 唤醒 AQS 队列中的后继节点。

## 13. CAS 与原子类

CAS 是 Compare-And-Swap，比较并交换。它通常包含三个值：

- 内存位置 V。
- 预期值 A。
- 新值 B。

只有当 V 的当前值等于 A 时，才把 V 更新为 B；否则更新失败。

典型伪代码：

```text
compareAndSet(V, expected, newValue)
```

Java 中的原子类如 `AtomicInteger`、`AtomicLong`、`AtomicReference` 等都大量使用 CAS。

CAS 常见问题：

- ABA 问题：值从 A 变成 B，又变回 A，CAS 可能误以为没有变化。
- 自旋开销：竞争激烈时不断 CAS 失败，会浪费 CPU。
- 只能直接保证单个变量更新的原子性，复杂一致性仍可能需要锁。

解决 ABA 问题可以使用带版本号的引用，例如 `AtomicStampedReference`。

## 14. ThreadLocal

`ThreadLocal` 用来为每个线程提供独立的变量副本，避免线程之间共享变量带来的竞争。

典型用法：

```java
private static final ThreadLocal<String> LOCAL = new ThreadLocal<>();

public void run() {
    LOCAL.set("value");
    try {
        doWork();
    } finally {
        LOCAL.remove();
    }
}
```

### 14.1 ThreadLocalMap

每个线程内部维护一个 `ThreadLocalMap`。`ThreadLocal` 对象作为 key，线程本地变量作为 value。

`ThreadLocalMap` 的 key 是弱引用。如果 `ThreadLocal` 外部强引用消失，key 可能被 GC 回收，但 value 还被线程持有，尤其在线程池线程长期存活时，可能造成内存泄漏。

因此，在线程池中使用 `ThreadLocal` 时，一定要在 `finally` 中调用 `remove()`。

### 14.2 InheritableThreadLocal

`InheritableThreadLocal` 可以让子线程继承父线程中的变量副本。

但在线程池中要谨慎使用，因为线程池里的线程不是每次任务提交都新建，继承关系可能不符合业务预期。

## 15. ConcurrentHashMap

### 15.1 JDK 7 与 JDK 8 实现差异

JDK 7 中，`ConcurrentHashMap` 使用分段锁。每个 `Segment` 本质上类似一个小型 `HashMap`，写操作锁住对应分段。

JDK 8 中，它改为数组 + 链表 + 红黑树结构，并使用 CAS + `synchronized` 控制并发写。

### 15.2 JDK 8 put 流程

简化流程：

1. 根据 key 计算 hash。
2. 如果 table 未初始化，先初始化。
3. 如果目标桶为空，通过 CAS 插入节点。
4. 如果目标桶不为空，用 `synchronized` 锁住桶头节点。
5. 判断桶中是链表还是红黑树。
6. 如果 key 已存在，则覆盖 value。
7. 如果 key 不存在，则插入新节点。
8. 检查是否需要树化。
9. 检查是否需要扩容。

### 15.3 size 如何统计

`ConcurrentHashMap` 的大小统计不是简单地给一个全局变量加锁。

常见思路：

- 优先尝试 CAS 更新 `baseCount`。
- 如果 CAS 失败，根据线程哈希定位到 `CounterCell`。
- 尝试 CAS 更新对应 `CounterCell` 的 value。
- 总大小约等于 `baseCount + 所有 CounterCell.value 之和`。

这种设计类似分散热点，减少多个线程竞争同一个计数变量。

## 16. CopyOnWriteArrayList

`CopyOnWriteArrayList` 的核心思想是写时复制。

- 读操作不加锁，直接读取当前数组。
- 写操作加锁，并复制一个新数组，在新数组上修改。
- 修改完成后，把引用指向新数组。
- 迭代器遍历的是创建时的快照。

适用场景：

- 读多写少。
- 数据规模不大。
- 需要遍历过程稳定，不希望抛出 `ConcurrentModificationException`。

不适合场景：

- 写操作频繁。
- 集合很大。
- 对实时一致性要求很高。

## 17. BlockingQueue 与生产者-消费者

`BlockingQueue` 是阻塞队列，常用于生产者-消费者模型。

常见实现：

- `ArrayBlockingQueue`：基于数组的有界阻塞队列。
- `LinkedBlockingQueue`：基于链表的阻塞队列，可有界也可无界。
- `PriorityBlockingQueue`：支持优先级的无界阻塞队列。
- `DelayQueue`：延迟队列，元素到期后才能取出。
- `SynchronousQueue`：不存储元素，每个 put 必须等待 take。

常见方法：

| 操作 | 抛异常 | 返回特殊值 | 阻塞 | 超时 |
| --- | --- | --- | --- | --- |
| 插入 | `add()` | `offer()` | `put()` | `offer(e, time, unit)` |
| 移除 | `remove()` | `poll()` | `take()` | `poll(time, unit)` |
| 查看 | `element()` | `peek()` | 无 | 无 |

## 18. 线程池

线程池的意义是复用线程、控制并发规模、统一管理任务生命周期，避免频繁创建和销毁线程。

![ThreadPoolExecutor 执行流程与生命周期](/images/tech-docs/java-concurrency-threadpool-lifecycle.png)

### 18.1 ThreadPoolExecutor 核心参数

| 参数 | 含义 |
| --- | --- |
| `corePoolSize` | 核心线程数 |
| `maximumPoolSize` | 最大线程数 |
| `keepAliveTime` | 非核心线程空闲存活时间 |
| `workQueue` | 任务队列 |
| `threadFactory` | 线程工厂 |
| `handler` | 拒绝策略 |

### 18.2 任务执行流程

线程池收到任务后：

1. 如果当前线程数小于 `corePoolSize`，创建核心线程执行任务。
2. 否则尝试把任务放入 `workQueue`。
3. 如果队列已满，且当前线程数小于 `maximumPoolSize`，创建非核心线程执行任务。
4. 如果仍无法处理，执行拒绝策略。

### 18.3 常见拒绝策略

- `AbortPolicy`：直接抛出 `RejectedExecutionException`，默认策略。
- `CallerRunsPolicy`：由提交任务的线程执行任务。
- `DiscardPolicy`：直接丢弃任务，不抛异常。
- `DiscardOldestPolicy`：丢弃队列中最旧的任务，再尝试提交新任务。

### 18.4 shutdown 与 shutdownNow

`shutdown()` 是平滑关闭：

- 不再接收新任务。
- 已提交任务会尽量执行完。
- 队列中的任务仍会被处理。

`shutdownNow()` 是立即关闭：

- 不再接收新任务。
- 尝试中断正在执行的任务。
- 返回尚未执行的任务列表。

能否真正停止正在执行的任务，仍取决于任务是否响应中断。

## 19. CompletableFuture

`CompletableFuture` 用于异步编排，既可以表示异步计算结果，也可以组合多个异步任务。

常见方法：

- `supplyAsync()`：异步执行有返回值任务。
- `runAsync()`：异步执行无返回值任务。
- `thenApply()`：转换结果。
- `thenAccept()`：消费结果。
- `thenCompose()`：扁平化串联异步任务。
- `thenCombine()`：组合两个异步结果。
- `allOf()`：等待多个任务全部完成。
- `anyOf()`：等待任意一个任务完成。

示例：

```java
CompletableFuture<Integer> future = CompletableFuture
        .supplyAsync(() -> query())
        .thenApply(value -> value + 1)
        .exceptionally(ex -> 0);
```

实际项目中要注意自定义线程池，避免所有异步任务都挤在公共线程池里。

## 20. 死锁排查

死锁通常满足四个条件：

- 互斥条件。
- 请求并保持。
- 不可剥夺。
- 循环等待。

排查方式：

1. 使用 `jps -l` 找到 Java 进程 PID。
2. 使用 `jstack -l <PID>` 导出线程快照。
3. 在快照中查找 `deadlock`、`BLOCKED`、锁对象地址和持锁线程。
4. 分析线程之间的锁等待关系。

常见预防方式：

- 固定加锁顺序。
- 缩小锁粒度。
- 避免持锁执行耗时 I/O。
- 使用 `tryLock()` 设置超时。
- 减少嵌套锁。

## 21. 高频面试题速记

### 21.1 怎么保证线程安全

可以从三要素回答：

- 原子性：使用 `synchronized`、`ReentrantLock`、CAS、原子类。
- 可见性：使用 `volatile`、锁、线程安全容器。
- 有序性：使用 `volatile`、锁、happens-before 规则。

再补充工程实践：

- 尽量使用不可变对象。
- 减少共享状态。
- 优先使用并发工具类。
- 使用线程池管理线程。

### 21.2 synchronized 和 ReentrantLock 的区别

| 维度 | synchronized | ReentrantLock |
| --- | --- | --- |
| 类型 | JVM 关键字 | JDK 类 |
| 释放锁 | 自动释放 | 需要 `unlock()` |
| 可中断 | 不支持等待锁时中断 | 支持 `lockInterruptibly()` |
| 公平性 | 非公平 | 支持公平/非公平 |
| 条件队列 | 一个隐式等待队列 | 可创建多个 `Condition` |
| 使用复杂度 | 简单 | 更灵活，也更容易写错 |

一般场景优先使用 `synchronized`。需要可中断、超时、公平锁或多个条件队列时，再考虑 `ReentrantLock`。

### 21.3 volatile 和 synchronized 的区别

`volatile` 适合状态标记、配置开关、单次发布等场景。它保证可见性和有序性，但不保证复合操作原子性。

`synchronized` 可以保护临界区，同时保证原子性、可见性和有序性，但会引入互斥和阻塞。

### 21.4 ThreadLocal 为什么可能内存泄漏

`ThreadLocalMap` 的 key 是弱引用，value 是强引用。如果 key 被回收，而线程又长期存活，value 可能无法及时释放。

在线程池中使用 `ThreadLocal` 时，应在 `finally` 中调用 `remove()`。

### 21.5 线程池为什么不推荐 Executors

`Executors` 的一些工厂方法隐藏了关键参数，容易带来风险：

- `newFixedThreadPool()` 使用无界队列，任务堆积可能导致 OOM。
- `newCachedThreadPool()` 最大线程数非常大，可能创建过多线程。
- `newSingleThreadExecutor()` 同样可能因为无界队列堆积任务。

更推荐直接使用 `ThreadPoolExecutor`，明确设置核心线程数、最大线程数、队列容量、线程工厂和拒绝策略。

## 22. 复习总结

Java 并发的核心不是背 API，而是理解共享状态如何被多个线程正确访问。

- 线程基础解决“任务如何并发执行”。
- JMM 解决“线程之间如何看见彼此的修改”。
- `volatile` 解决可见性和有序性，但不解决复合原子性。
- `synchronized` 和 `ReentrantLock` 通过互斥保护临界区。
- AQS 是很多同步器的底层框架。
- 并发容器封装了常见共享数据结构的线程安全问题。
- 线程池负责控制线程数量、复用线程、管理任务生命周期。

回答并发问题时，可以按“是否共享状态 -> 是否满足三要素 -> 用什么同步工具 -> 有什么性能和一致性代价”这条链路展开。
