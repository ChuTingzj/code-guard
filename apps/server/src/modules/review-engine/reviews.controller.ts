import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { REVIEW_QUEUE, ReviewJobPayload } from '@code-guard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@Controller('api/v1/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REVIEW_QUEUE) private readonly reviewQueue: Queue,
  ) {}

  @Get()
  async list(
    @Query('projectId') projectId?: string,
    @Query('verdict') verdict?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where = {
      ...(projectId ? { projectId } : {}),
      ...(verdict ? { record: { verdict: verdict as 'PASSED' | 'WARNING' | 'REJECTED' } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.reviewTask.findMany({
        where,
        include: {
          record: { select: { verdict: true, durationMs: true, createdAt: true } },
          project: { select: { name: true, repoFullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.reviewTask.count({ where }),
    ]);

    return { items, total, page: Number(page) || 1, pageSize: take };
  }

  @Get(':taskId')
  async detail(@Param('taskId') taskId: string) {
    const task = await this.prisma.reviewTask.findUnique({
      where: { id: taskId },
      include: {
        record: { include: { issues: true } },
        project: { select: { name: true, repoFullName: true, platform: true } },
      },
    });
    if (!task) {
      throw new NotFoundException({ code: 404, data: null, message: 'Task not found' });
    }
    return task;
  }

  @Post(':taskId/retry')
  async retry(@Param('taskId') taskId: string) {
    const task = await this.prisma.reviewTask.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) {
      throw new NotFoundException({ code: 404, data: null, message: 'Task not found' });
    }
    if (task.status !== 'FAILED') {
      throw new BadRequestException({
        code: 400,
        data: null,
        message: 'Only FAILED tasks can be retried',
      });
    }

    await this.prisma.reviewTask.update({
      where: { id: taskId },
      data: { status: 'QUEUED', error: null },
    });

    const payload: ReviewJobPayload = {
      taskId: task.id,
      projectId: task.projectId,
      platform: task.project.platform as 'GITHUB' | 'GITLAB',
      repoFullName: task.project.repoFullName,
      prNumber: task.prNumber,
      headSha: task.headSha,
    };

    const jobId = `${task.projectId}:${task.prNumber}:${task.headSha}:retry:${Date.now()}`;
    await this.reviewQueue.add('review', payload, { jobId });
    return { enqueued: true, jobId };
  }
}
