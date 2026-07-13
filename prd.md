# 📄 项目二 PRD：面向研发团队的全自动代码审查助手 (Auto-Dev QA Agent)

## 1. 产品概述与背景

- **产品名称**：CodeGuard AI 审查助手
- **业务痛点**：团队代码 Review 耗时费力，且标准难以统一（如安全规范、特定架构的最佳实践）。新人入职后，Tech Lead 往往需要花费大量时间进行代码纠偏。
- **产品愿景**：将代码审查左移（Shift-Left），打造一个无感接入 GitLab/GitHub 工作流的 AI 审查平台。AI 结合公司私有代码规范，在 PR/MR 阶段自动进行多维度审查并给出修改建议，甚至提供可直接一键 Merge 的代码补丁。

## 2. 目标用户

- **一线开发者**：提交代码后自动获得 Review 意见。
- **Tech Lead / 架构师**：维护团队私有规范库，监控团队代码质量趋势。

## 3. 核心功能模块与用户故事 (User Stories)

### 3.1 Webhook 事件总线与异步调度 (Backend - NestJS)

- **需求描述**：平台需要无缝集成到现有的 DevOps 流程中。
- **用户故事**：作为开发者，当我向 GitLab 提交一个 Merge Request 时，平台能自动捕获该事件，拉取 Diff 代码并开始分析，不需要我进行任何额外操作。
- **技术实现**：NestJS 暴露 Webhook 接口，接收事件后存入 Redis 消息队列，进行削峰填谷，避免并发提交时压垮大模型 API。

### 3.2 审查智能体编排 (AI Core - LangGraph)

- **需求描述**：将审查拆分为多个专业领域，避免大模型“泛泛而谈”。
- **Agent 工作流流转**：
  - **Syntax & Style Agent**：检查基本语法和命名规范。
  - **Security Agent**：检查潜在的漏洞（如 SQL 注入风险、越权风险）。
  - **Architecture Agent**：结合项目全局上下文，审查组件是否过度耦合。
  - **Action Agent**：综合前面的意见，直接在 GitLab/GitHub 的 PR 评论区进行回复，若问题明确，直接生成一段代码 Diff Patch。

### 3.3 私有代码规范 RAG 知识库 (Knowledge Base - PostgreSQL pgvector + Prisma)

- **需求描述**：AI 必须“懂团队规矩”，不能只给通用建议。
- **用户故事**：作为 Tech Lead，我可以上传团队内部的《前端架构规范文档》和过去优秀的 PR 代码，AI 审查时会以这些文档作为最高准则。
- **技术实现**：文档通过 LangChain 进行分块打散（Chunking）和向量化（Embedding），存入 PostgreSQL 的 `pgvector` 扩展库中。每次 AI Review 前，先通过 RAG 检索相关的团队规范注入 Prompt。

### 3.4 研发质量数据大盘 (Frontend - Next.js)

- **需求描述**：提供给管理层的代码质量看板。
- **用户故事**：作为架构师，我可以通过平台查看每周拦截了多少次高危提交、最常违反的规范是什么、各个项目的 AI 审查通过率趋势。
- **技术实现**：Next.js + TailwindCSS 构建响应式管理后台，提供规则配置表单、RAG 知识库管理界面和可视化数据面板