# Resume Profile Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将最新版简历中的公开信息简洁同步到 Hexo 博客个人页并发布上线，同时不公开 PDF 和手机号。

**Architecture:** 仅修改个人页 Markdown，沿用现有 Hexo 文章结构、Landscape 主题和样式。通过文本断言与完整 Hexo 构建验证内容，再按仓库约定部署生成站点并推送源码分支。

**Tech Stack:** Hexo 8.1.2、Markdown、PowerShell、Git、GitHub Pages

---

### Task 1: 更新个人页内容

**Files:**
- Modify: `source/_posts/about-me.md`

- [ ] **Step 1: 记录旧内容断言**

Run:

```powershell
rg -n '正在寻找 2026 暑期实习机会|IEEE BIBM 2026|Multi-Agent 智能运维诊断系统' source/_posts/about-me.md
```

Expected: 三类旧信息均能被检出，证明更新前状态确实过期。

- [ ] **Step 2: 将个人页替换为简历摘要**

将 `source/_posts/about-me.md` 更新为：

```markdown
---
title: 欢迎来到我的技术博客
date: 2099-12-31 23:59:59
---

> **状态：百度 Agent 开发实习中｜27 届校招准备中**

## 👨‍💻 基本信息

我是**张梓亮**，湖南师范大学（211 双一流）计算机科学与技术专业硕士研究生。当前在百度秒哒工程组从事 Agent 开发，主要技术方向为 **Java 后端与高并发系统**、**AI Agent 应用工程**及二者的结合与落地。

## 🎓 教育背景

- **硕士**：湖南师范大学 - 计算机科学与技术（2024.09 - 2027.06）
- **本科**：青岛科技大学 - 计算机科学与技术（2020.09 - 2024.06）
- **英语**：CET-6

## 🏢 实习经历

### 百度｜秒哒工程组｜Agent 开发实习生（2026.04 - 至今）

- 参与优化秒哒源码生成 Agent 的生成后校验链路，增强项目结构一致性校验、缺失文件补全及沙箱错误分类与定向修复；在 400+ 个生成任务中，首轮构建成功率由 **62% 提升至 78%**，自动修复成功率由 **60% 提升至 82%**。
- 主导设计并开发秒哒应用质量评估框架，融合 PRD、代码工件 Text 评估与 Playwright 真实 UI 验证，输出可量化 `final_score` 与缺陷归因，支撑应用验收、回归测试和版本发布门禁。
- 参与秒哒 Code 多 Agent 研发链路建设，基于 Orchestrator 与统一状态机编排需求澄清、方案设计、代码执行、Review 和 QA，并建设独立 Verdict Agent 驱动的自动化 QA 质量门禁。

### 美团｜服体技术部｜Java 后端开发实习生（2025.08 - 2026.01）

- 参与太平洋智能客服分单系统的架构演进与稳定性保障，面向日均百万级实时调度请求，研发新人保护、分量单元保护和兜底保护等动态干预策略。
- 基于延迟 MQ 触发工单特性值与分数动态重算，通过 Redis Lua 脚本原子更新排队分数，缓解高并发场景下低优工单长期等待问题。
- 独立开发工单排队实时告警任务，并参与配置台库表、接口迁移及大表治理，完成线上故障定位与数据归档后的存储空间释放。

### 湖南泛联新安信息科技｜AI 应用开发实习生（2025.04 - 2025.08）

- 面向分布式 SCA 软件安全漏洞检测平台，参与构建文档摄取、混合检索与图谱证据融合的 Agentic RAG 问答链路。
- 基于 MinIO、Tika、Kafka 和 Elasticsearch 完成文档解析、异步向量化与 BM25 + 语义向量混合召回，使用 RRF 融合排序并通过 WebSocket 流式返回结果。
- 参与 Graph RAG 证据增强链路建设，将评测集上的关键证据 **Recall@8 从 72% 提升至 86%**；结合 Guava RateLimiter、Redis 原子计数器和 Lua 脚本实现分布式限流。

## 🚀 项目经历

### SimpleDB 数据库（2025.01 - 2025.04）

- 实现事务状态管理、提交与回滚，以及日志文件与数据库文件的分页管理、引用计数页面缓存和安全刷盘机制。
- 在 VersionManager 中实现 MVCC，支持 RC（读已提交）和 RR（可重复读）隔离级别、版本跳跃处理与死锁检测。
- 使用 B+ 树实现索引管理，提高大规模数据场景下的查询效率。

## 🔬 科研经历

### SCT-FL：面向 IoMT 的智能合约辅助可审计可信联邦学习框架

**第一作者｜IEEE TIFS（SCI 一区）｜Under Review**

- 针对 IoMT 联邦学习中的投毒攻击与信任决策不可审计问题，设计链上轻量审计、链下训练与聚合相结合的框架。
- 参与实现 DSWLS 动态子空间搜索、时变信誉评估与 Top-K 客户端选择机制，并完成多种攻击、恶意比例、消融和参数敏感性实验。

### TAR-FL：面向非独立同分布医疗联邦学习的触发感知可信防御方法

**第一作者｜PRICAI 2026（CCF-C）｜Accepted**

- 面向 IoMT 联邦学习后门攻击与 Non-IID 异质性问题，参与设计触发风险评估、簇内校准和风险门控选择机制。
- 参与实现 SimHash 聚类、信誉更新与审计证据记录，并完成 OrganAMNIST、PathMNIST 多基线五种子实验。

## 🛠 核心技术栈

- **Java 基础与并发**：集合框架、反射、IO、JMM、CAS、synchronized、ReentrantLock、线程池
- **JVM 与框架**：JVM 内存区域、垃圾回收、类加载；Spring、Spring Boot、Spring MVC、MyBatis、Spring Cloud
- **存储与中间件**：MySQL、Redis、RabbitMQ、Elasticsearch、Kafka
- **微服务**：Nacos、OpenFeign、Gateway、服务调用、熔断与降级
- **AI 应用工程**：Spring AI Alibaba、Multi-Agent、ReAct、Plan-Execute、Function Calling、MCP、混合检索、Graph RAG、SSE/WebSocket

## 📬 联系我

- **Email**：18577321169@163.com
- **WeChat**：Struggletofree
```

- [ ] **Step 3: 检查新旧内容断言**

Run:

```powershell
rg -n '百度 Agent 开发实习中|62% 提升至 78%|Recall@8 从 72% 提升至 86%|IEEE TIFS|PRICAI 2026' source/_posts/about-me.md
rg -n '正在寻找 2026 暑期实习机会|IEEE BIBM 2026|Multi-Agent 智能运维诊断系统|18577321169 \|' source/_posts/about-me.md
```

Expected: 第一条命令检出全部新信息；第二条命令无输出并返回 1，证明过期状态、旧项目、旧投稿信息和手机号均未公开。

### Task 2: 构建与生成页验证

**Files:**
- Verify: `public/2099/12/31/about-me/index.html`

- [ ] **Step 1: 清理并构建 Hexo 站点**

Run:

```powershell
npm run clean
npm run build
```

Expected: 两条命令均返回 0，构建日志包含 `Generated: 2099/12/31/about-me/index.html`。

- [ ] **Step 2: 验证生成页存在且内容正确**

Run:

```powershell
Test-Path public/2099/12/31/about-me/index.html
rg -n '百度 Agent 开发实习中|PRICAI 2026|Recall@8' public/2099/12/31/about-me/index.html
rg -n '正在寻找 2026 暑期实习机会|IEEE BIBM 2026' public/2099/12/31/about-me/index.html
```

Expected: `Test-Path` 输出 `True`；第二条命令检出新内容；第三条命令无输出并返回 1。

### Task 3: 发布并同步源码

**Files:**
- Deploy: `.deploy_git/`（由 Hexo 部署器管理）
- Commit: `source/_posts/about-me.md`

- [ ] **Step 1: 发布生成站点**

Run:

```powershell
npm run deploy
```

Expected: 返回 0，部署日志显示站点内容已推送到远程 `main` 分支。

- [ ] **Step 2: 检查并提交唯一源码改动**

Run:

```powershell
git status --short
git diff --check -- source/_posts/about-me.md
git add -- source/_posts/about-me.md
git commit -m "docs: refresh profile from latest resume"
```

Expected: 提交只包含 `source/_posts/about-me.md`，不包含 `.claude`、`AGENTS.md` 或临时 PDF 渲染文件。

- [ ] **Step 3: 推送本地 main 到其上游 origin/source**

Run:

```powershell
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
git push
```

Expected: 上游为 `origin/source`，推送返回 0。

- [ ] **Step 4: 检查线上页面响应**

Run:

```powershell
curl.exe -I https://increasingrate626.github.io/2099/12/31/about-me/
```

Expected: 返回 HTTP 200；若 GitHub Pages 尚在刷新缓存，则保留成功部署证据并报告短暂延迟。
