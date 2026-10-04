# CodeGuard 团队编码规范

> 版本：1.0.0  
> 适用范围：本仓库全部 TypeScript / NestJS / Next.js 代码  
> 生效日期：2026-09-11  
> 维护人：Tech Lead  
> 用途说明：本文件用于知识库上传与 RAG 检索联调；审查引擎命中下列章节标题时，应在评论中回填对应 `ruleTitle`。

---

## 1. 总则

1. 私有规范优先级高于通用最佳实践；冲突时以本文件为准。
2. 所有对外 API、Webhook、异步任务必须可观测：结构化日志 + 明确错误码。
3. 禁止将密钥、Token、连接串写入代码或提交到 Git；统一走环境变量或密钥管理服务。
4. 新增能力必须附带最小可验证路径（单测、脚本或手动验收清单）。

---

## 2. 命名与目录规范

### 2.1 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 文件/目录 | kebab-case | `review.processor.ts` |
| 类 / 类型 | PascalCase | `ReviewProcessor` |
| 函数 / 变量 | camelCase | `enqueueReview` |
| 常量 | UPPER_SNAKE_CASE | `MAX_DIFF_BYTES` |
| Prisma 模型 | PascalCase | `ReviewIssue` |
| 环境变量 | UPPER_SNAKE_CASE | `DATABASE_URL` |

### 2.2 禁止事项

- 禁止使用无意义缩写（如 `tmpMgr`、`doStuff`）。
- 禁止在同一模块混用中英文标识符作为公开 API 名称。
- React 组件文件名与默认导出组件名保持一致。

---

## 3. TypeScript 与代码风格规范

### 3.1 类型安全

- 禁止使用 `any`；确需逃逸时使用 `unknown` 并在边界处收窄。
- 对联合类型与枚举的 `switch` 必须写穷尽检查（`default` 分支用 `never`）。
- 公共函数参数与返回值必须显式标注类型；禁止依赖隐式 `any`。

### 3.2 控制流与复杂度

- 单个函数建议不超过 50 行；超过时拆分私有辅助函数。
- 圈复杂度超过 10 必须重构或补充说明为何不可拆。
- 禁止深层嵌套（超过 3 层）；优先早返回（early return）。

### 3.3 魔法数字

- 业务阈值、超时、重试次数必须提取为命名常量。
- 示例：`const MAX_DIFF_FILES = 30`、`const MAX_DIFF_BYTES = 60 * 1024`。

### 3.4 导入规范

- 所有 import 置于文件顶部；禁止函数体内动态 import（除非有文档化的循环依赖原因）。
- 同模块相对路径优先；跨包使用 workspace 包名。

---

## 4. React / Next.js 规范

### 4.1 Hooks 依赖项规范

- `useEffect` / `useMemo` / `useCallback` 的依赖数组必须完整；禁止故意省略依赖来“绕过”警告。
- 若依赖变化会导致多余执行，应重构数据流，而不是禁用 eslint 规则。
- Server Component 默认；仅在需要交互或浏览器 API 时使用 `"use client"`。

### 4.2 数据获取

- 页面级数据优先在 Server Component / Server Action 中获取。
- 客户端轮询（如知识库摄取状态）间隔不得短于 5 秒，并在 `READY` / `FAILED` 后停止。
- 禁止在 Client Component 中直接持有数据库凭据或服务端密钥。

### 4.3 UI 与可访问性

- 交互控件必须有可见标签或 `aria-label`。
- 错误状态需对用户可读，禁止仅 `console.error`。

---

## 5. NestJS / 后端规范

### 5.1 模块边界

- 按业务域划分 Module（Webhook、Queue、Knowledge、ReviewEngine 等），禁止跨模块直接访问对方私有 Provider。
- Controller 只做参数校验与编排；业务逻辑放在 Service。
- 与外部系统（GitHub/GitLab/LLM）的调用必须通过独立 Client / Provider 抽象。

### 5.2 Webhook 与幂等

- 所有 Webhook 必须校验签名；校验失败返回 401/403，不得入队。
- 同一事件 ID 必须幂等去重；重复投递不得产生重复审查任务。
- Webhook 处理应快速返回 200；重活一律入队异步执行。

### 5.3 队列与重试

- 审查任务使用 BullMQ；失败采用指数退避，超过上限进入死信并告警。
- Worker 并发需可配置；默认全局 LLM 并发受控，避免打爆上游配额。
- 任务 payload 只存必要 ID 与元数据，禁止塞入完整 Diff 大对象到 Redis。

---

## 6. 安全规范

### 6.1 输入与注入防护

- 所有外部输入（Webhook body、查询参数、上传文件名）必须校验与消毒。
- 禁止字符串拼接构造 SQL；一律使用参数化查询或 Prisma API。
- 禁止将用户可控内容直接拼进 LLM System Prompt 指令段而不做边界隔离。

### 6.2 密钥与权限

- GitHub App Token / GitLab Access Token 按项目隔离存储，禁止日志打印明文。
- 管理后台接口按角色鉴权：`TECH_LEAD` 可管理知识库；普通成员只读审查结果。
- 上传文件限制类型与大小；拒绝可执行脚本与未知 MIME。

### 6.3 依赖与供应链

- 新增生产依赖需说明用途；禁止引入长期无人维护的包。
- CI 中应运行基础依赖漏洞扫描；高危漏洞合并前必须修复或豁免说明。

### 6.4 安全问题定级

| 级别 | 含义 | 示例 |
|------|------|------|
| CRITICAL | 可直接导致数据泄露、未授权访问或 RCE | SQL 注入、签名校验绕过 |
| WARNING | 存在可利用风险但需额外条件 | 敏感信息进日志、过宽 CORS |
| INFO | 加固建议 | 缺少安全响应头 |

安全类问题最低级别为 WARNING，不得降为 INFO。

---

## 7. 架构与分层规范

### 7.1 分层约束

- UI 层（Next.js）不得直接访问数据库连接细节以外的基础设施；聚合查询可通过约定的 Server 路径，但不得绕过鉴权。
- 审查引擎不得直接操作 Webhook Controller；通过队列解耦。
- RAG 检索结果只作为 Prompt 增强，不得替代鉴权与业务校验。

### 7.2 耦合控制

- 禁止循环依赖；出现时通过抽接口或事件解耦。
- 一个 Module 变更不应迫使无关 Module 同步大改；共享逻辑下沉到明确的共享包。
- Diff 审查链路中，SecurityAgent 已报告的问题，ArchitectureAgent 不得重复报告同一行同一根因。

### 7.3 大 PR 防护

- 变更超过 30 个文件或 Diff 超过 60KB 时，优先审查业务代码，排除 lockfile、生成物、图片。
- 截断后必须在最终评论中注明“部分文件因体积原因未审查”。

---

## 8. Git 与 Code Review 规范

### 8.1 提交

- Commit message 说明“为什么”，而非堆砌文件列表。
- 禁止提交 `.env`、密钥文件、本地数据库 dump。
- 单次 PR 聚焦一个主题；重构与功能变更尽量拆分。

### 8.2 审查结论对齐

CodeGuard 审查结论规则：

- 任一 CRITICAL → `REJECTED`
- 无 CRITICAL 但有 WARNING → `WARNING`
- 仅 INFO 或无问题 → `PASSED`

人工 Review 应参考机器人结论，但最终合入权仍在具备权限的 Reviewer。

---

## 9. 知识库文档维护规范

### 9.1 文档结构

- 每份规范文档使用清晰的二级/三级标题；标题应可被检索引用（如“React Hooks 依赖项规范”）。
- 规则尽量可判定：写清“必须 / 禁止 / 建议”，避免纯口号。
- 示例代码优先给“错误示例 + 正确示例”对照。

### 9.2 变更流程

1. 在本文件或独立专题文档中修改条文。
2. Tech Lead 审核后上传/更新知识库。
3. 等待摄取状态变为 `READY`。
4. 用故意违规的样例 PR 验证 `ruleTitle` 是否命中。

### 9.3 检索验收清单（联调用）

上传本文件后，可用下列查询词验证检索：

- “React Hooks 依赖项”
- “Webhook 签名校验”
- “禁止 any”
- “SQL 注入”
- “大 PR 防护 60KB”
- “TECH_LEAD 知识库”

期望：Top-K 结果能回到对应章节，且审查评论可引用章节标题。

---

## 10. 附录：快速对照表

| 场景 | 规范要点 | 建议 ruleTitle |
|------|----------|----------------|
| `useEffect` 缺依赖 | 依赖必须完整 | React Hooks 依赖项规范 |
| Webhook 未验签 | 必须验签后再入队 | Webhook 与幂等 |
| 使用 `any` | 禁止，改用 unknown | TypeScript 与代码风格规范 |
| 字符串拼 SQL | 禁止，用参数化 | 输入与注入防护 |
| UI 直连敏感基础设施 | 违反分层 | 分层约束 |
| Diff 过大不截断 | 触发大 PR 防护 | 大 PR 防护 |

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-09-11 | 初稿，用于知识库上传与 RAG 检索联调 |
