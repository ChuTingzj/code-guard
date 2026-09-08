import { Controller, Post, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { REVIEW_QUEUE, ReviewJobPayload } from '@code-guard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookSignatureGuard } from './webhook-signature.guard';
@Controller('api/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REVIEW_QUEUE) private readonly reviewQueue: Queue,
  ) {}

  @Post('github')
  @UseGuards(WebhookSignatureGuard)
  async github(@Req() req: Request, @Res() res: Response) {
    const body = req.body as {
      action?: string;
      pull_request?: {
        number: number;
        title?: string;
        user?: { login?: string };
        head?: { sha?: string };
      };
      repository?: { full_name?: string };
      __projectId?: string;
    };

    const action = body.action;
    if (!action || !['opened', 'synchronize', 'reopened'].includes(action)) {
      return res.status(200).json({ ignored: true });
    }

    const projectId = body.__projectId!;
    const prNumber = body.pull_request?.number;
    const headSha = body.pull_request?.head?.sha;
    const repoFullName = body.repository?.full_name;
    if (!prNumber || !headSha || !repoFullName) {
      return res.status(200).json({ ignored: true, reason: 'incomplete payload' });
    }

    await this.enqueue({
      projectId,
      platform: 'GITHUB',
      repoFullName,
      prNumber,
      headSha,
      prTitle: body.pull_request?.title,
      prAuthor: body.pull_request?.user?.login,
    });

    return res.status(202).json({ accepted: true });
  }

  @Post('gitlab')
  @UseGuards(WebhookSignatureGuard)
  async gitlab(@Req() req: Request, @Res() res: Response) {
    const body = req.body as {
      object_kind?: string;
      object_attributes?: {
        action?: string;
        iid?: number;
        title?: string;
        last_commit?: { id?: string };
      };
      user?: { username?: string };
      project?: { path_with_namespace?: string };
      __projectId?: string;
    };

    const action = body.object_attributes?.action;
    if (!action || !['open', 'update', 'reopen'].includes(action)) {
      return res.status(200).json({ ignored: true });
    }

    const projectId = body.__projectId!;
    const prNumber = body.object_attributes?.iid;
    const headSha = body.object_attributes?.last_commit?.id;
    const repoFullName = body.project?.path_with_namespace;
    if (!prNumber || !headSha || !repoFullName) {
      return res.status(200).json({ ignored: true, reason: 'incomplete payload' });
    }

    await this.enqueue({
      projectId,
      platform: 'GITLAB',
      repoFullName,
      prNumber,
      headSha,
      prTitle: body.object_attributes?.title,
      prAuthor: body.user?.username,
    });

    return res.status(202).json({ accepted: true });
  }

  private async enqueue(input: {
    projectId: string;
    platform: 'GITHUB' | 'GITLAB';
    repoFullName: string;
    prNumber: number;
    headSha: string;
    prTitle?: string;
    prAuthor?: string;
  }) {
    const jobId = `${input.projectId}:${input.prNumber}:${input.headSha}`;

    let task = await this.prisma.reviewTask.findUnique({
      where: {
        projectId_prNumber_headSha: {
          projectId: input.projectId,
          prNumber: input.prNumber,
          headSha: input.headSha,
        },
      },
    });

    if (!task) {
      task = await this.prisma.reviewTask.create({
        data: {
          projectId: input.projectId,
          prNumber: input.prNumber,
          headSha: input.headSha,
          prTitle: input.prTitle,
          prAuthor: input.prAuthor,
          status: 'QUEUED',
        },
      });
    }

    const payload: ReviewJobPayload = {
      taskId: task.id,
      projectId: input.projectId,
      platform: input.platform,
      repoFullName: input.repoFullName,
      prNumber: input.prNumber,
      headSha: input.headSha,
    };

    await this.reviewQueue.add('review', payload, { jobId });
    this.logger.log(`Enqueued review job ${jobId}`);
  }
}
