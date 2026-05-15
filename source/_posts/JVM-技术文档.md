---
title: JVM
date: 2026-05-14 10:00:00
---
# 内存模型、类加载、GC 与调优实战

## 1. JVM 整体视图

Java 程序从源码到运行，大致经历以下链路：

```text
Java 源码 -> javac 编译 -> .class 字节码 -> 类加载子系统 -> 运行时数据区 -> 执行引擎
```

JVM 的核心组成可以按功能拆成四块：

| 组成 | 作用 |
| --- | --- |
| 类加载子系统 | 加载、验证、准备、解析、初始化 class 文件 |
| 运行时数据区 | 管理线程、对象、类元数据、方法调用等运行时内存 |
| 执行引擎 | 解释执行、JIT 编译、垃圾回收 |
| 本地接口 | 通过 JNI 调用本地方法和本地库 |

理解 JVM 时，可以抓住三条主线：

1. 一个类如何被加载到 JVM。
2. 一个对象如何被创建、布局、引用和回收。
3. 当内存、CPU、GC 出问题时如何定位。

## JVM 核心知识图谱

下图概括了本文中最核心的几组知识：运行时数据区、对象创建流程、类加载生命周期、可达性分析、GC 算法和 G1 收集器。

![JVM 核心知识图谱](/images/tech-docs/jvm-core-map.png)

## 2. 运行时数据区

JVM 运行时数据区主要包括程序计数器、Java 虚拟机栈、本地方法栈、堆、方法区。直接内存不是 JVM 规范中的运行时数据区，但在 NIO 和高性能服务中非常重要。

### 2.1 程序计数器

程序计数器也叫 PC Register，用于记录当前线程正在执行的字节码指令地址。

关键特征：

- 线程私有，每个线程都有自己的程序计数器。
- 执行 Java 方法时，记录下一条 JVM 指令地址。
- 执行 Native 方法时，值通常为空或未定义，取决于具体 JVM 实现。
- 这是 JVM 规范中唯一不会出现 `OutOfMemoryError` 的运行时数据区。

程序计数器很小，但它支撑了线程切换后的恢复执行。线程被 CPU 挂起后再次获得时间片时，JVM 可以根据程序计数器继续从正确的指令位置执行。

### 2.2 Java 虚拟机栈

Java 虚拟机栈是线程私有的，描述 Java 方法调用的内存模型。每一次方法调用都会创建一个栈帧，方法执行结束后对应栈帧出栈。

栈帧通常包含：

| 组成 | 作用 |
| --- | --- |
| 局部变量表 | 存放方法参数和局部变量 |
| 操作数栈 | 字节码指令执行时的临时计算区 |
| 动态链接 | 指向运行时常量池中该方法所属符号引用的解析结果 |
| 方法返回地址 | 记录方法正常返回或异常退出后的控制流位置 |

常见异常：

- `StackOverflowError`：栈深度超过限制，常见于递归过深。
- `OutOfMemoryError`：线程过多或栈空间申请失败时可能出现。

局部变量线程安全问题需要分情况看：

- 如果局部变量是基本类型，或引用对象没有逃出当前方法，一般是线程安全的。
- 如果局部变量引用了共享对象，并且对象逃出了方法作用域，则仍然需要考虑线程安全。

相关参数：

```bash
-Xss256k
-Xss1m
```

`-Xss` 控制每个线程栈大小。栈越大，单线程可承受的调用深度越高，但同一进程可创建的线程数会减少。

### 2.3 本地方法栈

本地方法栈服务于 Native 方法调用，和 Java 虚拟机栈类似，只是面向 JNI、本地库和操作系统级调用。

在 HotSpot 中，虚拟机栈和本地方法栈的实现通常联系很紧密。排查本地方法导致的问题时，需要结合崩溃日志、JNI 调用、系统库和 Native Memory Tracking。

### 2.4 堆

堆是 JVM 中最大的一块内存区域，几乎所有对象实例和数组都会在堆中分配。堆是线程共享的，也是垃圾回收器管理的主要区域。

关键特征：

- 通过 `new` 创建的对象通常进入堆。
- 堆中的对象需要考虑线程安全，因为多个线程可能共享同一个对象。
- 堆由 GC 管理，出现问题时常见异常是 `java.lang.OutOfMemoryError: Java heap space`。

常用参数：

```bash
-Xms2g
-Xmx2g
```

`-Xms` 是初始堆大小，`-Xmx` 是最大堆大小。生产环境常把两者设置为相同值，避免运行过程中堆扩缩容造成额外抖动。

### 2.5 方法区与元空间

方法区是 JVM 规范概念，用于存储类相关信息，例如类元数据、字段、方法、运行时常量池等。HotSpot 在不同 JDK 版本中实现不同：

| 版本 | 实现方式 | 说明 |
| --- | --- | --- |
| JDK 7 及之前 | 永久代 PermGen | 位于 JVM 管理内存中，容易因类过多出现 `PermGen space` |
| JDK 8 及之后 | 元空间 Metaspace | 使用本地内存，类元数据移入元空间 |

需要注意：

- 字符串常量池在 JDK 7 后已经移到堆中。
- 元空间使用本地内存，不受 `-Xmx` 直接限制。
- 如果动态生成类过多、类加载器泄漏，可能出现 `OutOfMemoryError: Metaspace`。

相关参数：

```bash
-XX:MetaspaceSize=256m
-XX:MaxMetaspaceSize=512m
```

### 2.6 运行时常量池

运行时常量池是方法区的一部分，来源于 class 文件中的常量池。类加载后，class 文件常量池中的字面量和符号引用会进入运行时常量池。

它主要保存：

- 类和接口的全限定名。
- 字段名和描述符。
- 方法名和描述符。
- 字符串、数字等字面量。
- 符号引用到直接引用的解析结果。

字节码指令会通过运行时常量池定位类、方法、字段等信息。类加载的解析阶段会把符号引用替换为可以直接访问目标的引用。

### 2.7 StringTable

`StringTable` 用于管理字符串驻留。它是一个哈希表结构，保存字符串对象引用。

常见规则：

- 字符串字面量会进入字符串常量池。
- `String.intern()` 会尝试把字符串对象放入池中，并返回池中的引用。
- JDK 7 之后，字符串常量池位于堆中。

示例：

```java
String a = "hello";
String b = "hello";
System.out.println(a == b); // true

String c = new String("hello");
System.out.println(a == c); // false
System.out.println(a == c.intern()); // true
```

不要为了“省内存”盲目调用 `intern()`。如果高基数字符串被大量驻留，反而会增加堆压力和 GC 压力。

### 2.8 直接内存

直接内存常见于 NIO 场景，例如 `ByteBuffer.allocateDirect()`。它分配在 JVM 堆外，可以减少 Java 堆和 Native 内存之间的数据复制。

特点：

- 读写性能通常较好，适合 IO 缓冲区。
- 分配和释放成本较高。
- 不受普通堆 GC 直接管理。
- 释放依赖 Cleaner、虚引用和 ReferenceHandler 等机制。

相关参数：

```bash
-XX:MaxDirectMemorySize=1g
```

直接内存泄漏可能表现为：

```text
java.lang.OutOfMemoryError: Direct buffer memory
```

排查时可以结合：

```bash
jcmd <pid> VM.native_memory summary
jcmd <pid> VM.native_memory detail
```

需要先打开 Native Memory Tracking：

```bash
-XX:NativeMemoryTracking=summary
```

## 3. 对象创建与内存布局

### 3.1 对象创建流程

执行 `new` 指令时，JVM 大致会做这些事情：

1. 检查类是否已经加载、解析和初始化。
2. 如果没有加载，先触发类加载。
3. 在堆中为对象分配内存。
4. 将分配到的内存初始化为零值。
5. 设置对象头，例如 Mark Word、类型指针。
6. 执行构造方法 `<init>`，完成业务字段初始化。

对象分配常见方式：

| 方式 | 适用场景 |
| --- | --- |
| 指针碰撞 | 堆内存规整，空闲区域连续 |
| 空闲列表 | 堆内存不规整，需要维护可用内存块列表 |
| TLAB | 给每个线程分配一小块私有堆空间，减少多线程分配竞争 |

TLAB 全称 Thread Local Allocation Buffer。大多数对象会优先在线程自己的 TLAB 中分配，分配失败再走慢路径。

### 3.2 对象内存布局

HotSpot 中普通对象大致由三部分组成：

| 区域 | 内容 |
| --- | --- |
| 对象头 | Mark Word、类型指针，数组对象还包含数组长度 |
| 实例数据 | 对象字段的实际数据 |
| 对齐填充 | 保证对象大小按机器要求对齐 |

对象头说明：

- Mark Word 存放哈希码、GC 年龄、锁状态等信息。
- 类型指针指向类元数据，用于确定对象属于哪个类。
- 开启压缩指针后，64 位 JVM 中对象头和引用大小会减少。

一个对象不一定总是物理分配在堆上。JIT 可能通过逃逸分析判断对象不会逃出方法，从而进行标量替换、锁消除等优化。实际排查时仍然应以 JVM 日志和分析工具结果为准。

## 4. 类加载机制

### 4.1 类生命周期

类从加载到卸载通常经历：

```text
加载 -> 验证 -> 准备 -> 解析 -> 初始化 -> 使用 -> 卸载
```

其中验证、准备、解析统称为链接。

### 4.2 加载

加载阶段做三件事：

1. 通过类的全限定名获取二进制字节流。
2. 将字节流表示的静态结构转换为方法区中的运行时数据结构。
3. 在堆中生成代表该类的 `java.lang.Class` 对象，作为访问类元数据的入口。

HotSpot 中，类元数据位于元空间，而 `java.lang.Class` 镜像对象位于堆中。

### 4.3 验证、准备、解析

验证阶段确保 class 文件符合 JVM 规范，避免非法字节码破坏 JVM 安全。

准备阶段为类变量分配内存并设置默认值：

```java
public static int count = 10;
```

准备阶段后，`count` 先是默认值 `0`，真正赋值为 `10` 发生在初始化阶段。

如果是编译期常量：

```java
public static final int SIZE = 10;
```

这类常量可能在准备阶段就得到常量值。

解析阶段把符号引用替换为直接引用。例如把“某个类的某个方法”这种符号描述，解析成 JVM 可直接定位的引用。

### 4.4 初始化触发条件

类初始化本质上是执行类构造器 `<clinit>`，也就是静态变量赋值和静态代码块。

会触发初始化的典型场景：

- 执行 `new` 创建对象。
- 读取或设置类的静态字段，编译期常量除外。
- 调用类的静态方法。
- 反射调用类。
- 初始化子类时，如果父类尚未初始化，会先初始化父类。
- JVM 启动时初始化包含 `main` 方法的主类。

不会触发初始化的典型场景：

- 访问 `static final` 编译期常量。
- 通过数组定义引用类。
- 使用 `ClassLoader.loadClass()` 但不主动使用类。
- `Class.forName(name, false, loader)` 中 `initialize` 参数为 `false`。

### 4.5 双亲委派模型

双亲委派模型的核心规则：

1. 类加载请求先交给父加载器。
2. 父加载器无法加载时，子加载器才尝试加载。
3. 核心类库通常由顶层加载器加载，避免重复加载和安全问题。

常见类加载器：

| 类加载器 | 作用 |
| --- | --- |
| Bootstrap ClassLoader | 加载 Java 核心类库 |
| Platform ClassLoader | 加载平台相关模块，JDK 9 后替代部分扩展类加载职责 |
| Application ClassLoader | 加载应用 classpath 或 module path 下的类 |
| 自定义 ClassLoader | 插件化、热部署、隔离加载等场景 |

双亲委派不是绝对不能打破。JDBC、SPI、OSGi、应用服务器、插件系统都可能使用特殊的类加载策略。破坏双亲委派时需要特别关注类隔离、类冲突和类加载器泄漏。

## 5. Java 内存模型与并发可见性

JVM 内存区域关注“运行时内存如何划分”，Java 内存模型 JMM 关注“多线程共享数据时如何保证可见性、有序性和原子性”。

### 5.1 三个核心问题

| 问题 | 含义 |
| --- | --- |
| 原子性 | 一个操作是否不可分割 |
| 可见性 | 一个线程修改的值，其他线程是否能及时看到 |
| 有序性 | 编译器和 CPU 重排序是否影响程序语义 |

### 5.2 synchronized

`synchronized` 可以保证：

- 互斥访问，也就是同一时刻只有一个线程进入临界区。
- 进入锁和退出锁之间的 happens-before 关系。
- 临界区内共享变量对后续获得同一把锁的线程可见。

缺点是粒度过大时性能较低，容易造成线程阻塞。现代 JVM 对 `synchronized` 做了大量优化，但仍要避免把耗时 IO、远程调用放入锁内。

### 5.3 volatile

`volatile` 可以保证：

- 变量写入对其他线程可见。
- 禁止特定类型的指令重排序。

但 `volatile` 不能保证复合操作的原子性：

```java
volatile int count = 0;
count++; // 不是原子操作
```

### 5.4 双重检查锁

双重检查锁实现单例时，需要使用 `volatile` 防止指令重排序：

```java
public final class Singleton {
    private static volatile Singleton instance;

    private Singleton() {
    }

    public static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) {
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

如果没有 `volatile`，对象引用赋值可能与构造初始化发生重排序，其他线程可能看到一个“引用非空但尚未完全初始化”的对象。

## 6. 垃圾回收基础

### 6.1 如何判断对象可回收

现代 JVM 通常使用可达性分析，而不是引用计数。

可达性分析从 GC Roots 出发，沿引用链查找所有可达对象。无法从 GC Roots 到达的对象，就可能被回收。

常见 GC Roots：

- 虚拟机栈中局部变量表引用的对象。
- 本地方法栈中 JNI 引用的对象。
- 方法区中类静态属性引用的对象。
- 运行时常量池引用的对象。
- 被同步锁持有的对象。
- JVM 内部引用，例如 Class 对象、系统类加载器等。

### 6.2 引用类型

Java 中引用强度从强到弱大致如下：

| 类型 | 回收规则 | 典型用途 |
| --- | --- | --- |
| 强引用 StrongReference | 只要可达就不会被 GC 回收 | 普通对象引用 |
| 软引用 SoftReference | 内存不足时可能回收 | 缓存，但现代服务中慎用 |
| 弱引用 WeakReference | 下一次 GC 会回收 | ThreadLocalMap、规范化映射 |
| 虚引用 PhantomReference | 不影响生命周期，用于回收通知 | 直接内存清理、资源释放跟踪 |
| 终结器引用 FinalReference | 与 `finalize()` 相关 | 不推荐使用 |

`finalize()` 不可靠、不可控、性能差，应避免用于资源释放。资源释放优先使用 `try-with-resources`、显式 `close()` 或 Cleaner 等机制。

### 6.3 垃圾回收算法

| 算法 | 优点 | 缺点 | 典型区域 |
| --- | --- | --- | --- |
| 标记-清除 | 实现简单，不移动对象 | 产生内存碎片 | 老年代、CMS |
| 标记-整理 | 无碎片 | 移动对象成本高 | 老年代 |
| 复制 | 无碎片，分配快 | 需要额外空间 | 新生代 |

标记-清除流程：

```text
标记可达对象 -> 清除不可达对象
```

标记-整理流程：

```text
标记可达对象 -> 移动存活对象 -> 清理边界外空间
```

复制算法流程：

```text
from 区存活对象 -> 复制到 to 区 -> 清空 from 区 -> 交换 from/to
```

### 6.4 分代垃圾回收

分代理论基于两个经验：

- 大部分对象朝生夕死。
- 熬过多次 GC 的对象更可能继续存活。

传统堆结构：

```text
新生代 = Eden + Survivor From + Survivor To
老年代 = 长期存活对象、大对象等
```

对象通常先分配在 Eden。Minor GC 后仍存活的对象会进入 Survivor 区并增加年龄。年龄达到阈值后晋升到老年代。HotSpot 对象年龄通常由对象头中的 age 字段记录，最大年龄常见为 15。

对象进入老年代的常见原因：

- 年龄达到晋升阈值。
- 大对象直接进入老年代。
- Survivor 空间不足，担保分配进入老年代。
- 动态年龄判断触发提前晋升。

动态年龄判断示例：

```text
如果 Survivor 中相同年龄对象大小总和超过 Survivor 空间的一半，
则年龄大于或等于该年龄的对象可以直接进入老年代。
```

### 6.5 GC 类型

| 类型 | 含义 |
| --- | --- |
| Minor GC / Young GC | 新生代回收 |
| Major GC / Old GC | 老年代回收，CMS 中常见叫法 |
| Mixed GC | G1 中同时回收新生代和部分老年代 Region |
| Full GC | 回收整个 Java 堆和方法区相关空间，通常代价最高 |

Full GC 常见触发原因：

- 老年代空间不足。
- 元空间不足。
- 显式调用 `System.gc()`。
- Minor GC 后晋升对象大小超过老年代可用空间。
- 堆内存碎片或连续空间不足。

生产环境通常需要关注 Full GC，因为它往往伴随较长 STW。

## 7. 垃圾回收器

### 7.1 收集器选型目标

不同收集器关注的目标不同：

| 目标 | 解释 | 典型场景 |
| --- | --- | --- |
| 吞吐量优先 | 更多 CPU 时间用于业务线程 | 后台计算、批处理 |
| 响应时间优先 | 尽量降低单次暂停时间 | Web 服务、交易系统 |
| 资源占用优先 | 简单、低开销 | 小应用、客户端工具 |

### 7.2 Serial

Serial 是单线程垃圾回收器，回收时会暂停所有用户线程。

适合：

- 单核或小堆应用。
- 客户端程序。
- 对吞吐和延迟要求不高的场景。

参数：

```bash
-XX:+UseSerialGC
```

### 7.3 Parallel

Parallel 关注吞吐量，使用多线程进行垃圾回收。常与 Parallel Old 搭配。

适合：

- 多核 CPU。
- 后台任务。
- 批处理系统。
- 更关注总运行时间，而不是单次请求延迟。

参数：

```bash
-XX:+UseParallelGC
-XX:+UseParallelOldGC
-XX:ParallelGCThreads=8
-XX:GCTimeRatio=99
-XX:MaxGCPauseMillis=200
```

`GCTimeRatio=99` 表示 GC 时间占比目标约为 `1 / (1 + 99)`。

### 7.4 CMS

CMS 全称 Concurrent Mark Sweep，目标是降低老年代停顿时间。它基于标记-清除算法。

典型阶段：

1. 初始标记，STW。
2. 并发标记，业务线程和 GC 线程并发。
3. 重新标记，STW。
4. 并发清除。

优点：

- 老年代回收大部分阶段与业务线程并发。
- 停顿时间比传统串行老年代收集器更短。

缺点：

- 标记-清除会产生内存碎片。
- 并发阶段会占用 CPU。
- 可能发生 Concurrent Mode Failure，退化为 Full GC。

常见参数：

```bash
-XX:+UseConcMarkSweepGC
-XX:CMSInitiatingOccupancyFraction=70
-XX:+UseCMSInitiatingOccupancyOnly
-XX:+CMSScavengeBeforeRemark
```

CMS 在新版本 JDK 中已经逐步退出主流，历史系统仍然可能大量使用。

### 7.5 G1

G1 全称 Garbage First，目标是在可预测暂停时间内获得较好吞吐。它从 JDK 9 开始成为 HotSpot 默认垃圾回收器。

G1 的核心思想：

- 将堆划分为多个大小相等的 Region。
- 不再严格使用连续的新生代、老年代物理分区。
- 跟踪每个 Region 的垃圾比例和回收收益。
- 优先回收价值最高的 Region。

G1 中 Region 角色包括：

- Eden Region。
- Survivor Region。
- Old Region。
- Humongous Region，大对象区域。

大对象规则：

```text
对象大小超过 Region 一半时，可能作为 Humongous Object 处理。
```

G1 常见阶段：

1. Young GC，回收年轻代 Region。
2. 并发标记，从 GC Roots 开始识别老年代存活对象。
3. Mixed GC，回收年轻代和部分收益较高的老年代 Region。
4. 必要时触发 Full GC，通常表示压力较大或调优不合理。

G1 的重要机制：

- Remembered Set：记录跨 Region 引用。
- Write Barrier：写屏障，维护引用变化。
- SATB：原始快照算法，用于并发标记。
- Pause Prediction：根据停顿目标选择回收集合。

常用参数：

```bash
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:G1HeapRegionSize=8m
-XX:InitiatingHeapOccupancyPercent=45
-XX:ParallelGCThreads=8
-XX:ConcGCThreads=2
```

G1 适合：

- 大堆内存。
- 多核服务器。
- 同时关注吞吐和低延迟的服务。
- 希望减少 Full GC 风险的应用。

G1 不适合把 `MaxGCPauseMillis` 设置得过低。目标过激时，G1 可能频繁 GC，吞吐反而下降。

### 7.6 现代低延迟收集器

如果系统对暂停时间非常敏感，可以关注 ZGC 和 Shenandoah。

| 收集器 | 特点 |
| --- | --- |
| ZGC | 低延迟，适合大堆，暂停时间通常很短 |
| Shenandoah | 并发整理，低暂停，部分发行版支持较好 |

这些收集器的收益依赖 JDK 版本、发行版、内存规模和业务特征。生产使用前应通过压测和 GC 日志验证。

## 8. JVM 参数速查

### 8.1 内存参数

| 参数 | 作用 | 示例 |
| --- | --- | --- |
| `-Xms` | 初始堆大小 | `-Xms2g` |
| `-Xmx` | 最大堆大小 | `-Xmx2g` |
| `-Xss` | 单线程栈大小 | `-Xss512k` |
| `-XX:MetaspaceSize` | 元空间初始触发阈值 | `-XX:MetaspaceSize=256m` |
| `-XX:MaxMetaspaceSize` | 元空间最大值 | `-XX:MaxMetaspaceSize=512m` |
| `-XX:MaxDirectMemorySize` | 直接内存最大值 | `-XX:MaxDirectMemorySize=1g` |

### 8.2 GC 参数

| 参数 | 作用 |
| --- | --- |
| `-XX:+UseSerialGC` | 使用 Serial 收集器 |
| `-XX:+UseParallelGC` | 使用 Parallel 收集器 |
| `-XX:+UseG1GC` | 使用 G1 收集器 |
| `-XX:MaxGCPauseMillis` | 期望最大 GC 暂停时间 |
| `-XX:ParallelGCThreads` | 并行 GC 线程数 |
| `-XX:ConcGCThreads` | 并发 GC 线程数 |
| `-XX:InitiatingHeapOccupancyPercent` | G1 并发标记触发阈值 |

### 8.3 日志参数

JDK 8：

```bash
-XX:+PrintGCDetails
-XX:+PrintGCDateStamps
-Xloggc:/path/to/gc.log
```

JDK 9 及之后：

```bash
-Xlog:gc*:file=/path/to/gc.log:time,uptime,level,tags:filecount=10,filesize=100m
```

OOM 自动导出堆转储：

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/path/to/dump
```

## 9. JVM 排障工具

### 9.1 命令行工具

| 工具 | 作用 |
| --- | --- |
| `jps` | 查看 Java 进程 |
| `jstack` | 查看线程栈 |
| `jmap` | 查看堆信息、导出 heap dump |
| `jstat` | 查看 GC、类加载、编译等统计信息 |
| `jcmd` | 综合诊断工具，推荐优先使用 |
| `jhat` | 旧版 heap dump 分析工具，现代场景较少使用 |

常用命令：

```bash
jps -l
jstat -gcutil <pid> 1000 10
jmap -heap <pid>
jmap -dump:format=b,file=heap.hprof <pid>
jstack -l <pid> > thread.txt
jcmd <pid> GC.heap_info
jcmd <pid> Thread.print
jcmd <pid> GC.class_histogram
```

### 9.2 可视化工具

| 工具 | 作用 |
| --- | --- |
| VisualVM | 查看堆、线程、CPU、采样、dump |
| JConsole | 基础 JMX 监控 |
| Java Mission Control | 分析 JFR，适合低开销生产诊断 |
| Eclipse MAT | 分析 heap dump，定位内存泄漏 |

## 10. 典型问题定位流程

### 10.1 CPU 占用过高

Linux 常用流程：

```bash
top
top -Hp <pid>
printf "%x\n" <tid>
jstack -l <pid> > thread.txt
```

然后在 `thread.txt` 中搜索十六进制线程 id，对应 Java 线程栈，定位热点代码。

常见原因：

- 死循环。
- 频繁 GC。
- 锁竞争或自旋。
- 正则、序列化、加密等 CPU 密集计算。
- 线程池任务堆积。

### 10.2 堆内存溢出

现象：

```text
java.lang.OutOfMemoryError: Java heap space
```

定位流程：

1. 开启 OOM dump。
2. 使用 MAT 或 VisualVM 打开 hprof。
3. 查看 Dominator Tree。
4. 找到占用最大对象和 GC Roots 引用链。
5. 判断是正常容量不足还是内存泄漏。

建议参数：

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/data/dumps
```

### 10.3 栈溢出

现象：

```text
java.lang.StackOverflowError
```

常见原因：

- 无终止条件递归。
- 对象相互调用 `toString()`、`equals()`、JSON 序列化。
- AOP 或代理链递归。

处理方式：

- 修复递归终止条件。
- 改成迭代。
- 检查对象互相引用。
- 必要时调整 `-Xss`，但不要只靠加大栈掩盖代码问题。

### 10.4 元空间溢出

现象：

```text
java.lang.OutOfMemoryError: Metaspace
```

常见原因：

- 动态代理、CGLIB、ByteBuddy 生成类过多。
- 热部署或插件系统中 ClassLoader 泄漏。
- 应用频繁加载但不卸载类。

定位方式：

```bash
jcmd <pid> GC.class_histogram
jcmd <pid> VM.classloader_stats
```

处理思路：

- 限制动态类生成数量。
- 修复 ClassLoader 引用链。
- 设置合理的 `MaxMetaspaceSize`，让问题尽早暴露。

### 10.5 直接内存溢出

现象：

```text
java.lang.OutOfMemoryError: Direct buffer memory
```

常见原因：

- NIO DirectByteBuffer 未及时释放。
- Netty direct memory 配置过大或泄漏。
- 堆外缓存没有上限。

定位方式：

```bash
jcmd <pid> VM.native_memory summary
jcmd <pid> VM.native_memory detail
```

处理思路：

- 配置 `-XX:MaxDirectMemorySize`。
- 检查 Netty、NIO、文件映射等堆外内存使用。
- 结合框架自带 leak detector。

### 10.6 频繁 Full GC

排查方向：

- 老年代是否增长过快。
- 大对象是否直接进入老年代。
- Survivor 是否过小导致对象提前晋升。
- 是否有显式 `System.gc()`。
- 元空间是否频繁扩容。
- G1 是否存在 Humongous Object 过多。

基础观察命令：

```bash
jstat -gcutil <pid> 1000
jcmd <pid> GC.heap_info
jcmd <pid> GC.class_histogram
```

GC 日志分析关注：

- Full GC 触发原因。
- Young GC 后晋升大小。
- 老年代使用率变化。
- 单次暂停时间。
- 回收前后堆空间变化。

## 11. 调优原则

JVM 调优不是先改参数，而是先确认目标和证据。

### 11.1 明确目标

常见目标：

- 降低平均延迟。
- 降低 P99 或 P999 延迟。
- 提高吞吐。
- 减少 Full GC。
- 降低内存占用。
- 提升启动速度。

不同目标可能互相冲突。例如降低暂停时间可能牺牲吞吐，提高吞吐可能导致单次暂停变长。

### 11.2 建议流程

1. 收集现状：QPS、RT、CPU、内存、GC 日志、线程数。
2. 复现问题：压测或找到线上稳定触发条件。
3. 分析瓶颈：先判断是业务代码、内存泄漏、GC 还是系统资源。
4. 小步调整：一次只调整少数参数。
5. 对比验证：用相同流量和数据规模观察结果。
6. 固化配置：记录参数、原因和回滚方案。

### 11.3 常见建议

- 服务端应用通常设置 `-Xms` 等于 `-Xmx`。
- 开启 GC 日志，并保留滚动文件。
- 对容器环境，确认 JVM 是否正确识别容器内存限制。
- 不要盲目追求极小 GC 暂停。
- 不要在业务代码中随意调用 `System.gc()`。
- 大对象、缓存、批量查询、一次性加载是堆压力的重要来源。
- 类加载器泄漏、线程池泄漏、ThreadLocal 泄漏比单纯调参更常见。

## 12. 面试与复盘速记

### 12.1 JVM 内存区域

```text
线程私有：程序计数器、Java 虚拟机栈、本地方法栈
线程共享：堆、方法区/元空间
堆外相关：直接内存
```

### 12.2 对象引用

```text
强引用：不会被回收
软引用：内存不足时回收
弱引用：下次 GC 回收
虚引用：用于回收通知
```

### 12.3 GC 算法

```text
标记-清除：会产生碎片
标记-整理：无碎片但移动成本高
复制算法：无碎片但需要额外空间
```

### 12.4 G1 关键词

```text
Region
Remembered Set
Write Barrier
SATB
Young GC
Mixed GC
Humongous Object
MaxGCPauseMillis
```

### 12.5 类加载过程

```text
加载 -> 验证 -> 准备 -> 解析 -> 初始化 -> 使用 -> 卸载
```

### 12.6 HelloWorld 运行时发生了什么

1. `javac` 把 `.java` 编译为 `.class`。
2. JVM 启动，创建运行时数据区。
3. 类加载器加载 `HelloWorld.class`。
4. 验证、准备、解析、初始化主类。
5. 主线程创建栈帧，执行 `main` 方法。
6. 执行引擎解释执行或 JIT 编译热点代码。
7. 对象在堆中分配，方法调用进入虚拟机栈。
8. GC 在合适时机回收不可达对象。

## 13. 推荐生产启动参数模板

以下模板仅作为起点，不能直接替代压测。

JDK 8 G1 示例：

```bash
java \
  -server \
  -Xms2g \
  -Xmx2g \
  -Xss512k \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:MetaspaceSize=256m \
  -XX:MaxMetaspaceSize=512m \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/data/dump \
  -XX:+PrintGCDetails \
  -XX:+PrintGCDateStamps \
  -Xloggc:/data/logs/gc.log \
  -jar app.jar
```

JDK 11 及之后 G1 示例：

```bash
java \
  -server \
  -Xms2g \
  -Xmx2g \
  -Xss512k \
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:MetaspaceSize=256m \
  -XX:MaxMetaspaceSize=512m \
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/data/dump \
  -Xlog:gc*:file=/data/logs/gc.log:time,uptime,level,tags:filecount=10,filesize=100m \
  -jar app.jar
```

容器环境还需要额外关注：

```bash
-XX:MaxRAMPercentage=75
-XX:InitialRAMPercentage=75
```

容器中不要只看 `-Xmx`，还要预留元空间、直接内存、线程栈、JIT CodeCache、本地库等内存。

## 14. 总结

JVM 学习可以从“内存区域、类加载、对象生命周期、GC、排障工具”五个模块建立骨架：

- 内存区域帮助判断问题发生在哪里。
- 类加载解释类何时进入 JVM，以及静态变量何时初始化。
- 对象生命周期串起创建、引用、分配、晋升和回收。
- GC 算法和收集器决定系统吞吐与延迟表现。
- 工具和日志是线上问题定位的依据。

真正的 JVM 调优不是背参数，而是基于证据做取舍。先观察，再定位，再调整，最后验证，这比一次性堆满参数更可靠。
