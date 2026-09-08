import { Injectable, Logger } from '@nestjs/common';
import { ReviewState } from '../review-state';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { buildQueryFromDiff } from '../diff-batch.util';

@Injectable()
export class KnowledgeRetrievalNode {
  private readonly logger = new Logger(KnowledgeRetrievalNode.name);

  constructor(private readonly knowledge: KnowledgeService) {}

  async run(state: ReviewState): Promise<Partial<ReviewState>> {
    try {
      const query = buildQueryFromDiff(state.diffFiles);
      const rules = await this.knowledge.search(state.projectId, query, 5);
      this.logger.log(`Retrieved ${rules.length} rules for project ${state.projectId}`);
      return { retrievedRules: rules };
    } catch (err) {
      this.logger.warn(`Knowledge retrieval failed, continuing without rules: ${err}`);
      return { retrievedRules: [] };
    }
  }
}
