export interface PrDiffFile {
  filePath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  patch: string;
  language: string;
}

export interface IGitProvider {
  getPrDiff(repo: string, prNumber: number): Promise<PrDiffFile[]>;
  postComment(repo: string, prNumber: number, markdown: string): Promise<void>;
  postInlineSuggestion(
    repo: string,
    prNumber: number,
    opts: {
      filePath: string;
      line: number;
      body: string;
      commitSha: string;
    },
  ): Promise<void>;
}

export const GIT_PROVIDER = Symbol('GIT_PROVIDER');
