export type GitlabDiffRefs = {
  base_sha: string;
  start_sha: string;
  head_sha: string;
};

export function buildGitlabInlinePosition(
  diffRefs: GitlabDiffRefs,
  opts: { filePath: string; line: number },
) {
  if (!diffRefs.base_sha || !diffRefs.start_sha || !diffRefs.head_sha) {
    throw new Error('GitLab MR diff_refs is incomplete');
  }

  return {
    positionType: 'text' as const,
    baseSha: diffRefs.base_sha,
    startSha: diffRefs.start_sha,
    headSha: diffRefs.head_sha,
    newPath: opts.filePath,
    oldPath: opts.filePath,
    newLine: opts.line,
  };
}
