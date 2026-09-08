import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { REVIEW_QUEUE } from '@code-guard/shared';
import { ReviewEngineService } from './review-engine.service';
import { KnowledgeRetrievalNode } from './nodes/knowledge-retrieval.node';
import { AgentNodesService } from './nodes/agent-nodes.service';
import { ActionNodeService } from './nodes/action.node';
import { ReviewsController } from './reviews.controller';
import { GitClientModule } from '../git-client/git-client.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: REVIEW_QUEUE }),
    GitClientModule,
    forwardRef(() => KnowledgeModule),
  ],
  controllers: [ReviewsController],
  providers: [
    ReviewEngineService,
    KnowledgeRetrievalNode,
    AgentNodesService,
    ActionNodeService,
  ],
  exports: [ReviewEngineService],
})
export class ReviewEngineModule {}
