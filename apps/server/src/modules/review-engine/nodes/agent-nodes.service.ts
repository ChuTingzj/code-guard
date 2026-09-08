import { Injectable, Logger } from '@nestjs/common';
import { createReviewModel } from '../llm.factory';
import { ReviewState, ReviewIssueItem } from '../review-state';
import {
  batchDiffFiles,
  formatDiffBatch,
  formatRules,
  issueArraySchema,
  toIssueItems,
} from '../diff-batch.util';

@Injectable()
export class AgentNodesService {
  private readonly logger = new Logger(AgentNodesService.name);

  async runStyle(state: ReviewState): Promise<Partial<ReviewState>> {
    const issues = await this.runCategoryAgent(state, {
      category: 'STYLE',
      system: `你是团队的代码风格审查员。你只关注命名、格式、可读性、Hooks 使用等风格问题，不评价安全性和架构。
以下是团队私有规范（最高准则，优先级高于通用惯例）：
${formatRules(state.retrievedRules)}

审查规则：
- 只针对 Diff 中【新增或修改】的行提出问题，不评价未改动的旧代码
- 每个问题必须给出 filePath 与 line（对应新文件行号）
- 命中私有规范时必须填写 ruleTitle
- 无问题时返回空数组，禁止编造问题凑数`,
    });
    return { styleIssues: issues.items, tokenUsage: issues.tokenUsage };
  }

  async runSecurity(state: ReviewState): Promise<Partial<ReviewState>> {
    const issues = await this.runCategoryAgent(state, {
      category: 'SECURITY',
      severityFilter: ['WARNING', 'CRITICAL'],
      system: `你是安全审查员。检查 SQL/命令注入、XSS、硬编码密钥、越权、不安全反序列化、敏感信息日志泄露等 OWASP 风险。
以下是团队私有规范：
${formatRules(state.retrievedRules)}

规则：
- severity 只允许 WARNING 或 CRITICAL（不允许 INFO）
- description 需说明攻击场景
- 只评 Diff 新增/修改行
- 命中私有规范时填写 ruleTitle
- 无问题返回空数组`,
    });
    return { securityIssues: issues.items, tokenUsage: issues.tokenUsage };
  }

  async runArchitecture(state: ReviewState): Promise<Partial<ReviewState>> {
    const prior = [
      ...state.styleIssues,
      ...state.securityIssues,
    ]
      .map((i) => `- [${i.category}] ${i.filePath}:${i.line ?? '?'} ${i.description}`)
      .join('\n');

    const tree = state.diffFiles.map((f) => f.filePath).join('\n');

    const issues = await this.runCategoryAgent(state, {
      category: 'ARCHITECTURE',
      system: `你是架构审查员。关注组件/模块耦合、职责越界、循环依赖、与分层架构规范的偏离。
以下是团队私有规范：
${formatRules(state.retrievedRules)}

变更文件路径树：
${tree}

前置 Agent 已报告的问题（请勿重复）：
${prior || '（无）'}

规则：只评 Diff 新增/修改行；命中规范填 ruleTitle；无问题返回空数组。`,
    });
    return { architectureIssues: issues.items, tokenUsage: issues.tokenUsage };
  }

  private async runCategoryAgent(
    state: ReviewState,
    opts: {
      category: ReviewIssueItem['category'];
      system: string;
      severityFilter?: Array<ReviewIssueItem['severity']>;
    },
  ): Promise<{ items: ReviewIssueItem[]; tokenUsage: { prompt: number; completion: number } }> {
    const model = createReviewModel();
    const structured = model.withStructuredOutput(issueArraySchema);
    const batches = batchDiffFiles(state.diffFiles);
    const all: ReviewIssueItem[] = [];
    let prompt = 0;
    let completion = 0;

    for (const batch of batches) {
      const human = formatDiffBatch(batch);
      let attempt = 0;
      while (attempt < 2) {
        try {
          const result = await structured.invoke([
            { role: 'system', content: opts.system },
            { role: 'human', content: human },
          ]);
          all.push(...toIssueItems(result, opts.category, opts.severityFilter));
          // approximate token usage
          prompt += Math.ceil((opts.system.length + human.length) / 4);
          completion += Math.ceil(JSON.stringify(result).length / 4);
          break;
        } catch (err) {
          attempt += 1;
          this.logger.warn(
            `${opts.category} batch failed (attempt ${attempt}): ${err}`,
          );
          if (attempt >= 2) {
            this.logger.warn(`Skipping batch for ${opts.category}`);
          }
        }
      }
    }

    return { items: all, tokenUsage: { prompt, completion } };
  }
}
