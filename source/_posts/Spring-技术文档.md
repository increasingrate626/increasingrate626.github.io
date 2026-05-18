---
title: Spring
date: 2026-05-16 14:40:00
---

# Spring 技术文档：IoC、Bean 生命周期、AOP、事务、Spring MVC 与自动配置

## 1. Spring 核心知识图谱

![Spring 核心知识图谱](/images/tech-docs/spring-core-map.svg)

Spring 是一个轻量级、非侵入式的 Java 应用开发框架，核心目标是降低对象创建、依赖管理、横切逻辑和企业级开发的复杂度。学习 Spring 可以围绕几条主线展开：IoC 容器、Bean 生命周期、依赖注入、AOP、事务管理、Spring MVC、Spring Boot 自动配置以及常见扩展点。

核心关键词：

- IoC：控制反转，把对象创建和依赖管理交给容器。
- DI：依赖注入，容器把 Bean 需要的依赖注入进去。
- AOP：面向切面编程，把日志、事务、权限、监控等横切逻辑从业务代码中抽离。
- Bean：被 Spring 容器管理的对象。
- ApplicationContext：Spring 的高级容器接口，负责 Bean 管理、事件发布、国际化、资源加载等能力。
- BeanPostProcessor：Bean 生命周期中的重要扩展点，AOP 代理也依赖它完成增强。
- Transaction：声明式事务通过 AOP 拦截方法调用，在方法前后开启、提交或回滚事务。

一句话理解 Spring：它用 IoC 管对象，用 AOP 管增强，用事务抽象管一致性，用 MVC 管 Web 请求，用 Boot 自动配置降低工程搭建成本。

## 2. Spring 是什么

Spring 是轻量级、非侵入式、以 IoC 和 AOP 为核心的企业级开发框架。

“轻量级”不是指功能少，而是指使用成本和侵入成本低。普通 Java 类不需要继承 Spring 的基类，也不需要强绑定 Spring API，就可以被容器管理。

“非侵入式”意味着业务对象可以保持 POJO 形态：

```java
@Service
public class OrderService {
    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }
}
```

这段代码的核心仍然是普通 Java 对象，只是通过注解告诉 Spring：这个类需要交给容器管理，并由容器注入依赖。

Spring 的核心价值主要体现在：

- 降低对象之间的耦合。
- 统一管理 Bean 的创建、依赖、初始化和销毁。
- 用 AOP 处理事务、日志、权限、监控等横切逻辑。
- 为 JDBC、事务、Web、缓存、消息队列等企业级能力提供统一抽象。
- 与 Spring Boot 配合，通过自动配置快速搭建应用。

## 3. IoC 与 DI

### 3.1 IoC 控制反转

传统写法中，对象主动创建自己的依赖：

```java
public class OrderService {
    private final OrderRepository orderRepository = new OrderRepository();
}
```

这种方式的问题是对象之间强耦合，不利于测试和替换实现。

Spring 的 IoC 思想是：对象不再自己创建依赖，而是把依赖交给容器创建和组装。

```java
@Service
public class OrderService {
    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }
}
```

此时 `OrderService` 只声明自己需要 `OrderRepository`，具体创建和注入由 Spring 容器完成。

### 3.2 DI 依赖注入

DI 是 IoC 的具体实现方式。常见注入方式有三种。

构造器注入：

```java
@Service
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}
```

构造器注入要求在创建对象时必须提供依赖，适合必需依赖，也有利于不可变对象和单元测试。

Setter 注入：

```java
@Service
public class UserService {
    private UserRepository userRepository;

    @Autowired
    public void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}
```

Setter 注入适合可选依赖或运行期需要替换的依赖。

字段注入：

```java
@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
}
```

字段注入写起来简单，但不利于测试，也不利于显式表达依赖关系。实际项目中更推荐构造器注入。

## 4. Bean 与作用域

### 4.1 什么是 Bean

Bean 是由 Spring 容器创建、装配、初始化和管理的对象。通过 XML、注解或 Java 配置都可以把对象注册为 Bean。

常见注册方式：

```java
@Component
public class PaymentClient {
}
```

```java
@Configuration
public class AppConfig {
    @Bean
    public PaymentClient paymentClient() {
        return new PaymentClient();
    }
}
```

### 4.2 Bean 的常见作用域

| 作用域 | 含义 | 典型场景 |
| --- | --- | --- |
| `singleton` | 容器中只有一个 Bean 实例，默认作用域 | 大多数无状态 Service、Repository |
| `prototype` | 每次获取 Bean 都创建新实例 | 有状态对象、临时对象 |
| `request` | 每个 HTTP 请求一个实例 | Web 请求级状态 |
| `session` | 每个 HTTP Session 一个实例 | 用户会话级状态 |
| `application` | ServletContext 级别一个实例 | Web 应用级共享对象 |

默认情况下，Spring Bean 是单例的。

## 5. Spring 单例 Bean 是线程安全的吗

Spring 单例 Bean 本身不保证线程安全。单例只表示容器中只有一个实例，不表示多线程访问时自动加锁。

所有线程共享同一个单例 Bean 实例，如果 Bean 内部有可变成员变量，就可能发生数据竞争。

线程安全情况：

- Bean 没有成员变量，只依赖局部变量。
- Bean 的成员变量是不可变对象。
- Bean 的共享状态使用了线程安全结构或同步控制。
- Bean 只依赖数据库、Redis、消息队列等外部存储，不在内存里保存请求状态。

线程不安全情况：

```java
@Service
public class CounterService {
    private int count = 0;

    public int increment() {
        return ++count;
    }
}
```

`count` 被所有线程共享，`++count` 不是原子操作，可能出现并发问题。

更合理的写法：

```java
@Service
public class CounterService {
    private final AtomicInteger count = new AtomicInteger();

    public int increment() {
        return count.incrementAndGet();
    }
}
```

实际业务中，Service 层通常应该设计成无状态对象。请求级数据放在方法参数、局部变量、数据库、缓存或上下文对象中，不要放在单例 Bean 的普通成员变量里。

## 6. Bean 生命周期

Spring Bean 的生命周期可以分为八个阶段。

### 6.1 解析 BeanDefinition

容器启动时会扫描配置文件、注解或 Java 配置，把 Bean 信息解析成 `BeanDefinition`。`BeanDefinition` 描述了 Bean 的类名、作用域、构造参数、属性依赖、初始化方法、销毁方法等元数据。

### 6.2 实例化

容器通过构造函数或工厂方法创建 Bean 实例。

```java
UserService userService = new UserService();
```

此时对象已经被创建，但依赖属性通常还没有完全注入。

### 6.3 属性赋值

容器为 Bean 注入依赖属性，包括构造器依赖、Setter 依赖、字段依赖等。

```java
@Autowired
private UserRepository userRepository;
```

这一阶段会完成依赖装配，也是循环依赖处理的关键阶段。

### 6.4 Aware 接口回调

如果 Bean 实现了 Spring 的 Aware 接口，容器会把相关上下文信息回调给 Bean。

常见 Aware 接口：

- `BeanNameAware`：获取当前 Bean 名称。
- `BeanFactoryAware`：获取 `BeanFactory`。
- `ApplicationContextAware`：获取 `ApplicationContext`。

示例：

```java
public class DemoBean implements ApplicationContextAware {
    private ApplicationContext applicationContext;

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }
}
```

### 6.5 BeanPostProcessor 前置处理

容器调用所有 `BeanPostProcessor` 的 `postProcessBeforeInitialization()` 方法。

```java
public Object postProcessBeforeInitialization(Object bean, String beanName) {
    return bean;
}
```

这个阶段可以在初始化前对 Bean 进行扩展处理。

### 6.6 初始化

初始化方法有三类常见方式：

- `@PostConstruct`
- 实现 `InitializingBean` 的 `afterPropertiesSet()` 方法
- XML 或 `@Bean(initMethod = "...")` 指定初始化方法

执行顺序通常是：

1. `@PostConstruct`
2. `afterPropertiesSet()`
3. 自定义 `init-method`

### 6.7 BeanPostProcessor 后置处理

容器调用 `BeanPostProcessor` 的 `postProcessAfterInitialization()` 方法。

AOP 代理通常在这个阶段生成。也就是说，业务代码里注入到的对象可能已经不是原始 Bean，而是被增强后的代理对象。

### 6.8 Bean 就绪与销毁

初始化完成后，Bean 进入可用状态，可以被其他对象获取和调用。

容器关闭时会触发销毁逻辑，常见方式：

- `@PreDestroy`
- 实现 `DisposableBean` 的 `destroy()` 方法
- XML 或 `@Bean(destroyMethod = "...")` 指定销毁方法

Bean 生命周期顺序可以简化为：

```text
BeanDefinition -> 实例化 -> 属性赋值 -> Aware 回调
-> BeanPostProcessor 前置处理 -> 初始化
-> BeanPostProcessor 后置处理 -> 使用
-> 销毁
```

## 7. Spring 解决循环依赖

循环依赖指两个或多个 Bean 相互依赖。

```java
@Service
public class AService {
    @Autowired
    private BService bService;
}

@Service
public class BService {
    @Autowired
    private AService aService;
}
```

Spring 默认只能解决单例 Bean 的部分循环依赖，主要依赖三级缓存。

三级缓存：

| 缓存 | 作用 |
| --- | --- |
| `singletonObjects` | 一级缓存，保存已经完全初始化的单例 Bean |
| `earlySingletonObjects` | 二级缓存，保存提前暴露的早期 Bean |
| `singletonFactories` | 三级缓存，保存可以生成早期 Bean 引用的工厂 |

简化流程：

1. 创建 A，实例化后还没完成属性注入。
2. A 提前把自己的对象工厂放入三级缓存。
3. A 注入 B，开始创建 B。
4. B 注入 A 时，从三级缓存中拿到 A 的早期引用。
5. B 初始化完成后，A 继续完成属性注入和初始化。

为什么需要三级缓存？

因为 AOP 场景下，提前暴露的可能不是原始对象，而是代理对象。三级缓存通过工厂延迟生成早期引用，可以兼容普通 Bean 和代理 Bean。

不能解决的典型情况：

- 构造器循环依赖。
- `prototype` 作用域循环依赖。
- 某些复杂 AOP 场景下的循环依赖。

实际项目中，不建议依赖循环依赖机制。更好的方式是重新拆分职责，或者引入事件、懒加载、接口解耦。

## 8. AOP 面向切面编程

### 8.1 AOP 解决什么问题

AOP 用来处理横切关注点。横切关注点不是某一个业务模块独有，而是很多模块都会用到。

常见场景：

- 事务管理。
- 日志记录。
- 权限校验。
- 接口限流。
- 性能监控。
- 参数校验。
- 缓存处理。

如果没有 AOP，这些逻辑会散落在业务方法里。

```java
public void createOrder() {
    beginTransaction();
    try {
        // 业务逻辑
        commit();
    } catch (Exception e) {
        rollback();
    }
}
```

有了 AOP 后，业务方法只关注业务本身，事务、日志等由切面统一处理。

### 8.2 AOP 核心概念

| 概念 | 含义 |
| --- | --- |
| Join Point | 连接点，可以被增强的位置，Spring AOP 中主要是方法调用 |
| Pointcut | 切点，匹配哪些连接点需要增强 |
| Advice | 通知，增强逻辑 |
| Aspect | 切面，切点和通知的组合 |
| Target | 目标对象，被代理的原始对象 |
| Proxy | 代理对象，对目标对象进行增强 |
| Weaving | 织入，把增强逻辑应用到目标对象的过程 |

### 8.3 通知类型

| 通知 | 执行时机 |
| --- | --- |
| `@Before` | 方法执行前 |
| `@After` | 方法执行后，无论是否异常 |
| `@AfterReturning` | 方法正常返回后 |
| `@AfterThrowing` | 方法抛出异常后 |
| `@Around` | 环绕方法执行，功能最强 |

示例：

```java
@Aspect
@Component
public class LogAspect {
    @Around("execution(* com.example.service..*(..))")
    public Object log(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        try {
            return joinPoint.proceed();
        } finally {
            long cost = System.currentTimeMillis() - start;
            System.out.println(joinPoint.getSignature() + " cost " + cost + " ms");
        }
    }
}
```

### 8.4 JDK 动态代理与 CGLIB

Spring AOP 底层主要使用两类代理。

| 代理方式 | 条件 | 特点 |
| --- | --- | --- |
| JDK 动态代理 | 目标类实现了接口 | 基于接口生成代理类 |
| CGLIB | 目标类没有接口 | 通过继承目标类生成子类代理 |

注意点：

- `final` 类不能被 CGLIB 代理。
- `final` 方法不能被 CGLIB 重写增强。
- Spring AOP 主要增强方法调用，不是完整的编译期织入。
- 同类内部方法调用通常不会经过代理，因此事务和切面可能不生效。

## 9. Spring 事务

### 9.1 声明式事务

Spring 最常用的是声明式事务，通过 `@Transactional` 标记方法或类。

```java
@Service
public class OrderService {
    @Transactional
    public void createOrder(CreateOrderCommand command) {
        // 保存订单
        // 扣减库存
        // 写入流水
    }
}
```

`@Transactional` 本质上依赖 AOP。Spring 为目标对象生成代理，方法调用进入代理后，事务拦截器会在方法前开启事务，在方法正常结束时提交事务，在方法异常时回滚事务。

### 9.2 事务传播行为

| 传播行为 | 含义 |
| --- | --- |
| `REQUIRED` | 默认值，有事务就加入，没有就新建 |
| `REQUIRES_NEW` | 挂起当前事务，创建新事务 |
| `NESTED` | 嵌套事务，依赖保存点 |
| `SUPPORTS` | 有事务就加入，没有事务就非事务执行 |
| `NOT_SUPPORTED` | 以非事务方式执行，如果当前有事务则挂起 |
| `MANDATORY` | 必须在事务中执行，没有事务则报错 |
| `NEVER` | 必须非事务执行，有事务则报错 |

日常业务最常见的是 `REQUIRED` 和 `REQUIRES_NEW`。

### 9.3 事务隔离级别

| 隔离级别 | 能解决的问题 |
| --- | --- |
| `READ_UNCOMMITTED` | 基本不解决并发读问题，可能脏读 |
| `READ_COMMITTED` | 解决脏读 |
| `REPEATABLE_READ` | 解决脏读、不可重复读，MySQL 默认级别 |
| `SERIALIZABLE` | 串行化，隔离性最强，并发性能最低 |

Spring 的隔离级别最终要落到数据库能力上。Spring 只负责传递事务语义，真正的并发控制由数据库实现。

### 9.4 事务失效场景

常见事务失效原因：

- 方法不是 `public`。
- 同类内部方法调用，没有经过代理对象。
- 异常被捕获后没有继续抛出。
- 默认只回滚 `RuntimeException` 和 `Error`，受检异常需要配置 `rollbackFor`。
- 数据库表不支持事务，例如 MyISAM。
- 没有被 Spring 管理，自己 `new` 出来的对象不会被代理。
- `@Transactional` 标在了不合适的位置。

示例：

```java
@Transactional(rollbackFor = Exception.class)
public void createOrder() throws Exception {
    // 受检异常也回滚
}
```

如果在同一个类中调用事务方法：

```java
public void outer() {
    inner();
}

@Transactional
public void inner() {
    // 这里可能不走代理，事务不生效
}
```

解决思路是通过代理对象调用，或者把事务方法拆到另一个 Spring Bean 中。

## 10. Spring 常用注解

### 10.1 Bean 注册注解

| 注解 | 作用 |
| --- | --- |
| `@Component` | 通用组件 |
| `@Service` | 业务服务层组件 |
| `@Repository` | 持久层组件 |
| `@Controller` | MVC 控制器 |
| `@RestController` | `@Controller` + `@ResponseBody` |
| `@Configuration` | 配置类 |
| `@Bean` | 在配置类中注册 Bean |

`@Service`、`@Repository`、`@Controller` 本质上都是特殊语义的 `@Component`，用于提升代码可读性和分层表达。

### 10.2 依赖注入注解

| 注解 | 说明 |
| --- | --- |
| `@Autowired` | 按类型注入，Spring 提供 |
| `@Qualifier` | 配合 `@Autowired` 指定 Bean 名称 |
| `@Resource` | JSR-250 注解，默认按名称注入 |
| `@Value` | 注入配置值 |

如果同一类型有多个 Bean，可以使用 `@Qualifier` 指定具体 Bean。

```java
@Autowired
public PayService(@Qualifier("wechatPayClient") PayClient payClient) {
    this.payClient = payClient;
}
```

### 10.3 Web 注解

| 注解 | 作用 |
| --- | --- |
| `@RequestMapping` | 映射请求路径 |
| `@GetMapping` | GET 请求 |
| `@PostMapping` | POST 请求 |
| `@PutMapping` | PUT 请求 |
| `@DeleteMapping` | DELETE 请求 |
| `@PathVariable` | 获取路径变量 |
| `@RequestParam` | 获取请求参数 |
| `@RequestBody` | 读取请求体并反序列化 |
| `@ResponseBody` | 返回值写入响应体 |

### 10.4 事务与 AOP 注解

| 注解 | 作用 |
| --- | --- |
| `@Transactional` | 声明式事务 |
| `@Aspect` | 声明切面 |
| `@Pointcut` | 声明切点 |
| `@Before` | 前置通知 |
| `@Around` | 环绕通知 |

### 10.5 Spring Boot 注解

| 注解 | 作用 |
| --- | --- |
| `@SpringBootApplication` | 启动类核心注解 |
| `@EnableAutoConfiguration` | 开启自动配置 |
| `@ConfigurationProperties` | 绑定配置属性 |
| `@ConditionalOnClass` | 类路径存在某类时生效 |
| `@ConditionalOnMissingBean` | 容器不存在某 Bean 时生效 |
| `@ConditionalOnProperty` | 指定配置满足条件时生效 |

`@SpringBootApplication` 是组合注解，包含：

- `@SpringBootConfiguration`
- `@EnableAutoConfiguration`
- `@ComponentScan`

## 11. Spring Boot 自动配置

Spring Boot 自动配置的核心目标是根据依赖、配置和条件自动创建 Bean，减少手写配置。

`@EnableAutoConfiguration` 会通过 `@Import` 导入 `AutoConfigurationImportSelector`。

自动配置大致流程：

1. 启动类标注 `@SpringBootApplication`。
2. `@EnableAutoConfiguration` 生效。
3. 通过 `AutoConfigurationImportSelector` 加载自动配置类。
4. Spring Boot 扫描依赖包中的自动配置元数据。
5. 自动配置类结合 `@Conditional` 系列注解判断是否生效。
6. 满足条件时，把配置类中的 Bean 注入容器。

早期 Spring Boot 主要通过 `META-INF/spring.factories` 声明自动配置类；新版本中更多使用 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`。

典型条件注解：

```java
@Configuration
@ConditionalOnClass(DataSource.class)
@ConditionalOnMissingBean(DataSource.class)
public class DataSourceAutoConfiguration {
}
```

含义是：当类路径下存在 `DataSource`，且容器中还没有自定义 `DataSource` Bean 时，自动配置才会生效。

自动配置不是强行替你配置一切，而是“有条件地提供默认配置”。当用户自己声明了 Bean，Spring Boot 通常会让用户配置优先。

## 12. Spring MVC 请求流程

Spring MVC 的核心入口是 `DispatcherServlet`，它是前端控制器，负责接收请求并协调后续组件。

请求处理流程：

1. 浏览器发送 HTTP 请求。
2. `DispatcherServlet` 接收请求。
3. `HandlerMapping` 根据 URL 找到对应的 Handler。
4. `HandlerAdapter` 调用 Controller 方法。
5. 参数解析器把请求参数绑定到方法参数。
6. Controller 执行业务逻辑。
7. 返回 `ModelAndView` 或响应体。
8. 如果是页面渲染，`ViewResolver` 解析视图。
9. 如果是 REST 接口，`HttpMessageConverter` 把返回值序列化为 JSON。
10. 响应返回客户端。

REST 接口示例：

```java
@RestController
@RequestMapping("/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public UserVO getUser(@PathVariable Long id) {
        return userService.getUser(id);
    }
}
```

`@RestController` 会让返回值直接写入 HTTP 响应体，而不是走视图解析。

## 13. ApplicationContext 与 BeanFactory

`BeanFactory` 是 Spring 最基础的容器接口，提供 Bean 创建、获取和依赖注入能力。

`ApplicationContext` 是更高级的容器接口，继承并扩展了 `BeanFactory`，常用功能更多。

| 对比项 | BeanFactory | ApplicationContext |
| --- | --- | --- |
| 定位 | 基础 IoC 容器 | 应用级容器 |
| Bean 创建 | 默认懒加载 | 默认预实例化单例 Bean |
| 国际化 | 不直接提供 | 支持 |
| 事件发布 | 不直接提供 | 支持 |
| 资源加载 | 能力较弱 | 支持统一资源访问 |
| 使用场景 | 底层容器 | 日常开发主入口 |

实际开发中几乎都使用 `ApplicationContext`。

## 14. Spring 扩展点

Spring 强大的一部分原因是扩展点非常丰富。

### 14.1 BeanFactoryPostProcessor

`BeanFactoryPostProcessor` 可以在 Bean 实例化之前修改 `BeanDefinition`。

典型用途：

- 修改 Bean 的属性定义。
- 解析占位符。
- 扩展配置元数据。

### 14.2 BeanPostProcessor

`BeanPostProcessor` 可以在 Bean 初始化前后增强 Bean。

典型用途：

- AOP 代理创建。
- 注解处理。
- 初始化增强。
- 对特殊 Bean 做包装。

### 14.3 ImportSelector

`ImportSelector` 可以根据条件动态导入配置类。Spring Boot 自动配置中的 `AutoConfigurationImportSelector` 就是重要代表。

### 14.4 FactoryBean

`FactoryBean` 本身是一个 Bean，但它生产的对象才是真正暴露给容器使用的对象。

典型场景：

- MyBatis 的 Mapper 代理对象。
- 复杂对象创建。
- 框架级代理对象封装。

## 15. Spring 常见面试题

### 15.1 Spring 单例 Bean 是否线程安全

不一定。单例只表示一个实例被多个线程共享，不表示自动线程安全。如果 Bean 是无状态的，一般线程安全；如果有可变成员变量且没有同步控制，就不安全。

### 15.2 构造器注入和字段注入怎么选

优先构造器注入。构造器注入可以明确表达必需依赖，支持 `final` 字段，更利于测试，也能更早暴露循环依赖问题。

字段注入虽然简洁，但依赖关系不够显式，单元测试时也不方便手动构造对象。

### 15.3 Bean 生命周期有哪些步骤

简化回答：

```text
解析 BeanDefinition -> 实例化 -> 属性注入 -> Aware 回调
-> BeanPostProcessor 前置处理 -> 初始化方法
-> BeanPostProcessor 后置处理 -> 使用 -> 销毁
```

初始化阶段包括 `@PostConstruct`、`afterPropertiesSet()` 和自定义 `init-method`。

销毁阶段包括 `@PreDestroy`、`destroy()` 和自定义 `destroy-method`。

### 15.4 Spring AOP 为什么同类内部调用会失效

Spring AOP 基于代理对象增强方法调用。同类内部方法调用使用的是 `this.inner()`，不会经过代理对象，因此事务、日志等切面可能不会生效。

解决方式：

- 把被增强方法拆到另一个 Bean。
- 通过代理对象调用。
- 使用 AspectJ 编译期或加载期织入。

### 15.5 Spring 事务什么时候会回滚

默认情况下，Spring 事务遇到 `RuntimeException` 或 `Error` 会回滚，遇到受检异常不会自动回滚。

如果希望受检异常也回滚，需要配置：

```java
@Transactional(rollbackFor = Exception.class)
```

### 15.6 `@Autowired` 和 `@Resource` 的区别

`@Autowired` 是 Spring 提供的注解，默认按类型注入；如果同类型有多个 Bean，可以配合 `@Qualifier` 指定名称。

`@Resource` 是 JSR-250 注解，默认按名称注入，找不到名称时再按类型匹配。

### 15.7 `@Controller` 和 `@RestController` 的区别

`@RestController` 等价于 `@Controller` 加 `@ResponseBody`。它适合 REST API，方法返回值会直接序列化到响应体中。

`@Controller` 更常用于返回页面视图。

### 15.8 Spring Boot 自动配置原理

`@SpringBootApplication` 中包含 `@EnableAutoConfiguration`。`@EnableAutoConfiguration` 通过 `@Import` 导入 `AutoConfigurationImportSelector`，再加载自动配置类，并通过 `@Conditional` 系列注解判断是否把对应 Bean 注册到容器。

核心思想是：根据 classpath、配置项和已有 Bean 自动提供默认配置，同时允许用户自定义 Bean 覆盖默认行为。

## 16. 项目实践建议

### 16.1 Service 尽量无状态

不要在单例 Service 中保存请求级状态。

推荐：

```java
public OrderDTO getOrder(Long orderId) {
    Order order = orderRepository.findById(orderId);
    return converter.toDTO(order);
}
```

不推荐：

```java
private Long currentOrderId;
```

### 16.2 优先使用构造器注入

构造器注入更适合表达必需依赖，也方便写测试。

```java
@Service
public class OrderService {
    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }
}
```

### 16.3 事务边界放在业务用例层

事务不宜过大，也不宜过小。通常把事务放在 Service 层的业务用例方法上。

```java
@Transactional
public void payOrder(Long orderId) {
    // 查询订单
    // 扣减余额
    // 更新订单状态
    // 写交易流水
}
```

### 16.4 避免在事务中做慢操作

事务中不建议执行耗时外部调用，例如远程 HTTP、发送大文件、复杂 IO 等。事务时间越长，数据库锁持有时间越长，并发性能越差。

### 16.5 明确异常与回滚规则

业务异常如果需要回滚，要么设计为运行时异常，要么在 `@Transactional` 中配置 `rollbackFor`。

```java
@Transactional(rollbackFor = BusinessException.class)
public void createOrder() {
}
```

## 17. 总结

Spring 的核心不是某几个注解，而是一套围绕对象管理和横切增强建立起来的应用开发模型。

学习顺序建议：

1. 先理解 IoC、DI、Bean 和 ApplicationContext。
2. 再掌握 Bean 生命周期、作用域和线程安全。
3. 继续学习 AOP、事务传播、事务失效场景。
4. 然后理解 Spring MVC 请求流程。
5. 最后看 Spring Boot 自动配置和常见扩展点。

面试中遇到 Spring 问题时，可以抓住三个关键词展开：容器、代理、扩展点。容器负责创建和管理 Bean，代理负责 AOP 和事务增强，扩展点负责让框架能力可以被不断增强。
