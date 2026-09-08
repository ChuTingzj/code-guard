import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { REVIEW_QUEUE, INGEST_QUEUE } from '@code-guard/shared';
import { ReviewProcessor } from './review.processor';
import { GitClientModule } from '../git-client/git-client.module';
import { ReviewEngineModule } from '../review-engine/review-engine.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: REVIEW_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: { age: 24 * 3600 },
          removeOnFail: false,
        },
      },
      {
        name: INGEST_QUEUE,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 24 * 3600 },
          removeOnFail: false,
        },
      },
    ),
    GitClientModule,
    forwardRef(() => ReviewEngineModule),
  ],
  providers: [ReviewProcessor],
  exports: [BullModule],
})
export class QueueModule {}
