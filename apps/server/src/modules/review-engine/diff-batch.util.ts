import { z } from 'zod';
import { PrDiffFile } from '../git-client/git-provider.interface';
import { ReviewIssueItem } from './review-state';

export const issueSchema = z.object({
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  filePath: z.string(),
  line: z.number().nullable(),
  ruleTitle: z.string().nullable(),
  description: z.string(),
  suggestion: z.string().nullable(),
  patch: z.string().nullable(),
});

export const issueArraySchema = z.object({
  issues: z.array(issueSchema),
});

const BATCH_CHAR_BUDGET = 8_000 * 4; // rough ~8k tokens
const TOTAL_CHAR_BUDGET = 32_000 * 4;

export function prioritizeFiles(files: PrDiffFile[]): PrDiffFile[] {
  const score = (p: string) => {
    if (/\.(test|spec)\./.test(p)) return 2;
    if (/\.(json|ya?ml|toml|md)$/.test(p)) return 1;
    return 0;
  };
  return [...files].sort((a, b) => score(a.filePath) - score(b.filePath));
}

export function batchDiffFiles(files: PrDiffFile[]): PrDiffFile[][] {
  const prioritized = prioritizeFiles(files);
  const batches: PrDiffFile[][] = [];
  let current: PrDiffFile[] = [];
  let currentSize = 0;
  let total = 0;

  for (const f of prioritized) {
    const size = (f.patch?.length ?? 0) + f.filePath.length;
    if (total + size > TOTAL_CHAR_BUDGET) break;
    if (currentSize + size > BATCH_CHAR_BUDGET && current.length) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(f);
    currentSize += size;
    total += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

export function formatDiffBatch(files: PrDiffFile[]): string {
  return files
    .map((f) => {
      const lines = (f.patch || '').split('\n');
      let newLine = 0;
      const numbered = lines
        .map((line) => {
          if (line.startsWith('@@')) {
            const m = line.match(/\+(\d+)/);
            if (m) newLine = Number(m[1]) - 1;
            return line;
          }
          if (line.startsWith('+') && !line.startsWith('+++')) {
            newLine += 1;
            return `${newLine}|${line}`;
          }
          if (line.startsWith('-') && !line.startsWith('---')) {
            return `  |${line}`;
          }
          if (!line.startsWith('\\')) {
            newLine += 1;
            return `${newLine}|${line}`;
          }
          return line;
        })
        .join('\n');
      return `### ${f.filePath} (${f.language}, ${f.status})\n\`\`\`diff\n${numbered}\n\`\`\``;
    })
    .join('\n\n');
}

export function formatRules(rules: { title: string; content: string }[]): string {
  if (!rules.length) {
    return '（无私有规范，请依据通用最佳实践审查）';
  }
  return rules.map((r, i) => `${i + 1}. 【${r.title}】\n${r.content}`).join('\n\n');
}

export function toIssueItems(
  raw: z.infer<typeof issueArraySchema>,
  category: ReviewIssueItem['category'],
  severityFilter?: Array<ReviewIssueItem['severity']>,
): ReviewIssueItem[] {
  return raw.issues
    .filter((i) => !severityFilter || severityFilter.includes(i.severity))
    .map((i) => ({
      category,
      severity: i.severity,
      filePath: i.filePath,
      line: i.line,
      ruleTitle: i.ruleTitle,
      description: i.description,
      suggestion: i.suggestion,
      patch: i.patch,
    }));
}

export function buildQueryFromDiff(files: PrDiffFile[]): string {
  const paths = files.map((f) => f.filePath).slice(0, 20).join(' ');
  const langs = [...new Set(files.map((f) => f.language))].join(' ');
  const identifiers = new Set<string>();
  const idRe = /\b([A-Za-z_][A-Za-z0-9_]{2,})\b/g;
  for (const f of files.slice(0, 15)) {
    for (const line of (f.patch || '').split('\n')) {
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      let m: RegExpExecArray | null;
      while ((m = idRe.exec(line)) !== null) {
        identifiers.add(m[1]);
        if (identifiers.size >= 40) break;
      }
      if (identifiers.size >= 40) break;
    }
  }
  return `${langs} ${paths} ${[...identifiers].join(' ')}`.slice(0, 2000);
}
