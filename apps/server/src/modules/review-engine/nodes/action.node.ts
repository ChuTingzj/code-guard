import { Injectable, Logger } from '@nestjs/common';
import { createReviewModel } from '../llm.factory';
import {
  ReviewState,
  ReviewIssueItem,
  computeVerdict,
} from '../review-state';
import { GitProviderFactory } from '../../git-client/git-provider.factory';
import { PrismaService } from '../../prisma/prisma.service';
import { z } from 'zod';

const summarySchema = z.object({
  markdown: z.string(),
});

@Injectable()
export class ActionNodeService {
  private readonly logger = new Logger(ActionNodeService.name);

  constructor(
    private readonly gitFactory: GitProviderFactory,
    private readonly prisma: PrismaService,
  ) {}

  async run(state: ReviewState): Promise<Partial<ReviewState>> {
    const started = Date.now();
    const allIssues: ReviewIssueItem[] = [
      ...state.styleIssues,
      ...state.securityIssues,
      ...state.architectureIssues,
    ];
    const verdict = computeVerdict(allIssues);

    let markdown: string;
    let tokenUsage = { prompt: 0, completion: 0 };

    if (allIssues.length === 0) {
      markdown = `## CodeGuard AI — PASSED\n\nLGTM — 未发现需要关注的问题。`;
    } else {
      try {
        const model = createReviewModel().withStructuredOutput(summarySchema);
        const issuesText = allIssues
          .map(
            (i, idx) =>
              `${idx + 1}. [${i.severity}/${i.category}] ${i.filePath}:${i.line ?? 'n/a'} — ${i.description}` +
              (i.suggestion ? `\n   建议: ${i.suggestion}` : '') +
              (i.ruleTitle ? `\n   规范: ${i.ruleTitle}` : '') +
              (i.patch ? `\n   patch:\n\`\`\`\n${i.patch}\n\`\`\`` : ''),
          )
          .join('\n');

        const result = await model.invoke([
          {
            role: 'system',
            content: `你是 CodeGuard Action Agent。根据问题列表生成 PR 评论 Markdown。
格式要求：
1. 顶部结论徽章：## CodeGuard AI — ${verdict}
2. 问题数统计表（按 severity）
3. 按 severity 分组列出问题，附文件位置与建议
4. 对有 patch 的问题使用平台 suggestion 代码块语法（GitHub: \`\`\`suggestion / GitLab: \`\`\`suggestion:-0+0）
5. 简洁专业，中文`,
          },
          { role: 'human', content: `平台: ${state.platform}\n\n问题列表:\n${issuesText}` },
        ]);
        markdown = result.markdown;
        tokenUsage = {
          prompt: Math.ceil(issuesText.length / 4),
          completion: Math.ceil(markdown.length / 4),
        };
      } catch (err) {
        this.logger.warn(`Summary LLM failed, using template: ${err}`);
        markdown = this.fallbackMarkdown(verdict, allIssues);
      }
    }

    if (state.truncatedNote) {
      markdown += `\n\n> ${state.truncatedNote}`;
    }

    try {
      const { provider, repoFullName } = await this.gitFactory.forProject(state.projectId);
      await provider.postComment(repoFullName, state.prNumber, markdown);

      for (const issue of allIssues) {
        if (issue.line == null || !issue.patch) continue;
        const suggestionFence =
          state.platform === 'GITHUB' ? '```suggestion' : '```suggestion:-0+0';
        const body = `${issue.description}\n\n${suggestionFence}\n${issue.patch}\n\`\`\``;
        await provider.postInlineSuggestion(repoFullName, state.prNumber, {
          filePath: issue.filePath,
          line: issue.line,
          body,
          commitSha: state.headSha,
        });
      }
    } catch (err) {
      this.logger.warn(`Git write-back skipped/failed: ${err}`);
    }

    const durationMs = Date.now() - started;
    const tokenPayload = {
      prompt: (state.tokenUsage?.prompt ?? 0) + tokenUsage.prompt,
      completion: (state.tokenUsage?.completion ?? 0) + tokenUsage.completion,
    };

    await this.prisma.reviewRecord.upsert({
      where: { taskId: state.taskId },
      create: {
        taskId: state.taskId,
        verdict,
        finalMarkdown: markdown,
        tokenUsage: tokenPayload,
        durationMs,
        issues: {
          create: allIssues.map((i) => ({
            category: i.category,
            severity: i.severity,
            filePath: i.filePath,
            line: i.line,
            ruleTitle: i.ruleTitle,
            description: i.description,
            suggestion: i.suggestion,
            patch: i.patch,
          })),
        },
      },
      update: {
        verdict,
        finalMarkdown: markdown,
        tokenUsage: tokenPayload,
        durationMs,
        issues: {
          deleteMany: {},
          create: allIssues.map((i) => ({
            category: i.category,
            severity: i.severity,
            filePath: i.filePath,
            line: i.line,
            ruleTitle: i.ruleTitle,
            description: i.description,
            suggestion: i.suggestion,
            patch: i.patch,
          })),
        },
      },
    });

    return { finalMarkdown: markdown, verdict, tokenUsage };
  }

  private fallbackMarkdown(verdict: string, issues: ReviewIssueItem[]): string {
    const counts = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    for (const i of issues) counts[i.severity] += 1;
    const lines = issues
      .map(
        (i) =>
          `- **[${i.severity}]** \`${i.filePath}:${i.line ?? '?'}\` ${i.description}` +
          (i.ruleTitle ? ` _(规范: ${i.ruleTitle})_` : ''),
      )
      .join('\n');
    return `## CodeGuard AI — ${verdict}

| CRITICAL | WARNING | INFO |
| --- | --- | --- |
| ${counts.CRITICAL} | ${counts.WARNING} | ${counts.INFO} |

${lines}`;
  }
}
