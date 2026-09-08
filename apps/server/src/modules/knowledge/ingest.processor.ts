import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { INGEST_QUEUE } from '@code-guard/shared';
import { IngestJobPayload, KnowledgeService } from './knowledge.service';

@Processor(INGEST_QUEUE)
export class IngestProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestProcessor.name);

  constructor(private readonly knowledge: KnowledgeService) {
    super();
  }

  async process(job: Job<IngestJobPayload>) {
    this.logger.log(`Ingesting document ${job.data.documentId}`);
    await this.knowledge.ingest(job.data);
  }
}
