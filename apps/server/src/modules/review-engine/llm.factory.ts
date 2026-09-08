import { ChatOpenAI } from '@langchain/openai';

export function createReviewModel() {
  return new ChatOpenAI({
    modelName: process.env.LLM_MODEL ?? 'gpt-4o-mini',
    temperature: 0,
    maxRetries: 2,
    timeout: 120_000,
    apiKey: process.env.LLM_API_KEY,
    configuration: process.env.LLM_BASE_URL
      ? { baseURL: process.env.LLM_BASE_URL }
      : undefined,
  });
}

export function createEmbeddingsModel() {
  const { OpenAIEmbeddings } = require('@langchain/openai') as typeof import('@langchain/openai');
  return new OpenAIEmbeddings({
    model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
    apiKey: process.env.LLM_API_KEY,
    configuration: process.env.LLM_BASE_URL
      ? { baseURL: process.env.LLM_BASE_URL }
      : undefined,
  });
}
