---
title: JAVA SE
date: 2026-05-14 21:20:00
---

# Java SE 技术文档：类型、面向对象、常用类、IO 与反射

## 1. Java SE 核心知识图谱

下图概括了本文中最核心的几组知识：面向对象、`equals`/`hashCode`、Java IO 模型和反射机制。

![Java SE 核心知识图谱](/images/tech-docs/javase-core-map.png)

## 2. 类型转换

Java 的基本数据类型之间存在自动类型转换和强制类型转换。

### 2.1 自动类型转换

当把范围较小的数值或变量赋给范围较大的变量时，会发生自动类型转换。

示例：

```java
int a = 10;
long b = a;
double c = b;
```

常见方向：

```text
byte -> short -> int -> long -> float -> double
char -> int -> long -> float -> double
```

注意，`float` 的表示范围比 `long` 大，但精度不一定更高。自动转换不代表完全无损。

### 2.2 强制类型转换

当把范围较大的类型转换为范围较小的类型时，需要强制转换。

```java
double d = 12.8;
int i = (int) d; // 12
```

风险：

- 可能丢失小数部分。
- 可能发生溢出。
- 可能损失精度。

示例：

```java
int x = 130;
byte y = (byte) x;
System.out.println(y); // -126
```

这是因为 `byte` 只能表示 `-128` 到 `127`，强转后发生了截断。

## 3. 数值精度与 BigDecimal

浮点数使用二进制表示，很多十进制小数无法被精确表示，因此直接用 `double` 或 `float` 做金额计算容易出错。

示例：

```java
System.out.println(0.1 + 0.2); // 0.30000000000000004
```

### 3.1 如何保证金额精度

常见方式：

- 使用 `BigDecimal`。
- 将金额统一转换为整数单位计算，例如分。
- 明确舍入模式。
- 避免使用 `new BigDecimal(double)`。

推荐写法：

```java
BigDecimal a = new BigDecimal("0.1");
BigDecimal b = new BigDecimal("0.2");
BigDecimal result = a.add(b);
System.out.println(result); // 0.3
```

不推荐：

```java
BigDecimal bad = new BigDecimal(0.1);
```

因为 `0.1` 在传入构造方法前已经是一个不精确的 `double`。

### 3.2 BigDecimal 常见注意点

除法要指定精度和舍入模式：

```java
BigDecimal a = new BigDecimal("10");
BigDecimal b = new BigDecimal("3");
BigDecimal c = a.divide(b, 2, RoundingMode.HALF_UP);
System.out.println(c); // 3.33
```

比较大小推荐使用 `compareTo`：

```java
new BigDecimal("1.0").equals(new BigDecimal("1.00")); // false
new BigDecimal("1.0").compareTo(new BigDecimal("1.00")); // 0
```

`equals` 会比较数值和精度，`compareTo` 只比较数值大小。

## 4. 面向对象与面向过程

### 4.1 面向过程

面向过程的核心是过程。程序由函数和步骤组成，强调按顺序完成任务。

特点：

- 以函数为中心。
- 适合逻辑简单、流程固定的场景。
- 数据和行为通常分离。
- 代码复用主要依赖函数。

### 4.2 面向对象

面向对象的核心是对象。对象把数据和行为组织在一起，通过对象之间的交互完成任务。

特点：

- 程序结构由类和对象组成。
- 数据和行为封装在对象内部。
- 通过继承和多态提升复用与扩展能力。
- 更适合复杂业务建模。

### 4.3 三大特性

| 特性 | 含义 |
| --- | --- |
| 封装 | 把属性和行为放在对象内部，对外暴露受控接口 |
| 继承 | 子类复用父类能力，并可以扩展或重写 |
| 多态 | 同一接口或父类引用，在运行时表现出不同实现 |

多态示例：

```java
interface Payment {
    void pay();
}

class AliPay implements Payment {
    public void pay() {
        System.out.println("AliPay");
    }
}

class WeChatPay implements Payment {
    public void pay() {
        System.out.println("WeChatPay");
    }
}

Payment payment = new AliPay();
payment.pay();
```

## 5. 面向对象设计原则

常见原则可以用 SOLID 理解：

| 原则 | 含义 |
| --- | --- |
| 单一职责原则 | 一个类只负责一个清晰职责 |
| 开闭原则 | 对扩展开放，对修改关闭 |
| 里氏替换原则 | 子类应能替换父类而不破坏程序正确性 |
| 接口隔离原则 | 不强迫实现类依赖不需要的方法 |
| 依赖倒置原则 | 面向抽象编程，高层模块不依赖低层实现 |

这些原则不是教条。它们的目的都是降低耦合、提高可维护性和扩展性。

## 6. 访问修饰符

Java 常见访问修饰符：

| 修饰符 | 同类 | 同包 | 子类 | 任意位置 |
| --- | --- | --- | --- | --- |
| `private` | 是 | 否 | 否 | 否 |
| default | 是 | 是 | 否 | 否 |
| `protected` | 是 | 是 | 是 | 否 |
| `public` | 是 | 是 | 是 | 是 |

说明：

- `private` 可以修饰变量、方法、构造器，不能修饰外部类。
- default 表示不写访问修饰符，同一包内可见。
- `protected` 对同包和子类可见。
- `public` 对所有类可见。

## 7. 抽象类与接口

### 7.1 抽象类

抽象类用于抽取一类对象的公共属性和行为，可以包含抽象方法，也可以包含普通方法。

特点：

- 使用 `abstract` 修饰。
- 不能直接实例化。
- 可以有构造方法。
- 可以有成员变量。
- 一个类只能继承一个抽象类。

### 7.2 接口

接口用于定义行为规范，强调“能做什么”。

特点：

- 一个类可以实现多个接口。
- 接口中的方法默认是 `public abstract`，Java 8 后可以有默认方法和静态方法。
- 接口中的变量默认是 `public static final`。
- 接口不能有普通构造方法。

### 7.3 对比

| 维度 | 抽象类 | 接口 |
| --- | --- | --- |
| 继承/实现数量 | 单继承 | 多实现 |
| 构造方法 | 可以有 | 没有普通构造方法 |
| 成员变量 | 可以有实例变量 | 默认常量 |
| 设计意图 | 复用公共状态和行为 | 定义能力和规范 |
| 关系表达 | is-a | can-do |

经验上，如果需要复用状态和基础逻辑，用抽象类；如果只是定义能力边界，用接口。

## 8. `==` 与 `equals`

`==` 和 `equals` 的区别：

- 基本数据类型使用 `==` 比较值。
- 引用类型使用 `==` 比较引用地址。
- `Object.equals` 默认也是比较引用地址。
- 类重写 `equals` 后，可以按业务含义比较值。

示例：

```java
String a = new String("hello");
String b = new String("hello");

System.out.println(a == b);      // false
System.out.println(a.equals(b)); // true
```

## 9. 为什么重写 `equals` 必须重写 `hashCode`

哈希容器如 `HashMap`、`HashSet` 查找对象时，通常先通过 `hashCode` 定位桶，再用 `equals` 比较桶内对象。

如果两个对象 `equals` 相等，它们的 `hashCode` 必须相等。

错误示例：

```java
class User {
    private String name;

    @Override
    public boolean equals(Object obj) {
        if (!(obj instanceof User other)) {
            return false;
        }
        return Objects.equals(this.name, other.name);
    }
}
```

只重写 `equals` 不重写 `hashCode`，逻辑上相等的对象可能落在不同桶中，导致 `HashSet` 去重失败或 `HashMap` 查找失败。

推荐使用 IDE 生成，或使用 `Objects.hash`：

```java
@Override
public int hashCode() {
    return Objects.hash(name);
}
```

## 10. 深拷贝与浅拷贝

浅拷贝：

- 创建一个新对象。
- 基本类型字段复制值。
- 引用类型字段复制地址。
- 新旧对象会共享引用字段指向的子对象。

深拷贝：

- 创建一个新对象。
- 递归复制引用字段指向的子对象。
- 新旧对象之间不共享可变子对象。

示例场景：

```java
class User {
    String name;
    Address address;
}
```

如果浅拷贝 `User`，两个 `User` 可能指向同一个 `Address`。修改其中一个用户的地址对象，另一个也会受到影响。

深拷贝实现方式：

- 手动递归复制。
- 拷贝构造方法。
- 序列化和反序列化。
- JSON 转换。
- 第三方工具。

工程中优先使用明确的拷贝构造或工厂方法，避免隐式深拷贝带来的性能和语义问题。

## 11. String、StringBuilder、StringBuffer

| 类型 | 是否可变 | 线程安全 | 适用场景 |
| --- | --- | --- | --- |
| `String` | 不可变 | 安全 | 少量字符串、常量、不可变值 |
| `StringBuilder` | 可变 | 不安全 | 单线程频繁拼接 |
| `StringBuffer` | 可变 | 安全 | 多线程共享拼接，较少使用 |

`String` 不可变的好处：

- 可以安全放入字符串常量池。
- 可以缓存 hash 值。
- 适合作为 `HashMap` key。
- 线程安全。

频繁拼接字符串时：

```java
StringBuilder sb = new StringBuilder();
sb.append("hello");
sb.append(" ");
sb.append("java");
String result = sb.toString();
```

## 12. Object 常见方法

`Object` 是所有 Java 类的根类，常见方法包括：

| 方法 | 作用 |
| --- | --- |
| `equals` | 判断对象是否相等 |
| `hashCode` | 返回对象哈希码 |
| `toString` | 返回对象字符串表示 |
| `clone` | 创建对象副本 |
| `wait` | 让当前线程等待 |
| `notify` | 唤醒一个等待线程 |
| `notifyAll` | 唤醒所有等待线程 |
| `getClass` | 获取运行时 Class 对象 |
| `finalize` | 对象回收前回调，已不推荐 |

`wait`、`notify`、`notifyAll` 必须在持有对象监视器锁时调用，通常放在 `synchronized` 代码块中。

## 13. Java IO 流

Java IO 可以按多个维度分类。

### 13.1 按数据方向

| 类型 | 说明 |
| --- | --- |
| 输入流 | 从外部读取数据到程序 |
| 输出流 | 从程序写出数据到外部 |

### 13.2 按数据单位

| 类型 | 说明 | 常见类 |
| --- | --- | --- |
| 字节流 | 以字节为单位 | `InputStream`、`OutputStream` |
| 字符流 | 以字符为单位 | `Reader`、`Writer` |

字符流适合处理文本，字节流适合处理图片、音频、视频、二进制文件。

### 13.3 按功能

| 类型 | 说明 |
| --- | --- |
| 节点流 | 直接连接数据源 |
| 处理流 | 包装其他流，增强功能 |
| 管道流 | 用于线程间通信 |

示例：

```java
try (BufferedReader reader = new BufferedReader(new FileReader("data.txt"))) {
    String line;
    while ((line = reader.readLine()) != null) {
        System.out.println(line);
    }
}
```

`FileReader` 是节点流，`BufferedReader` 是处理流。

## 14. BIO、NIO、AIO

### 14.1 BIO

BIO 是同步阻塞 IO。

特点：

- 一个连接通常对应一个线程。
- 线程在等待 IO 时不能处理其他任务。
- 编程模型简单。
- 并发连接很多时线程资源消耗大。

### 14.2 NIO

NIO 是同步非阻塞 IO。

核心组件：

- `Buffer`
- `Channel`
- `Selector`

一个线程可以通过 `Selector` 监听多个 `Channel` 的事件，适合高并发网络服务。

### 14.3 AIO

AIO 是异步 IO。

特点：

- 线程发起 IO 请求后立即返回。
- IO 操作完成后通过回调或 Future 通知应用。
- 更接近真正的异步模型。

### 14.4 对比

| 模型 | 等待方式 | 线程模型 | 适用场景 |
| --- | --- | --- | --- |
| BIO | 阻塞等待 | 连接多则线程多 | 简单低并发 |
| NIO | 就绪通知后应用读写 | 少量线程管理多连接 | 高并发网络 |
| AIO | 完成后通知 | 回调或 Future | 异步文件或网络 IO |

## 15. Java 反射

反射是指程序在运行时动态获取和操作类结构的能力，包括类、接口、字段、方法、构造器等。

常见能力：

- 获取类信息。
- 创建对象。
- 访问字段。
- 调用方法。
- 读取注解。

示例：

```java
Class<?> clazz = Class.forName("com.example.User");
Object obj = clazz.getDeclaredConstructor().newInstance();
Method method = clazz.getDeclaredMethod("setName", String.class);
method.invoke(obj, "Tom");
```

典型应用：

- Spring 根据配置或注解创建 Bean。
- AOP 实现方法拦截和增强。
- ORM 框架根据字段映射数据库列。
- 单元测试和工具框架动态调用方法。

反射缺点：

- 性能通常低于直接调用。
- 破坏封装。
- 编译期类型检查能力弱。
- 代码可读性和可维护性下降。

## 16. 成员变量与局部变量

| 维度 | 成员变量 | 局部变量 |
| --- | --- | --- |
| 定义位置 | 类中、方法外 | 方法、构造器或代码块内 |
| 所属对象 | 属于类或实例 | 属于方法调用 |
| 生命周期 | 随类加载或对象创建而存在 | 随方法调用创建，方法结束销毁 |
| 默认值 | 有默认值 | 没有默认值，必须先赋值 |
| 修饰符 | 可用访问修饰符、`static`、`final` | 不能用访问修饰符，可用 `final` |

成员变量如果被 `static` 修饰，则属于类；否则属于实例。

## 17. static 关键字

`static` 表示属于类，而不是属于某个实例。

可以修饰：

- 变量。
- 方法。
- 代码块。
- 内部类。

### 17.1 静态变量

静态变量属于类，所有实例共享一份数据。

```java
class Counter {
    static int count = 0;
}
```

### 17.2 静态方法

静态方法属于类，可以通过类名调用。

```java
Math.max(1, 2);
```

静态方法不能直接访问非静态成员，因为它不依赖具体实例。

### 17.3 静态代码块

静态代码块在类加载时执行一次，常用于初始化静态资源。

```java
static {
    // 初始化静态资源
}
```

## 18. final 关键字

`final` 表示不可改变，但具体含义取决于修饰目标。

| 修饰目标 | 含义 |
| --- | --- |
| 类 | 不能被继承 |
| 方法 | 不能被重写 |
| 基本类型变量 | 赋值后值不能改变 |
| 引用类型变量 | 赋值后不能再指向其他对象 |

注意，`final` 修饰引用变量时，引用不能变，但对象内部状态仍可能改变。

```java
final List<String> list = new ArrayList<>();
list.add("A"); // 可以
// list = new ArrayList<>(); // 不可以
```

## 19. 泛型擦除

泛型擦除指 Java 编译器在编译期间擦除泛型类型信息，并替换为原始类型或限定类型。

示例：

```java
List<String> names = new ArrayList<>();
List<Integer> ages = new ArrayList<>();
System.out.println(names.getClass() == ages.getClass()); // true
```

运行时两者都是 `ArrayList`。

泛型擦除带来的影响：

- 运行时无法直接获取 `List<String>` 中的 `String`。
- 不能创建泛型数组。
- 基本类型不能作为泛型参数，需要使用包装类型。
- 方法重载不能只依赖泛型参数区别。

示例：

```java
// 编译失败：擦除后方法签名相同
// void test(List<String> list) {}
// void test(List<Integer> list) {}
```

泛型的主要价值在编译期：

- 类型检查。
- 减少强制类型转换。
- 提升代码可读性。

## 20. 面试速记

### 20.1 类型转换

```text
小范围到大范围：自动类型转换。
大范围到小范围：强制类型转换，可能溢出或丢精度。
```

### 20.2 BigDecimal

```text
金额计算用 BigDecimal 或整数单位。
推荐 new BigDecimal("0.1")。
除法要指定精度和舍入模式。
比较数值优先用 compareTo。
```

### 20.3 OOP 三大特性

```text
封装、继承、多态。
```

### 20.4 抽象类与接口

```text
抽象类强调公共状态和复用。
接口强调能力规范和多实现。
类只能继承一个抽象类，但可以实现多个接口。
```

### 20.5 equals 与 hashCode

```text
equals 相等，hashCode 必须相等。
hashCode 相等，equals 不一定相等。
重写 equals 必须重写 hashCode。
```

### 20.6 String 系列

```text
String 不可变。
StringBuilder 可变，非线程安全。
StringBuffer 可变，线程安全。
```

### 20.7 IO 模型

```text
BIO：同步阻塞。
NIO：同步非阻塞，多路复用。
AIO：异步 IO，完成后通知。
```

### 20.8 反射

```text
反射是在运行时动态获取类信息、创建对象、访问字段、调用方法的机制。
Spring、AOP、ORM、测试框架都大量使用反射。
```

### 20.9 static 与 final

```text
static 属于类。
final 表示不可变：类不可继承、方法不可重写、变量不可重新赋值。
```

### 20.10 泛型擦除

```text
泛型主要在编译期生效，运行期类型信息会被擦除为原始类型或限定类型。
```

## 21. 总结

Java SE 基础可以按五条主线理解：

1. 类型与数值：类型转换、精度、`BigDecimal`。
2. 面向对象：封装、继承、多态、抽象类、接口。
3. 对象语义：`equals`、`hashCode`、拷贝、`String`。
4. 基础 API：`Object`、IO、BIO/NIO/AIO、反射。
5. 语言机制：作用域、`static`、`final`、泛型擦除。

这些知识点看起来零散，但都直接影响代码正确性、可维护性和框架理解。面试复习时不要只背结论，最好能用一两个代码例子解释每个点的边界和常见坑。

