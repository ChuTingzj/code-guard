import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { IGitProvider, PrDiffFile } from './git-provider.interface';
import { inferLanguage, truncateDiffFiles } from './diff.util';

@Injectable()
export class GithubProvider implements IGitProvider {
  private readonly logger = new Logger(GithubProvider.name);

  constructor(private readonly token: string) {}

  private client() {
    return new Octokit({ auth: this.token });
  }

  private parseRepo(repo: string): { owner: string; repo: string } {
    const [owner, name] = repo.split('/');
    if (!owner || !name) throw new Error(`Invalid GitHub repo: ${repo}`);
    return { owner, repo: name };
  }

  async getPrDiff(repo: string, prNumber: number): Promise<PrDiffFile[]> {
    const { owner, repo: name } = this.parseRepo(repo);
    const octokit = this.client();
    const files: PrDiffFile[] = [];
    let page = 1;
    while (true) {
      const { data } = await octokit.pulls.listFiles({
        owner,
        repo: name,
        pull_number: prNumber,
        per_page: 100,
        page,
      });
      if (!data.length) break;
      for (const f of data) {
        files.push({
          filePath: f.filename,
          status: (f.status as PrDiffFile['status']) ?? 'modified',
          patch: f.patch ?? '',
          language: inferLanguage(f.filename),
        });
      }
      if (data.length < 100) break;
      page += 1;
    }
    const { files: truncated, truncated: wasTruncated } = truncateDiffFiles(files);
    if (wasTruncated) {
      this.logger.warn(`PR #${prNumber} diff truncated for ${repo}`);
    }
    return truncated;
  }

  async postComment(repo: string, prNumber: number, markdown: string): Promise<void> {
    const { owner, repo: name } = this.parseRepo(repo);
    await this.client().issues.createComment({
      owner,
      repo: name,
      issue_number: prNumber,
      body: markdown,
    });
  }

  async postInlineSuggestion(
    repo: string,
    prNumber: number,
    opts: { filePath: string; line: number; body: string; commitSha: string },
  ): Promise<void> {
    const { owner, repo: name } = this.parseRepo(repo);
    try {
      await this.client().pulls.createReviewComment({
        owner,
        repo: name,
        pull_number: prNumber,
        body: opts.body,
        commit_id: opts.commitSha,
        path: opts.filePath,
        line: opts.line,
        side: 'RIGHT',
      });
    } catch (err) {
      this.logger.warn(`Inline suggestion failed for ${opts.filePath}:${opts.line}: ${err}`);
    }
  }
}
