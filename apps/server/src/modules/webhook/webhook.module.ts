import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { REVIEW_QUEUE } from '@code-guard/shared';
import { WebhookController } from './webhook.controller';
import { WebhookSignatureGuard } from './webhook-signature.guard';

@Module({
  imports: [BullModule.registerQueue({ name: REVIEW_QUEUE })],
  controllers: [WebhookController],
  providers: [WebhookSignatureGuard],
})
export class WebhookModule {}
