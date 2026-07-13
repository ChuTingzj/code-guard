# CodeGuard AI 审查助手 — 完整前后端技术设计方案

> 依据 `prd.md`（产品需求文档）与 `technology-design.md`（技术设计草案）编写，作为可直接指导开发落地的完整技术设计方案。

## 目录

1. [系统总体架构](#1-系统总体架构)
2. [后端设计（NestJS）](#2-后端设计nestjs)
3. [AI 审查引擎设计（LangGraph.js）](#3-ai-审查引擎设计langgraphjs)
4. [RAG 私有知识库设计](#4-rag-私有知识库设计)
5. [数据模型（Prisma Schema）](#5-数据模型prisma-schema)
6. [API 接口设计](#6-api-接口设计)
7. [前端设计（Next.js 14 App Router）](#7-前端设计nextjs-14-app-router)
8. [工程结构与部署](#8-工程结构与部署)
9. [里程碑规划](#9-里程碑规划)

---

## 1. 系统总体架构

### 1.1 架构风格

系统采用 **事件驱动（Event-Driven）+ RAG（检索增强生成）+ 多智能体流水线（Chain of Agents）** 三层组合架构：

- **事件驱动**：Git 平台的 PR/MR 事件通过 Webhook 推送，经消息队列异步消费，实现削峰填谷与失败重试。
- **RAG**：团队私有规范文档向量化后存入 PostgreSQL pgvector，审查前检索注入 Prompt，让 AI"懂团队规矩"。
- **多智能体流水线**：LangGraph.js 将审查任务拆分为语法/风格、安全、架构、行动四个专职 Agent，避免单一大 Prompt 的"泛泛而谈"。

### 1.2 架构分层图

```mermaid
flowchart TB
    subgraph gitPlatform [Git 平台]
        GitHub[GitHub]
        GitLab[GitLab]
    end

    subgraph gateway [事件接入层 - NestJS]
        WebhookCtrl["WebhookModule<br/>签名校验 / 事件过滤 / 幂等去重"]
    end

    subgraph queueLayer [异步调度层]
        Redis[("Redis")]
        BullMQ["BullMQ 队列 review-queue<br/>并发控制 / 指数退避重试 / 死信"]
    end

    subgraph worker [AI 审查引擎 - Review Worker]
        GitClient["GitClientModule<br/>拉取 Diff / 回写评论"]
        Engine["ReviewEngineModule<br/>LangGraph 审查流水线"]
    end

    subgraph knowledge [私有知识库]
        PG[("PostgreSQL<br/>+ pgvector")]
        Embed["Embedding 模型<br/>text-embedding-3-small"]
    end

    subgraph frontendLayer [管理后台 - Next.js 14]
        Dashboard["/dashboard 质量大盘"]
        KB["/knowledge-base 规范管理"]
        Logs["/review-logs 审查日志"]
    end

    GitHub -->|Webhook| WebhookCtrl
    GitLab -->|Webhook| WebhookCtrl
    WebhookCtrl -->|入队后立即返回 200| BullMQ
    BullMQ --- Redis
    BullMQ -->|Worker 消费| GitClient
    GitClient --> Engine
    Engine <-->|向量检索 Top-K| PG
    Engine -->|LLM 调用| LLM["大模型 API<br/>GPT-4o / DeepSeek"]
    Engine -->|回写 PR 评论 / Patch| GitHub
    Engine -->|回写 MR 评论 / Patch| GitLab
    Engine -->|写入审查记录| PG
    KB -->|上传文档| Embed
    Embed -->|向量写入| PG
    Dashboard -->|RSC 直连 Prisma 聚合查询| PG
    Logs --> PG
```

### 1.3 端到端时序图

```mermaid
sequenceDiagram
    participant Dev as 开发者
    participant Git as GitHub/GitLab
    participant WH as WebhookModule
    participant MQ as BullMQ(Redis)
    participant W as Review Worker
    participant DB as PostgreSQL(pgvector)
    participant LLM as 大模型 API

    Dev->>Git: 提交 PR / MR
    Git->>WH: Webhook (pull_request / merge_request)
    WH->>WH: 签名校验 + 事件过滤 + 幂等去重
    WH->>MQ: 推入任务 {projectId, prId, commitSha}
    WH-->>Git: 200 OK（毫秒级返回，防超时重发）
    MQ->>W: Worker 按并发度取出任务
    W->>Git: 拉取 PR Diff 与变更文件
    W->>DB: 向量检索相关团队规范 (Top-K)
    W->>LLM: SyntaxStyleAgent 审查
    W->>LLM: SecurityAgent 审查
    W->>LLM: ArchitectureAgent 审查
    W->>LLM: ActionAgent 汇总 + 生成 Patch
    W->>Git: 回写 PR 评论（Markdown + Diff Suggestion）
    W->>DB: 写入 ReviewRecord / ReviewIssue
    Note over DB: Next.js 大盘直接聚合查询展示
```

### 1.4 技术选型

| 层次 | 技术 | 选型理由 |
| --- | --- | --- |
| 后端框架 | NestJS 11 + TypeScript | 模块化 DI 架构清晰，官方集成 BullMQ，适合网关 + Worker 双角色 |
| 消息队列 | BullMQ (Redis) | 原生支持并发控制、延迟重试、死信队列、任务去重（jobId 幂等） |
| AI 编排 | LangGraph.js | 显式状态机 + 节点编排，比裸 Chain 更可控、可观测、可中断恢复 |
| LLM 接入 | LangChain.js (`@langchain/openai`) | 统一 LLM/Embedding 接口，方便切换 GPT-4o / DeepSeek 等模型 |
| 数据库 | PostgreSQL 16 + pgvector | 关系数据与向量数据一库存储，免去独立向量库的运维成本 |
| ORM | Prisma | 强类型 schema、迁移工具链完善，配合 raw SQL 处理向量操作 |
| 前端 | Next.js 14 App Router + TailwindCSS | RSC 服务端直查数据库实现零 Loading 首屏；Server Actions 简化表单链路 |
| 图表 | Recharts | React 生态成熟，声明式 API，满足趋势图/柱状图/饼图需求 |
| Git API | Octokit (GitHub) / @gitbeaker (GitLab) | 官方或社区事实标准 SDK，覆盖 Diff 拉取与评论回写 |
| 包管理 | pnpm workspace (Monorepo) | 前后端共享类型定义（`packages/shared`），依赖安装快 |

### 1.5 核心设计原则

1. **Webhook 快进快出**：接收端只做校验与入队，任何耗时操作（拉 Diff、调 LLM）都在 Worker 内完成，保证 Git 平台不会因超时重发。
2. **一切可重试**：LLM 调用、Git API、向量检索均可能瞬时失败，队列层统一负责重试与死信，业务层保持幂等。
3. **平台无关**：通过 `IGitProvider` 抽象接口隔离 GitHub / GitLab 差异，新增 Gitee 等平台仅需新增实现类。
4. **结构化输出**：所有 Agent 强制输出 JSON Schema 约束的结构化结果，禁止自由文本，保证下游可解析、可统计。

---

## 2. 后端设计（NestJS）

后端是一个 NestJS 应用，同时承担 **HTTP 网关**（Webhook + 管理端 REST API）与 **队列 Worker**（审查任务消费者）两个角色。小规模部署时单进程即可；需要横向扩展时，通过环境变量 `APP_ROLE=gateway|worker|all` 控制启用的模块，网关与 Worker 可独立扩容。

### 2.1 模块划分

```mermaid
flowchart LR
    subgraph appModule [AppModule]
        Webhook[WebhookModule]
        Queue[QueueModule]
        GitClient[GitClientModule]
        ReviewEngine[ReviewEngineModule]
        KnowledgeM[KnowledgeModule]
        Stats[StatsModule]
        Auth[AuthModule]
        PrismaM[PrismaModule]
    end

    Webhook --> Queue
    Queue --> ReviewEngine
    ReviewEngine --> GitClient
    ReviewEngine --> KnowledgeM
    ReviewEngine --> PrismaM
    KnowledgeM --> PrismaM
    Stats --> PrismaM
```

| 模块 | 职责 |
| --- | --- |
| `WebhookModule` | 暴露 `/api/webhooks/*`，校验签名，过滤事件类型，组装任务负载并入队 |
| `QueueModule` | 封装 BullMQ：队列注册、Worker Processor、重试/死信策略、任务状态回写 |
| `GitClientModule` | `IGitProvider` 抽象 + GitHub/GitLab 实现：拉取 Diff、发表评论、提交 Suggestion |
| `ReviewEngineModule` | 拉起 LangGraph 运行态，执行审查流水线，落库审查结果 |
| `KnowledgeModule` | 规范文档的上传解析、分块、向量化、CRUD、检索服务（供 ReviewEngine 与前端共用） |
| `StatsModule` | 大盘统计聚合查询（周拦截数、违规 TopN、通过率趋势） |
| `AuthModule` | 管理后台账号 JWT 登录鉴权 |
| `PrismaModule` | 全局 PrismaService，管理数据库连接 |

### 2.2 Webhook 接入与安全

**接口**：

- `POST /api/webhooks/github` — 处理 `pull_request` 事件（action 为 `opened` / `synchronize` / `reopened`）
- `POST /api/webhooks/gitlab` — 处理 `Merge Request Hook` 事件（action 为 `open` / `update` / `reopen`）

**安全校验**（在 Guard 中实现，校验失败返回 401）：

```typescript
// webhook-signature.guard.ts 核心逻辑
// GitHub: 用项目配置的 secret 对原始 body 做 HMAC-SHA256，
//         与 X-Hub-Signature-256 头做恒定时间比较
const expected = 'sha256=' + createHmac('sha256', project.webhookSecret)
  .update(rawBody).digest('hex');
if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
  throw new UnauthorizedException();
}

// GitLab: 直接比较 X-Gitlab-Token 头与项目配置的 secret
```

> 注意：NestJS 需开启 `rawBody: true`（`NestFactory.create(AppModule, { rawBody: true })`），因为 HMAC 必须基于原始字节而非反序列化后的 JSON 计算。

**事件过滤**：只处理 PR 打开与新 commit 推送；`closed`、`labeled`、评论事件等直接返回 200 忽略，避免无效任务占用队列。

**幂等去重**：以 `${projectId}:${prNumber}:${headSha}` 作为 BullMQ 的 `jobId`。同一 commit 的重复 Webhook（平台重发、手动 redeliver）会被队列自动去重；新 commit 推送则因 `headSha` 变化生成新任务。

**Webhook 处理全流程**：

1. Guard 校验签名 → 失败 401。
2. Controller 解析出 `repoFullName`、`prNumber`、`headSha`、`action`，查询 `Project` 表确认该仓库已接入且启用。
3. 组装 `ReviewJobPayload` 入队，同时在 `ReviewTask` 表插入一条 `QUEUED` 记录。
4. 立即返回 `202 Accepted`，总耗时控制在 100ms 内。

```typescript
// 队列任务负载（packages/shared 中定义，前后端共享）
export interface ReviewJobPayload {
  taskId: string;        // ReviewTask 表主键
  projectId: string;
  platform: 'GITHUB' | 'GITLAB';
  repoFullName: string;  // e.g. "acme/webapp"
  prNumber: number;
  headSha: string;
}
```

### 2.3 队列设计（BullMQ）

```typescript
// queue.constants.ts
export const REVIEW_QUEUE = 'review-queue';

// 队列注册
BullModule.registerQueue({
  name: REVIEW_QUEUE,
  defaultJobOptions: {
    attempts: 3,                                   // 最多重试 3 次
    backoff: { type: 'exponential', delay: 10_000 }, // 10s → 20s → 40s
    removeOnComplete: { age: 24 * 3600 },          // 完成任务保留 24h
    removeOnFail: false,                           // 失败任务保留，供死信排查
  },
});
```

```typescript
// review.processor.ts
@Processor(REVIEW_QUEUE, { concurrency: 2 }) // 并发度 2，保护 LLM API 限流
export class ReviewProcessor extends WorkerHost {
  async process(job: Job<ReviewJobPayload>) {
    await this.taskRepo.markAnalyzing(job.data.taskId);
    const result = await this.reviewEngine.run(job.data);
    await this.taskRepo.markCompleted(job.data.taskId, result);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ReviewJobPayload>, err: Error) {
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      // 重试耗尽 → 标记 FAILED，并回写一条兜底 PR 评论告知审查失败
      await this.taskRepo.markFailed(job.data.taskId, err.message);
    }
  }
}
```

**任务状态机**：

```mermaid
stateDiagram-v2
    [*] --> QUEUED : Webhook 入队
    QUEUED --> ANALYZING : Worker 取出任务
    ANALYZING --> COMPLETED : 审查完成并回写评论
    ANALYZING --> QUEUED : 失败且未耗尽重试（退避后重新入队）
    ANALYZING --> FAILED : 重试耗尽
    COMPLETED --> [*]
    FAILED --> [*]
```

**削峰逻辑**：10 人同时提 PR 时，10 个任务全部入队，Worker 按 `concurrency: 2` 顺序消费。LLM API 的 429 限流错误抛出后由 BullMQ 指数退避重试消化，网关侧永远不阻塞。

### 2.4 Git 平台适配层

```typescript
// git-provider.interface.ts
export interface PrDiffFile {
  filePath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  patch: string;          // unified diff 片段
  language: string;       // 由扩展名推断，供 Agent 分流
}

export interface IGitProvider {
  /** 拉取 PR 的变更文件列表与 Diff */
  getPrDiff(repo: string, prNumber: number): Promise<PrDiffFile[]>;
  /** 发表 PR 级别的总结评论（Markdown） */
  postComment(repo: string, prNumber: number, markdown: string): Promise<void>;
  /** 在指定文件行发表行内评论，可携带 suggestion 代码块（一键应用 Patch） */
  postInlineSuggestion(repo: string, prNumber: number, opts: {
    filePath: string;
    line: number;
    body: string;         // 含 ```suggestion 代码块
    commitSha: string;
  }): Promise<void>;
}
```

- `GithubProvider`：基于 Octokit。Diff 用 `GET /repos/{owner}/{repo}/pulls/{n}/files`；行内建议用 Review Comment API + GitHub 原生 ` ```suggestion ` 语法，开发者可在 UI 上一键 Commit。
- `GitlabProvider`：基于 @gitbeaker。Diff 用 `GET /projects/:id/merge_requests/:iid/diffs`；行内建议用 Discussions API + GitLab 的 ` ```suggestion:-0+0 ` 语法。
- `GitProviderFactory`：按 `project.platform` 返回对应实现，凭据（GitHub App Token / GitLab Access Token）从项目配置读取。

**大 PR 防护**：拉取 Diff 后如果变更超过 30 个文件或总 Diff 超过 60KB，只保留代码文件（排除 lockfile、生成物、图片），并按文件重要度截断，同时在最终评论中注明"部分文件因体积原因未审查"。

---

## 3. AI 审查引擎设计（LangGraph.js）

### 3.1 编排总览

审查流水线对齐 PRD 3.2 定义的四个专职 Agent，外加一个前置的知识检索节点，构成线性 Graph：

```mermaid
flowchart LR
    startNode([START]) --> KR[KnowledgeRetrieval<br/>检索私有规范]
    KR --> SS[SyntaxStyleAgent<br/>语法与命名规范]
    SS --> SEC[SecurityAgent<br/>安全漏洞审查]
    SEC --> ARCH[ArchitectureAgent<br/>架构耦合审查]
    ARCH --> ACT[ActionAgent<br/>汇总 + 生成评论与 Patch]
    ACT --> endNode([END])
```

采用线性链而非并行分支的原因：三个审查 Agent 共享同一份 Diff 上下文，串行执行可让后置 Agent 参考前置结论去重（例如 SecurityAgent 已报告的问题，ArchitectureAgent 不再重复）；同时串行天然限制了单任务的 LLM 并发，配合队列层 `concurrency: 2`，全局 LLM 并发上限可精确控制在 2 x 1 = 2 路。

### 3.2 状态定义（Graph State）

```typescript
// review-state.ts
import { Annotation } from '@langchain/langgraph';

export interface ReviewIssueItem {
  category: 'STYLE' | 'SECURITY' | 'ARCHITECTURE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  filePath: string;
  line: number | null;        // 无法定位到行时为 null，降级为 PR 级评论
  ruleTitle: string | null;   // 命中的私有规范标题，用于大盘"最常违反规范"统计
  description: string;        // 问题描述
  suggestion: string | null;  // 修复建议文字
  patch: string | null;       // 可直接应用的 suggestion 代码块内容
}

export const ReviewStateAnnotation = Annotation.Root({
  // —— 输入 ——
  taskId: Annotation<string>(),
  projectId: Annotation<string>(),
  prNumber: Annotation<number>(),
  headSha: Annotation<string>(),
  diffFiles: Annotation<PrDiffFile[]>(),

  // —— 中间产物 ——
  retrievedRules: Annotation<{ title: string; content: string }[]>({
    reducer: (a, b) => a.concat(b), default: () => [],
  }),
  styleIssues: Annotation<ReviewIssueItem[]>({
    reducer: (a, b) => a.concat(b), default: () => [],
  }),
  securityIssues: Annotation<ReviewIssueItem[]>({
    reducer: (a, b) => a.concat(b), default: () => [],
  }),
  architectureIssues: Annotation<ReviewIssueItem[]>({
    reducer: (a, b) => a.concat(b), default: () => [],
  }),

  // —— 输出 ——
  finalMarkdown: Annotation<string>(),
  verdict: Annotation<'PASSED' | 'WARNING' | 'REJECTED'>(),
});

export type ReviewState = typeof ReviewStateAnnotation.State;
```

**结论判定规则**（在 ActionAgent 中执行，纯代码逻辑不走 LLM）：

- 存在任一 `CRITICAL` 问题 → `REJECTED`
- 无 CRITICAL 但存在 `WARNING` → `WARNING`
- 仅 INFO 或无问题 → `PASSED`（评论为 LGTM）

### 3.3 Graph 组装

```typescript
// review-graph.ts
const graph = new StateGraph(ReviewStateAnnotation)
  .addNode('knowledgeRetrieval', knowledgeRetrievalNode)
  .addNode('syntaxStyle', syntaxStyleNode)
  .addNode('security', securityNode)
  .addNode('architecture', architectureNode)
  .addNode('action', actionNode)
  .addEdge(START, 'knowledgeRetrieval')
  .addEdge('knowledgeRetrieval', 'syntaxStyle')
  .addEdge('syntaxStyle', 'security')
  .addEdge('security', 'architecture')
  .addEdge('architecture', 'action')
  .addEdge('action', END)
  .compile();
```

### 3.4 各节点设计

#### Node 1: KnowledgeRetrieval（知识检索，不调用 LLM）

1. 从 `diffFiles` 中提取检索信号：文件路径、语言、新增行中的标识符与 API 调用（如 `useEffect`、`axios`、`dangerouslySetInnerHTML`）。
2. 拼接为检索 query，调用 `KnowledgeModule.search(projectId, query, topK: 5)` 做向量检索。
3. 将命中规范写入 `retrievedRules`。检索无结果时置空数组，后续 Agent 退化为通用最佳实践审查（Prompt 中已声明此行为）。

#### Node 2: SyntaxStyleAgent（语法与风格）

- **职责**：命名规范、代码格式、React Hooks 依赖项、magic number、函数复杂度等团队风格类问题。
- **Prompt 结构**：

```text
[System]
你是团队的代码风格审查员。你只关注命名、格式、可读性、Hooks 使用等风格问题，
不评价安全性和架构。以下是团队私有规范（最高准则，优先级高于通用惯例）：
{retrievedRules 逐条列出，标注规范标题}

审查规则：
- 只针对 Diff 中【新增或修改】的行提出问题，不评价未改动的旧代码
- 每个问题必须给出 filePath 与 line（对应新文件行号）
- 命中私有规范时必须填写 ruleTitle
- 无问题时返回空数组，禁止编造问题凑数

[Human]
{按文件拼接的 unified diff，带行号标注}
```

- **输出约束**：`model.withStructuredOutput(zodIssueArraySchema)`，直接得到 `ReviewIssueItem[]`（category 固定为 `STYLE`）。

#### Node 3: SecurityAgent（安全卫士）

- **职责**：SQL/命令注入、XSS、硬编码密钥、越权访问、不安全的反序列化、敏感信息日志泄露。
- **Prompt 要点**：System 中枚举 OWASP 常见风险清单 + 注入私有安全规范；要求对每个问题给出攻击场景说明（写入 `description`），severity 只允许 `WARNING` 或 `CRITICAL`（安全问题不允许 INFO）。
- 同样使用 structured output，category 固定为 `SECURITY`。

#### Node 4: ArchitectureAgent（架构审查）

- **职责**：组件/模块耦合、职责越界（如 UI 层直接访问数据库）、循环依赖征兆、与团队分层架构规范的偏离。
- **上下文增强**：除 Diff 外，额外注入变更文件的完整路径树（帮助模型理解模块边界）与前两个 Agent 已报告的问题清单（要求不重复报告）。
- category 固定为 `ARCHITECTURE`。

#### Node 5: ActionAgent（总结与行动）

分两步，先 LLM 后代码：

1. **LLM 步骤**：输入三类 issues 汇总，生成最终 PR 评论 Markdown（`finalMarkdown`）。格式约定：
   - 顶部结论徽章（PASSED / WARNING / REJECTED）+ 问题数统计表；
   - 按 severity 分组列出问题，每条附文件位置与建议；
   - 对 `patch` 非空的问题，生成 Git 平台原生 `suggestion` 代码块，实现"一键 Merge 补丁"；
   - 全部通过时输出简短的 `LGTM` 评论。
2. **代码步骤**（不经 LLM，保证可靠执行）：
   - 计算 `verdict`（规则见 3.2）；
   - 调 `IGitProvider.postComment` 发表总结评论；对可行内定位的问题逐条调 `postInlineSuggestion`；
   - 将 `ReviewRecord` 与 `ReviewIssue[]` 写入数据库，供大盘统计。

### 3.5 大 Diff 切分与 Token 控制

- **按文件切分**：每个审查 Agent 内部将 `diffFiles` 按 8K token 预算分批（单文件超预算则按 hunk 再切），逐批调用 LLM 后合并 issues。批与批之间串行，避免并发放大。
- **优先级排序**：源代码文件 > 配置文件 > 测试文件；超出总预算（默认 32K token/任务）的低优先级文件跳过并记录。
- **降级策略**：LLM 返回的 JSON 解析失败时重试一次（附解析错误提示）；再失败则跳过该批文件并在评论中注明，不让单批失败拖垮整个任务。
- **失败重试分层**：节点内部处理 LLM 的格式错误与单次超时（最多 2 次）；节点仍失败则任务整体抛出，交给 BullMQ 的指数退避做任务级重试。

### 3.6 LLM 配置

```typescript
// llm.factory.ts —— 统一从环境变量读取，方便切换供应商
export const reviewModel = new ChatOpenAI({
  modelName: process.env.LLM_MODEL ?? 'gpt-4o-mini',
  temperature: 0,            // 审查任务要求稳定输出
  maxRetries: 2,
  timeout: 120_000,
  configuration: { baseURL: process.env.LLM_BASE_URL }, // 兼容 DeepSeek 等 OpenAI 协议
});
```

每次 LLM 调用记录 `promptTokens / completionTokens` 到 `ReviewRecord.tokenUsage`，供成本监控。

---

## 4. RAG 私有知识库设计

### 4.1 文档摄取流水线（Ingestion）

```mermaid
flowchart LR
    Upload["前端上传<br/>Markdown / PDF"] --> Parse["解析器<br/>md: 直接读取<br/>pdf: pdf-parse 提取文本"]
    Parse --> Split["RecursiveCharacterTextSplitter<br/>chunkSize 800 / overlap 100<br/>Markdown 按标题层级优先切分"]
    Split --> EmbedNode["Embedding<br/>text-embedding-3-small (1536 维)<br/>批量 100 条/次"]
    EmbedNode --> Store["写入 GuidelineChunk<br/>content + embedding + metadata"]
```

实现要点：

1. 上传接口接收文件后先创建 `GuidelineDocument`（status: `PROCESSING`），摄取过程异步执行（复用 BullMQ，独立 `ingest-queue`），完成后更新为 `READY`，失败为 `FAILED` 并记录原因——前端可轮询状态。
2. 分块时保留 metadata：`documentId`、所属章节标题（作为 chunk 的 `title`）、chunk 序号。章节标题是审查结果中 `ruleTitle` 的来源。
3. 重新上传同名文档采用"先插后删"：新 chunks 全部写入成功后再删除旧 chunks，摄取失败不影响线上检索。
4. Prisma 不支持向量类型写入，插入用 raw SQL：

```typescript
await prisma.$executeRaw`
  INSERT INTO "GuidelineChunk" (id, "documentId", title, content, embedding)
  VALUES (${id}, ${docId}, ${title}, ${content}, ${JSON.stringify(vector)}::vector)
`;
```

### 4.2 检索策略（Retrieval）

```typescript
// knowledge.service.ts
async search(projectId: string, query: string, topK = 5) {
  const queryVector = await this.embeddings.embedQuery(query);
  // 余弦距离 <=>，distance 越小越相似；0.45 阈值过滤弱相关结果
  return this.prisma.$queryRaw<RetrievedRule[]>`
    SELECT c.title, c.content,
           1 - (c.embedding <=> ${JSON.stringify(queryVector)}::vector) AS similarity
    FROM "GuidelineChunk" c
    JOIN "GuidelineDocument" d ON d.id = c."documentId"
    WHERE d."projectId" = ${projectId} AND d.status = 'READY'
      AND 1 - (c.embedding <=> ${JSON.stringify(queryVector)}::vector) > 0.45
    ORDER BY c.embedding <=> ${JSON.stringify(queryVector)}::vector
    LIMIT ${topK}
  `;
}
```

- **Query 构造**：不直接用整个 Diff 做 embedding（噪声大），而是提取"文件语言 + 新增行中的标识符/API 关键词 + 文件路径语义"拼接成短文本。
- **注入格式**：检索结果以编号列表注入 Prompt，每条带规范标题，方便模型引用与 `ruleTitle` 回填。
- **知识库为空**：跳过检索，Prompt 声明"无私有规范，请依据通用最佳实践"，保证冷启动可用。

### 4.3 向量索引（HNSW）

Prisma schema 无法声明向量索引，通过自定义 migration 建立：

```sql
-- prisma/migrations/xxxx_add_hnsw_index/migration.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX guideline_chunk_embedding_idx
  ON "GuidelineChunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

知识库规模在万级 chunk 以下时 HNSW 查询延迟在个位数毫秒，满足审查链路的实时检索要求。

---

## 5. 数据模型（Prisma Schema）

实体关系总览：

```mermaid
erDiagram
    User ||--o{ GuidelineDocument : uploads
    Project ||--o{ GuidelineDocument : owns
    Project ||--o{ ReviewTask : owns
    GuidelineDocument ||--o{ GuidelineChunk : splits_into
    ReviewTask ||--|| ReviewRecord : produces
    ReviewRecord ||--o{ ReviewIssue : contains
```

完整 schema：

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

// ============ 账号与项目 ============

enum UserRole {
  ADMIN       // 可管理项目与账号
  TECH_LEAD   // 可管理知识库、查看大盘
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         UserRole @default(TECH_LEAD)
  createdAt    DateTime @default(now())

  documents GuidelineDocument[]
}

enum GitPlatform {
  GITHUB
  GITLAB
}

model Project {
  id            String      @id @default(uuid())
  name          String
  platform      GitPlatform
  repoFullName  String      // e.g. "acme/webapp" 或 GitLab 的 path_with_namespace
  webhookSecret String      // Webhook 签名校验密钥
  accessToken   String      // 调用 Git API 的凭据（加密存储）
  enabled       Boolean     @default(true)
  createdAt     DateTime    @default(now())

  documents GuidelineDocument[]
  tasks     ReviewTask[]

  @@unique([platform, repoFullName])
}

// ============ RAG 知识库 ============

enum DocumentStatus {
  PROCESSING
  READY
  FAILED
}

model GuidelineDocument {
  id         String         @id @default(uuid())
  projectId  String
  uploaderId String
  fileName   String
  fileType   String         // "md" | "pdf"
  status     DocumentStatus @default(PROCESSING)
  error      String?        // 摄取失败原因
  createdAt  DateTime       @default(now())

  project  Project          @relation(fields: [projectId], references: [id])
  uploader User             @relation(fields: [uploaderId], references: [id])
  chunks   GuidelineChunk[]
}

model GuidelineChunk {
  id         String   @id @default(uuid())
  documentId String
  title      String   // 所属章节标题，例如 "React Hooks 依赖项规范"
  content    String   // 分块后的规范内容
  chunkIndex Int
  embedding  Unsupported("vector(1536)")
  createdAt  DateTime @default(now())

  document GuidelineDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
}

// ============ 审查任务与结果 ============

enum TaskStatus {
  QUEUED
  ANALYZING
  COMPLETED
  FAILED
}

model ReviewTask {
  id        String     @id @default(uuid())
  projectId String
  prNumber  Int
  prTitle   String?
  prAuthor  String?
  headSha   String
  status    TaskStatus @default(QUEUED)
  error     String?
  createdAt DateTime   @default(now())
  startedAt DateTime?
  endedAt   DateTime?

  project Project       @relation(fields: [projectId], references: [id])
  record  ReviewRecord?

  @@unique([projectId, prNumber, headSha]) // 与队列 jobId 对应的幂等约束
  @@index([projectId, createdAt])
}

enum Verdict {
  PASSED
  WARNING
  REJECTED
}

model ReviewRecord {
  id            String   @id @default(uuid())
  taskId        String   @unique
  verdict       Verdict
  finalMarkdown String   // 回写到 PR 的完整评论
  tokenUsage    Json     // { prompt: number, completion: number }
  durationMs    Int
  createdAt     DateTime @default(now())

  task   ReviewTask    @relation(fields: [taskId], references: [id])
  issues ReviewIssue[]

  @@index([verdict, createdAt])
}

enum IssueCategory {
  STYLE
  SECURITY
  ARCHITECTURE
}

enum IssueSeverity {
  INFO
  WARNING
  CRITICAL
}

model ReviewIssue {
  id          String        @id @default(uuid())
  recordId    String
  category    IssueCategory
  severity    IssueSeverity
  filePath    String
  line        Int?
  ruleTitle   String?       // 命中的私有规范标题，大盘"最常违反规范"按此 groupBy
  description String
  suggestion  String?
  patch       String?       // 可一键应用的 suggestion 内容
  createdAt   DateTime      @default(now())

  record ReviewRecord @relation(fields: [recordId], references: [id], onDelete: Cascade)

  @@index([ruleTitle])
  @@index([category, severity, createdAt])
}
```

设计说明：

- `ReviewTask` 与 `ReviewRecord` 分表：Task 是队列生命周期（含失败任务），Record 只在审查成功后写入，二者一对一。大盘"通过率"用 Record 统计，"系统健康度"用 Task 统计。
- `ReviewIssue` 单独建表而非塞进 Json，是大盘统计的关键：`groupBy ruleTitle` 得到"最常违反的规范"，`count severity=CRITICAL` 得到"拦截高危提交数"。
- `Project.accessToken` 在应用层用 AES-256-GCM 加密后入库，密钥来自环境变量 `TOKEN_ENCRYPTION_KEY`。

---

## 6. API 接口设计

统一约定：管理端接口前缀 `/api/v1`，响应体 `{ code: number, data: T, message: string }`；除登录与 Webhook 外均需 `Authorization: Bearer <JWT>`。

### 6.1 Webhook（无 JWT，签名鉴权）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/webhooks/github` | GitHub `pull_request` 事件，HMAC-SHA256 签名校验 |
| POST | `/api/webhooks/gitlab` | GitLab `Merge Request Hook`，`X-Gitlab-Token` 校验 |

响应：`202 Accepted`（已入队）/ `200 OK`（事件被忽略）/ `401`（签名非法）。

### 6.2 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | body: `{ email, password }`，返回 `{ accessToken, user }` |
| GET | `/api/v1/auth/me` | 返回当前用户信息 |

JWT 有效期 12h，payload 携带 `sub`（userId）与 `role`；`ADMIN` 独占项目与账号管理接口（`RolesGuard` 控制）。

### 6.3 项目管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/projects` | 项目列表 |
| POST | `/api/v1/projects` | 接入新仓库，body: `{ name, platform, repoFullName, accessToken }`，返回体中携带生成的 `webhookSecret` 与 Webhook 配置指引 URL |
| PATCH | `/api/v1/projects/:id` | 更新配置 / 启停 |
| DELETE | `/api/v1/projects/:id` | 移除项目 |

### 6.4 知识库管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/knowledge/documents` | multipart 上传（md/pdf，≤10MB），query: `projectId`；立即返回 `PROCESSING` 状态的文档记录 |
| GET | `/api/v1/knowledge/documents?projectId=` | 文档列表（含摄取状态，前端轮询用） |
| DELETE | `/api/v1/knowledge/documents/:id` | 删除文档（级联删除 chunks） |
| POST | `/api/v1/knowledge/search` | 调试用检索接口，body: `{ projectId, query, topK }` |

### 6.5 审查记录

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/reviews` | 分页查询，query: `projectId? / verdict? / page / pageSize`，返回任务 + 结论摘要 |
| GET | `/api/v1/reviews/:taskId` | 详情：完整 Markdown 评论 + issue 列表 |
| POST | `/api/v1/reviews/:taskId/retry` | 失败任务手动重新入队 |

### 6.6 大盘统计

| 方法 | 路径 | 返回示例 |
| --- | --- | --- |
| GET | `/api/v1/stats/overview?range=7d` | `{ totalReviews, criticalBlocked, passRate, avgDurationMs }` |
| GET | `/api/v1/stats/trend?range=30d&interval=week` | `[{ period: "2026-W27", passed: 41, warning: 12, rejected: 3 }]` |
| GET | `/api/v1/stats/top-violations?range=30d&limit=10` | `[{ ruleTitle: "React Hooks 依赖项规范", count: 23 }]` |
| GET | `/api/v1/stats/by-project?range=30d` | `[{ projectName, total, passRate }]` |

统计接口底层是 Prisma `groupBy` / `count` 聚合。前端 `/dashboard` 页为 RSC 时可直连 `StatsService` 同构复用，也可走 HTTP —— 本方案选择 **RSC 直调后端 HTTP API**（见 7.3），保持统计逻辑单点在 NestJS。

---

## 7. 前端设计（Next.js 14 App Router）

### 7.1 页面与路由

| 路由 | 类型 | 功能 |
| --- | --- | --- |
| `/login` | Client | 邮箱密码登录，JWT 存 httpOnly cookie |
| `/dashboard` | Server Component | 质量大盘：核心指标卡、通过率趋势图、违规 TopN、项目对比 |
| `/knowledge-base` | Server + Client 混合 | 规范文档列表、拖拽上传、摄取状态轮询、检索调试 |
| `/review-logs` | Server + Client 混合 | 审查记录分页/筛选列表、详情抽屉（虚拟列表渲染长评论） |
| `/projects` | Server + Client 混合 | 仓库接入配置、Webhook 配置指引展示 |

### 7.2 目录结构

```text
apps/web/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (main)/                      # 带侧边栏的主布局分组
│   │   ├── layout.tsx               # 侧边栏 + 顶栏，校验登录态
│   │   ├── dashboard/page.tsx       # RSC，直接 await 统计接口
│   │   ├── knowledge-base/
│   │   │   ├── page.tsx             # RSC，文档列表
│   │   │   └── actions.ts           # Server Actions: 上传/删除文档
│   │   ├── review-logs/page.tsx
│   │   └── projects/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── charts/                      # "use client"：Recharts 封装
│   │   ├── trend-chart.tsx
│   │   ├── violation-bar.tsx
│   │   └── verdict-pie.tsx
│   ├── knowledge/upload-dropzone.tsx    # "use client"：拖拽上传
│   ├── reviews/review-detail-drawer.tsx # "use client"：虚拟列表详情
│   └── ui/                          # 按钮、卡片、表格等基础组件
├── lib/
│   ├── api-client.ts                # 服务端 fetch 封装（注入 JWT、错误归一化）
│   └── auth.ts                      # cookie 读写、middleware 鉴权工具
└── middleware.ts                    # 未登录访问 (main) 分组时重定向 /login
```

### 7.3 数据获取与 Server/Client 边界

- **RSC 拉数据**：所有页面级数据在 Server Component 中 `fetch` NestJS API（携带 cookie 中的 JWT），HTML 直出，实现零 Loading 首屏。统计接口用 `next: { revalidate: 60 }` 做 60s 缓存。
- **Client Component 只负责交互**：图表渲染（Recharts 依赖浏览器环境）、拖拽上传、虚拟滚动、筛选表单。数据从 RSC 以 props 下传，避免客户端二次请求。
- **Server Actions**：知识库上传/删除、项目表单提交走 Server Actions，提交后 `revalidatePath` 刷新列表；上传后的摄取状态由客户端组件以 5s 间隔轮询文档列表接口，直到全部 `READY/FAILED`。
- **不直连 Prisma 的取舍说明**：草案建议 RSC 直连 Prisma。本方案改为 RSC 调 NestJS HTTP API，理由是统计与鉴权逻辑单点维护在后端，前端不需要数据库凭据、部署解耦；RSC 直出的性能收益（服务端渲染、零客户端 Loading）不受影响。

### 7.4 大盘页面设计（/dashboard）

```tsx
// app/(main)/dashboard/page.tsx（Server Component）
export default async function DashboardPage({ searchParams }: Props) {
  const range = searchParams.range ?? '7d';
  const [overview, trend, violations, byProject] = await Promise.all([
    api.get(`/stats/overview?range=${range}`),
    api.get(`/stats/trend?range=30d&interval=week`),
    api.get(`/stats/top-violations?range=30d&limit=10`),
    api.get(`/stats/by-project?range=30d`),
  ]);
  return (
    <>
      <MetricCards data={overview} />          {/* 拦截高危数 / 通过率 / 审查总数 */}
      <TrendChart data={trend} />              {/* Client: 通过率趋势折线 */}
      <ViolationBar data={violations} />       {/* Client: 最常违反规范横向柱状图 */}
      <ProjectTable data={byProject} />        {/* RSC: 项目质量对比表 */}
    </>
  );
}
```

### 7.5 审查日志页（/review-logs）

- 列表：RSC 分页查询 `/reviews`，筛选条件（项目、结论、时间范围）通过 URL searchParams 驱动，可分享链接。
- 详情：点击行打开 Client 抽屉，加载 `/reviews/:taskId`；AI 评论 Markdown 用 `react-markdown` + `rehype-highlight` 渲染代码高亮；issue 列表超过 100 条时使用 `@tanstack/react-virtual` 虚拟滚动。

### 7.6 视觉与交互规范

- TailwindCSS + CSS 变量主题；结论色彩语义固定：PASSED 绿色、WARNING 琥珀、REJECTED 红色，与 PR 评论中的徽章一致。
- 响应式断点：大盘卡片 `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`；表格在窄屏降级为卡片列表。
- 所有异步操作（上传、重试审查）用 toast 反馈结果，失败展示后端 message。

---

## 8. 工程结构与部署

### 8.1 Monorepo 结构（pnpm workspace）

```text
code-guard/
├── apps/
│   ├── server/                  # NestJS：网关 + Worker
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── webhook/
│   │   │   │   ├── queue/
│   │   │   │   ├── git-client/
│   │   │   │   ├── review-engine/   # LangGraph 节点与状态定义
│   │   │   │   ├── knowledge/
│   │   │   │   ├── stats/
│   │   │   │   └── auth/
│   │   │   ├── prisma/prisma.service.ts
│   │   │   └── main.ts
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   └── web/                     # Next.js 14 管理后台
├── packages/
│   └── shared/                  # 前后端共享：ReviewJobPayload、API DTO、枚举
├── docker-compose.yml
├── pnpm-workspace.yaml
└── .env.example
```

### 8.2 docker-compose

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: codeguard
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    volumes: ["redisdata:/data"]
    ports: ["6379:6379"]

  server:
    build: { context: ., dockerfile: apps/server/Dockerfile }
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/codeguard
      REDIS_URL: redis://redis:6379
      APP_ROLE: all            # gateway | worker | all
    env_file: .env
    depends_on: [postgres, redis]
    ports: ["3001:3001"]

  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    environment:
      API_BASE_URL: http://server:3001/api/v1
    depends_on: [server]
    ports: ["3000:3000"]

volumes:
  pgdata:
  redisdata:
```

### 8.3 环境变量清单

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `REDIS_URL` | Redis 连接串（BullMQ） |
| `APP_ROLE` | `gateway` / `worker` / `all`，控制进程角色 |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 大模型接入（OpenAI 协议兼容） |
| `EMBEDDING_MODEL` | 默认 `text-embedding-3-small` |
| `JWT_SECRET` | 管理端 JWT 签名密钥 |
| `TOKEN_ENCRYPTION_KEY` | Git accessToken 的 AES-256-GCM 加密密钥 |
| `REVIEW_CONCURRENCY` | Worker 并发度，默认 2 |

### 8.4 可观测性

- **结构化日志**：nestjs-pino 输出 JSON 日志，每条审查日志携带 `taskId` 贯穿 Webhook → 队列 → LangGraph 各节点 → 回写，全链路可追踪。
- **队列监控**：挂载 `@bull-board/nestjs` 于 `/admin/queues`（ADMIN 角色可见），可视化查看等待/失败任务、手动重试死信。
- **成本监控**：每次 LLM 调用的 token 用量落 `ReviewRecord.tokenUsage`，大盘可扩展"本月 Token 消耗"指标。
- **告警钩子**：任务进入 FAILED（重试耗尽）时输出 error 级日志，可对接企业 IM Webhook 通知值班人。

---

## 9. 里程碑规划

```mermaid
flowchart LR
    M1["M1 事件链路打通<br/>(约 1.5 周)"] --> M2["M2 AI 审查上线<br/>(约 2 周)"]
    M2 --> M3["M3 RAG 知识库<br/>(约 1.5 周)"]
    M3 --> M4["M4 管理后台大盘<br/>(约 2 周)"]
```

| 里程碑 | 交付内容 | 验收标准 |
| --- | --- | --- |
| **M1 事件链路** | Monorepo 脚手架、Prisma 基础表、WebhookModule（双平台签名校验）、BullMQ 队列、GitClientModule 拉取 Diff | 提交一个测试 PR，后台能收到事件、入队、拉到 Diff 并打印，Webhook 响应 < 100ms |
| **M2 AI 审查** | LangGraph 五节点流水线（此阶段 KnowledgeRetrieval 返回空规范）、结构化输出、评论与行内 Suggestion 回写、ReviewRecord/Issue 落库 | 测试 PR 收到分级审查评论；含 SQL 注入的样例代码被标记 CRITICAL 且 verdict=REJECTED |
| **M3 RAG 知识库** | 文档上传/解析/分块/向量化流水线、pgvector HNSW 检索、检索结果注入 Prompt、知识库管理 API | 上传一份团队规范后，违反该规范的 PR 评论中能引用对应规范标题（ruleTitle 命中） |
| **M4 管理后台** | Next.js 登录鉴权、大盘四类图表、知识库管理页、审查日志页、项目接入页、docker-compose 一键部署 | Tech Lead 可完成"接入仓库 → 上传规范 → 查看大盘趋势与违规 TopN"完整闭环 |

### 风险与预案

| 风险 | 预案 |
| --- | --- |
| LLM 输出 JSON 不稳定 | structured output + 解析失败单批重试 + 跳过降级（3.5 节），必要时切换支持 function calling 的模型 |
| 大 PR 撑爆上下文 | 按文件/hunk 分批 + 优先级截断（3.5 节），评论中透明告知未覆盖范围 |
| LLM API 限流 | 队列并发度 + 指数退避为主，预算允许时申请更高 RPM 或多 Key 轮询 |
| 误报打扰开发者 | severity 分级展示，INFO 类问题折叠；后续迭代可加"误报反馈"按钮回流优化 Prompt |
| Webhook 密钥泄露 | 每项目独立 secret，支持在项目设置中一键轮换 |
