import { Annotation } from '@langchain/langgraph';
import { PrDiffFile } from '../git-client/git-provider.interface';

export interface ReviewIssueItem {
  category: 'STYLE' | 'SECURITY' | 'ARCHITECTURE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  filePath: string;
  line: number | null;
  ruleTitle: string | null;
  description: string;
  suggestion: string | null;
  patch: string | null;
}

export const ReviewStateAnnotation = Annotation.Root({
  taskId: Annotation<string>(),
  projectId: Annotation<string>(),
  prNumber: Annotation<number>(),
  headSha: Annotation<string>(),
  repoFullName: Annotation<string>(),
  platform: Annotation<'GITHUB' | 'GITLAB'>(),
  diffFiles: Annotation<PrDiffFile[]>(),
  truncatedNote: Annotation<string>(),

  retrievedRules: Annotation<{ title: string; content: string }[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  styleIssues: Annotation<ReviewIssueItem[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  securityIssues: Annotation<ReviewIssueItem[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  architectureIssues: Annotation<ReviewIssueItem[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),

  finalMarkdown: Annotation<string>(),
  verdict: Annotation<'PASSED' | 'WARNING' | 'REJECTED'>(),
  tokenUsage: Annotation<{ prompt: number; completion: number }>({
    reducer: (a, b) => ({
      prompt: (a?.prompt ?? 0) + (b?.prompt ?? 0),
      completion: (a?.completion ?? 0) + (b?.completion ?? 0),
    }),
    default: () => ({ prompt: 0, completion: 0 }),
  }),
});

export type ReviewState = typeof ReviewStateAnnotation.State;

export function computeVerdict(
  issues: ReviewIssueItem[],
): 'PASSED' | 'WARNING' | 'REJECTED' {
  if (issues.some((i) => i.severity === 'CRITICAL')) return 'REJECTED';
  if (issues.some((i) => i.severity === 'WARNING')) return 'WARNING';
  return 'PASSED';
}
