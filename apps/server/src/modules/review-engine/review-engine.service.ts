import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { ReviewStateAnnotation, ReviewState } from './review-state';
import { KnowledgeRetrievalNode } from './nodes/knowledge-retrieval.node';
import { AgentNodesService } from './nodes/agent-nodes.service';
import { ActionNodeService } from './nodes/action.node';
import { ReviewJobPayload } from '@code-guard/shared';
import { PrDiffFile, IGitProvider } from '../git-client/git-provider.interface';

@Injectable()
export class ReviewEngineService {
  private readonly logger = new Logger(ReviewEngineService.name);
  private graph: ReturnType<ReviewEngineService['buildGraph']> | null = null;

  constructor(
    private readonly knowledgeNode: KnowledgeRetrievalNode,
    private readonly agents: AgentNodesService,
    private readonly action: ActionNodeService,
  ) {}

  private buildGraph() {
    const knowledgeNode = this.knowledgeNode;
    const agents = this.agents;
    const action = this.action;

    return new StateGraph(ReviewStateAnnotation)
      .addNode('knowledgeRetrieval', async (state: ReviewState) =>
        knowledgeNode.run(state),
      )
      .addNode('syntaxStyle', async (state: ReviewState) => agents.runStyle(state))
      .addNode('security', async (state: ReviewState) => agents.runSecurity(state))
      .addNode('architecture', async (state: ReviewState) =>
        agents.runArchitecture(state),
      )
      .addNode('action', async (state: ReviewState) => action.run(state))
      .addEdge(START, 'knowledgeRetrieval')
      .addEdge('knowledgeRetrieval', 'syntaxStyle')
      .addEdge('syntaxStyle', 'security')
      .addEdge('security', 'architecture')
      .addEdge('architecture', 'action')
      .addEdge('action', END)
      .compile();
  }

  async run(
    input: ReviewJobPayload & {
      diffFiles: PrDiffFile[];
      provider: IGitProvider;
      repoFullName: string;
      headSha: string;
    },
  ) {
    if (!this.graph) this.graph = this.buildGraph();
    this.logger.log(`Starting LangGraph review for task ${input.taskId}`);

    // Offline / no-API-key fallback for local M1 smoke tests
    if (!process.env.LLM_API_KEY || process.env.LLM_API_KEY.startsWith('sk-your')) {
      this.logger.warn('LLM_API_KEY not configured — writing mock PASSED record');
      await this.action.run({
        taskId: input.taskId,
        projectId: input.projectId,
        prNumber: input.prNumber,
        headSha: input.headSha,
        repoFullName: input.repoFullName,
        platform: input.platform,
        diffFiles: input.diffFiles,
        truncatedNote: '',
        retrievedRules: [],
        styleIssues: [],
        securityIssues: [],
        architectureIssues: [],
        finalMarkdown: '',
        verdict: 'PASSED',
        tokenUsage: { prompt: 0, completion: 0 },
      });
      return;
    }

    await this.graph.invoke({
      taskId: input.taskId,
      projectId: input.projectId,
      prNumber: input.prNumber,
      headSha: input.headSha,
      repoFullName: input.repoFullName,
      platform: input.platform,
      diffFiles: input.diffFiles,
      truncatedNote: '',
      retrievedRules: [],
      styleIssues: [],
      securityIssues: [],
      architectureIssues: [],
      finalMarkdown: '',
      verdict: 'PASSED',
      tokenUsage: { prompt: 0, completion: 0 },
    });
  }
}
