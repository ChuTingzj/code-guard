import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { REVIEW_QUEUE, INGEST_QUEUE } from '@code-guard/shared';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { QueueModule } from './modules/queue/queue.module';
import { GitClientModule } from './modules/git-client/git-client.module';
import { ReviewEngineModule } from './modules/review-engine/review-engine.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { StatsModule } from './modules/stats/stats.module';
import { HealthController } from './health.controller';

const role = process.env.APP_ROLE ?? 'all';
const enableGateway = role === 'all' || role === 'gateway';
const enableWorker = role === 'all' || role === 'worker';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Monorepo: .env lives at repo root; nest cwd is apps/server
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '../../.env'),
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: true,
      },
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      { name: REVIEW_QUEUE, adapter: BullMQAdapter },
      { name: INGEST_QUEUE, adapter: BullMQAdapter },
    ),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    GitClientModule,
    ...(enableGateway ? [WebhookModule, StatsModule] : []),
    ...(enableWorker || enableGateway
      ? [QueueModule, ReviewEngineModule, KnowledgeModule]
      : []),
  ],
  controllers: [HealthController],
})
export class AppModule {}
