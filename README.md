# CodeGuard AI 审查助手

面向研发团队的全自动代码审查助手：Webhook 触发 → BullMQ 削峰 → LangGraph 多智能体审查 → 私有规范 RAG → 质量大盘。

## 架构

- `apps/server` — NestJS 网关 + Worker（Webhook / BullMQ / LangGraph / Prisma）
- `apps/web` — Next.js 14 管理后台
- `packages/shared` — 共享类型与队列常量

## 快速开始

### 1. 依赖与环境

```bash
cp .env.example .env
pnpm install          # postinstall 会将根目录 .env 软链到 apps/server、apps/web
docker compose up -d postgres redis
pnpm db:generate
pnpm --filter @code-guard/server prisma:migrate:dev
# 或已有 migration：pnpm db:migrate
pnpm db:seed
```

环境变量只维护仓库根目录的 `.env`。`pnpm env:link`（以及 `postinstall` / `dev*` / `db:migrate` / `db:seed`）会把它映射到各 workspace，Prisma / Nest / Next 在包目录下运行时即可读取。

默认管理员：`admin@codeguard.local` / `Admin123!`

### 2. 本地开发

```bash
pnpm --filter @code-guard/shared build
pnpm dev:server   # http://localhost:3001
pnpm dev:web      # http://localhost:3000
```

健康检查：`GET http://localhost:3001/api/health`

### 3. 接入仓库

1. 登录管理后台 → **项目管理** → 创建项目（填写 Access Token）
2. 将返回的 `webhookUrl` / `webhookSecret` 配置到 GitHub/GitLab Webhook
3. 在 **规范知识库** 上传 Markdown/PDF 团队规范
4. 打开测试 PR/MR，等待审查评论；在 **审查日志** / **质量大盘** 查看结果

### 4. 一键部署

```bash
cp .env.example .env   # 填入 LLM_API_KEY 等
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Bull Board: http://localhost:3001/admin/queues

### 验收

```bash
pnpm test:unit
pnpm e2e:checklist   # 需先启动 server
```

手动闭环：登录 → 建项目 → 配 Webhook → 上传规范 → 开 PR → 评论 + 大盘数据。

## 环境变量

见 [`.env.example`](.env.example)。关键项：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` / `REDIS_URL` | Postgres + Redis |
| `LLM_*` / `EMBEDDING_MODEL` | OpenAI 兼容大模型 |
| `JWT_SECRET` / `TOKEN_ENCRYPTION_KEY` | 鉴权与 Token 加密 |
| `APP_ROLE` | `gateway` / `worker` / `all` |

## 里程碑验收

| 里程碑 | 标准 |
| --- | --- |
| M1 | Webhook 入队 + 拉 Diff 日志，响应 &lt; 100ms |
| M2 | PR 收到分级评论；SQL 注入样例 → CRITICAL / REJECTED |
| M3 | 上传规范后 `ruleTitle` 命中 |
| M4 | 接入仓库 → 上传规范 → 大盘闭环 |

## License

Private
