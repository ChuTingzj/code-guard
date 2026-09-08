import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { REVIEW_QUEUE, ReviewJobPayload } from '@code-guard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { GitProviderFactory } from '../git-client/git-provider.factory';
import { ReviewEngineService } from '../review-engine/review-engine.service';

@Processor(REVIEW_QUEUE, {
  concurrency: Number(process.env.REVIEW_CONCURRENCY ?? 2),
})
export class ReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gitFactory: GitProviderFactory,
    private readonly reviewEngine: ReviewEngineService,
  ) {
    super();
  }

  async process(job: Job<ReviewJobPayload>) {
    const { taskId, projectId, prNumber, headSha } = job.data;
    this.logger.log(`Processing task ${taskId} PR #${prNumber}`);

    await this.prisma.reviewTask.update({
      where: { id: taskId },
      data: { status: 'ANALYZING', startedAt: new Date(), error: null },
    });

    const { provider, repoFullName } = await this.gitFactory.forProject(projectId);
    const diffFiles = await provider.getPrDiff(repoFullName, prNumber);
    this.logger.log(
      `Fetched ${diffFiles.length} files for ${repoFullName}#${prNumber}: ${diffFiles
        .map((f) => f.filePath)
        .join(', ')}`,
    );

    await this.reviewEngine.run({
      ...job.data,
      diffFiles,
      provider,
      repoFullName,
      headSha,
    });

    await this.prisma.reviewTask.update({
      where: { id: taskId },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ReviewJobPayload> | undefined, err: Error) {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= attempts) {
      this.logger.error(`Task ${job.data.taskId} failed permanently: ${err.message}`);
      await this.prisma.reviewTask.update({
        where: { id: job.data.taskId },
        data: { status: 'FAILED', error: err.message, endedAt: new Date() },
      });
      try {
        const { provider, repoFullName } = await this.gitFactory.forProject(job.data.projectId);
        await provider.postComment(
          repoFullName,
          job.data.prNumber,
          `## CodeGuard AI\n\n审查失败：\`${err.message}\`。请稍后在管理后台重试。`,
        );
      } catch (e) {
        this.logger.warn(`Failed to post failure comment: ${e}`);
      }
    }
  }
}
