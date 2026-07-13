# 🚀 CodeGuard AI 审查助手技术设计方案

## 1. 整体架构设计 (Architecture Overview)

本项目采用 **事件驱动 (Event-Driven) + RAG (检索增强生成) + 多智能体流水线** 的架构。

1. **事件接入层**：GitLab/GitHub Webhook 触发。
2. **异步调度层 (NestJS + Redis MQ)**：负责削峰填谷，避免大模型 API 并发限流。
3. **AI 审查引擎 (LangGraph.js)**：流水线式多智能体协作，分担不同维度的 Code Review。
4. **私有知识库 (PostgreSQL pgvector + Prisma)**：存储团队代码规范的向量化数据。
5. **数据监控大盘 (Next.js)**：供 Tech Lead 管理规则和查看研发质量。

## 2. 后端技术设计 (NestJS 调度与网关层)

这里的核心难点不是“怎么调用大模型”，而是“**当团队 10 个人同时提交 PR 时，系统如何不崩溃**”。

### 2.1 核心模块划分

- **WebhookModule**：暴露对外接口，校验 GitHub/GitLab 签名的合法性。
- **QueueModule**：集成 `BullMQ` (基于 Redis)，实现任务的异步排队。
- **GitClientModule**：封装对 Git 平台的 API 调用（获取 PR Diff、提取修改的文件内容、在 PR 下发表评论）。
- **ReviewEngineModule**：核心模块，负责拉起 LangGraph 运行态。

### 2.2 事件驱动流水线设计 (面试高光点)

1. 开发者提交 PR，Git 平台向 `NestJS` 发送 Webhook。
2. `WebhookModule` 接收事件，仅做极轻量的解析（获取 PR ID 和仓库名），立刻将任务推入 `BullMQ` 消息队列，并向 Git 平台返回 `200 OK`（防止 Webhook 超时重发）。
3. NestJS 后台的 Worker 监听队列，按并发量（如 maxConcurrency: 2）从队列中取出任务。
4. Worker 调用 `GitClientModule` 拉取具体的代码 Diff，随后交由 `ReviewEngineModule` (LangGraph) 处理。

## 3. 私有知识库 RAG 设计 (PostgreSQL pgvector)

AI 最怕变成“通用废话生成器”。通过 RAG 技术，让 AI “背熟”你们公司的开发规范。

### 3.1 数据库结构定义 (Prisma Schema)

使用 Prisma 配合 pgvector 扩展，保证后端的强类型体验：

代码段



```
// schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"] // 开启扩展支持
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector] // 启用 pgvector
}

// 知识库分块表 (用于存储切片后的规范文档)
model CodeGuidelineChunk {
  id         String   @id @default(uuid())
  title      String   // 例如："React Hooks 依赖项规范"
  content    String   // 具体的规范要求
  // 使用 Unsupported 定义 pgvector 的向量字段，维度为 1536 (对应 OpenAI 规范)
  embedding  Unsupported("vector(1536)") 
  createdAt  DateTime @default(now())
}

// 审查记录表 (用于前端大盘统计)
model ReviewRecord {
  id          String   @id @default(uuid())
  repoName    String
  prId        Int
  status      String   // "PASSED" | "WARNING" | "REJECTED"
  aiComments  Json     // 具体的审查意见
  createdAt   DateTime @default(now())
}
```

### 3.2 向量检索流程

1. Tech Lead 在前端上传 Markdown 格式的架构规范。
2. NestJS 利用 LangChain 的 `RecursiveCharacterTextSplitter` 进行文本分块。
3. 调用 Embedding 模型转为向量，存入 `CodeGuidelineChunk` 表。
4. **审查时**：当拉取到 PR Diff，先提取其中涉及的关键词（如 `useEffect`, `React.memo`），转化为向量，使用余弦相似度（Cosine Similarity）去 DB 里检索最相关的 3 条公司规范，注入到后续的 AI 提示词中。

## 4. AI 编排技术设计 (LangGraph.js 审查流水线)

不使用单一的大 Prompt，而是用 **LangGraph 构建线性的智能体审查链 (Chain of Agents)**，每个 Agent 只干一件事，提升准确率。

### 4.1 状态定义 (Graph State)

TypeScript



```
interface ReviewState {
  diff_content: string;         // 拉取到的 Git Diff
  retrieved_rules: string[];    // 从 DB(pgvector) 查到的私有规范
  security_issues: string[];    // 安全智能体发现的问题
  architecture_issues: string[];// 架构智能体发现的问题
  final_markdown: string;       // 最终生成的 PR 评论内容
}
```

### 4.2 节点编排 (Nodes & Graph Flow)

- **Node 1: KnowledgeRetrieval** (知识检索节点)：根据 `diff_content` 检索 `retrieved_rules`。
- **Node 2: SecurityReviewer** (安全卫士节点)：专注于找茬（如硬编码的 Token、未过滤的用户输入）。将结果追加到 `security_issues`。
- **Node 3: CodeSmellReviewer** (代码异味节点)：结合 `retrieved_rules`，检查命名规范、Hooks 依赖、函数复杂度等，结果追加到 `architecture_issues`。
- **Node 4: SummaryAndAction** (总结行动节点)：综合上述所有的 issues。如果没有问题，生成 `LGTM (Looks Good To Me)`；如果有问题，生成带代码高亮的 Markdown 回复，并通过 GitClientModule 直接提交到 PR 评论区。

## 5. 前端大盘技术设计 (Next.js)

提供给技术主管（Tech Lead）的管理后台，强调用 **Next.js 14 App Router (RSC)** 实现高性能的静态/服务端渲染。

### 5.1 核心页面划分

- **/dashboard (大盘页 - Server Component)**：
  - 利用服务端组件直接连接 Prisma，执行聚合查询（Count/GroupBy），查出“本周拦截了多少次危险提交”、“哪个项目的代码质量最差”。
  - 数据查出后，透传给 Client Component 的 Echarts/Recharts 图表进行渲染，**实现零 Loading、极快首屏**。
- **/knowledge-base (规则管理页)**：
  - 提供拖拽上传区域，支持上传 PDF/Markdown 格式的团队规范。
  - 利用 Next.js Server Actions 处理表单提交，直接调用后端的向量化接口。
- **/review-logs (审查日志页)**：
  - 展示 AI 在各个 PR 中的具体点评记录。利用虚拟列表 (Virtual List) 优化长文本日志的渲染性能