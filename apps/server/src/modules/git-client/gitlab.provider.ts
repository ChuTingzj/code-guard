import { Injectable, Logger } from '@nestjs/common';
import { Gitlab } from '@gitbeaker/rest';
import { IGitProvider, PrDiffFile } from './git-provider.interface';
import { inferLanguage, truncateDiffFiles } from './diff.util';

@Injectable()
export class GitlabProvider implements IGitProvider {
  private readonly logger = new Logger(GitlabProvider.name);
  private readonly api: InstanceType<typeof Gitlab>;

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
      await this.api.MergeRequestDiscussions.create(repo, prNumber, opts.body, {
        position: {
          positionType: 'text',
          baseSha: opts.commitSha,
          startSha: opts.commitSha,
          headSha: opts.commitSha,
          newPath: opts.filePath,
          oldPath: opts.filePath,
          newLine: opts.line,
        } as never,
      });
    } catch (err) {
      this.logger.warn(`GitLab inline suggestion failed: ${err}`);
    }
  }
}
