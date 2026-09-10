import { Injectable, Logger } from '@nestjs/common';
import { Gitlab } from '@gitbeaker/rest';
import { IGitProvider, PrDiffFile } from './git-provider.interface';
import { inferLanguage, truncateDiffFiles } from './diff.util';
import {
  buildGitlabInlinePosition,
  GitlabDiffRefs,
} from './gitlab-position.util';

@Injectable()
export class GitlabProvider implements IGitProvider {
  private readonly logger = new Logger(GitlabProvider.name);
  private readonly api: InstanceType<typeof Gitlab>;
  private readonly diffRefsCache = new Map<string, GitlabDiffRefs>();

  constructor(token: string) {
    this.api = new Gitlab({ token });
  }

  async getPrDiff(repo: string, prNumber: number): Promise<PrDiffFile[]> {
    const diffs = await this.api.MergeRequests.allDiffs(repo, prNumber);
    const files: PrDiffFile[] = (diffs as Array<{
      new_path: string;
      old_path: string;
      new_file: boolean;
      deleted_file: boolean;
      renamed_file: boolean;
      diff: string;
    }>).map((d) => {
      let status: PrDiffFile['status'] = 'modified';
      if (d.new_file) status = 'added';
      else if (d.deleted_file) status = 'deleted';
      else if (d.renamed_file) status = 'renamed';
      return {
        filePath: d.new_path || d.old_path,
        status,
        patch: d.diff ?? '',
        language: inferLanguage(d.new_path || d.old_path),
      };
    });
    const { files: truncated, truncated: wasTruncated } = truncateDiffFiles(files);
    if (wasTruncated) {
      this.logger.warn(`MR !${prNumber} diff truncated for ${repo}`);
    }
    return truncated;
  }

  async postComment(repo: string, prNumber: number, markdown: string): Promise<void> {
    await this.api.MergeRequestNotes.create(repo, prNumber, markdown);
  }

  async postInlineSuggestion(
    repo: string,
    prNumber: number,
    opts: { filePath: string; line: number; body: string; commitSha: string },
  ): Promise<void> {
    try {
      const diffRefs = await this.getDiffRefs(repo, prNumber);
      await this.api.MergeRequestDiscussions.create(repo, prNumber, opts.body, {
        // gitbeaker types mark newLine as string; GitLab API expects a number.
        position: buildGitlabInlinePosition(diffRefs, {
          filePath: opts.filePath,
          line: opts.line,
        }) as never,
      });
    } catch (err) {
      this.logger.warn(
        `GitLab inline suggestion failed for ${opts.filePath}:${opts.line}: ${err}`,
      );
    }
  }

  private async getDiffRefs(repo: string, prNumber: number): Promise<GitlabDiffRefs> {
    const cacheKey = `${repo}!${prNumber}`;
    const cached = this.diffRefsCache.get(cacheKey);
    if (cached) return cached;

    const mr = await this.api.MergeRequests.show(repo, prNumber);
    const refs = mr.diff_refs as GitlabDiffRefs | undefined;
    if (!refs?.base_sha || !refs?.start_sha || !refs?.head_sha) {
      throw new Error(`MR !${prNumber} is missing diff_refs`);
    }

    const diffRefs: GitlabDiffRefs = {
      base_sha: refs.base_sha,
      start_sha: refs.start_sha,
      head_sha: refs.head_sha,
    };
    this.diffRefsCache.set(cacheKey, diffRefs);
    return diffRefs;
  }
}
