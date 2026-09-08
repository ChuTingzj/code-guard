import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { INGEST_QUEUE } from '@code-guard/shared';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { IngestProcessor } from './ingest.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: INGEST_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: false,
      },
    }),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, IngestProcessor],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
