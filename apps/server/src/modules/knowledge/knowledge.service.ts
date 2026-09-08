import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { INGEST_QUEUE } from '@code-guard/shared';
import { PrismaService } from '../prisma/prisma.service';
import { createEmbeddingsModel } from '../review-engine/llm.factory';

export interface IngestJobPayload {
  documentId: string;
  projectId: string;
  fileName: string;
  fileType: string;
  contentBase64: string;
  replaceDocumentIds?: string[];
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(INGEST_QUEUE) private readonly ingestQueue: Queue,
  ) {}

  async createDocument(input: {
    projectId: string;
    uploaderId: string;
    fileName: string;
    fileType: string;
    buffer: Buffer;
  }) {
    const existing = await this.prisma.guidelineDocument.findMany({
      where: { projectId: input.projectId, fileName: input.fileName, status: 'READY' },
      select: { id: true },
    });

    const doc = await this.prisma.guidelineDocument.create({
      data: {
        projectId: input.projectId,
        uploaderId: input.uploaderId,
        fileName: input.fileName,
        fileType: input.fileType,
        status: 'PROCESSING',
      },
    });

    const payload: IngestJobPayload = {
      documentId: doc.id,
      projectId: input.projectId,
      fileName: input.fileName,
      fileType: input.fileType,
      contentBase64: input.buffer.toString('base64'),
      replaceDocumentIds: existing.map((e) => e.id),
    };
    await this.ingestQueue.add('ingest', payload, { jobId: `ingest:${doc.id}` });
    return doc;
  }

  async listDocuments(projectId: string) {
    return this.prisma.guidelineDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        status: true,
        error: true,
        createdAt: true,
        _count: { select: { chunks: true } },
      },
    });
  }

  async deleteDocument(id: string) {
    await this.prisma.guidelineDocument.delete({ where: { id } });
    return { deleted: true };
  }

  async search(projectId: string, query: string, topK = 5) {
    if (!process.env.LLM_API_KEY || process.env.LLM_API_KEY.startsWith('sk-your')) {
      // Offline: keyword fallback on chunk content
      const chunks = await this.prisma.guidelineChunk.findMany({
        where: {
          document: { projectId, status: 'READY' },
          OR: [
            { title: { contains: query.split(' ')[0] ?? '', mode: 'insensitive' } },
            { content: { contains: query.split(' ').find((w) => w.length > 3) ?? '规范', mode: 'insensitive' } },
          ],
        },
        take: topK,
        select: { title: true, content: true },
      });
      return chunks;
    }

    const embeddings = createEmbeddingsModel();
    const queryVector = await embeddings.embedQuery(query);
    const vectorLiteral = `[${queryVector.join(',')}]`;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ title: string; content: string; similarity: number }>
    >(
      `
      SELECT c.title, c.content,
             1 - (c.embedding <=> $1::vector) AS similarity
      FROM "GuidelineChunk" c
      JOIN "GuidelineDocument" d ON d.id = c."documentId"
      WHERE d."projectId" = $2 AND d.status = 'READY'
        AND c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> $1::vector) > 0.45
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
      `,
      vectorLiteral,
      projectId,
      topK,
    );

    return rows.map((r) => ({ title: r.title, content: r.content }));
  }

  async ingest(payload: IngestJobPayload) {
    try {
      const buffer = Buffer.from(payload.contentBase64, 'base64');
      let text = '';
      if (payload.fileType === 'pdf') {
        const pdfParse = (await import('pdf-parse')).default;
        const parsed = await pdfParse(buffer);
        text = parsed.text;
      } else {
        text = buffer.toString('utf8');
      }

      const chunks = await this.splitText(text);
      const embeddingsReady =
        process.env.LLM_API_KEY && !process.env.LLM_API_KEY.startsWith('sk-your');

      let vectors: number[][] = [];
      if (embeddingsReady) {
        const emb = createEmbeddingsModel();
        const batchSize = 100;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize).map((c) => c.content);
          const vecs = await emb.embedDocuments(batch);
          vectors.push(...vecs);
        }
      }

      for (let i = 0; i < chunks.length; i++) {
        const id = randomUUID();
        const { title, content } = chunks[i];
        if (embeddingsReady && vectors[i]) {
          const vectorLiteral = `[${vectors[i].join(',')}]`;
          await this.prisma.$executeRawUnsafe(
            `
            INSERT INTO "GuidelineChunk" (id, "documentId", title, content, "chunkIndex", embedding, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
            `,
            id,
            payload.documentId,
            title,
            content,
            i,
            vectorLiteral,
          );
        } else {
          await this.prisma.guidelineChunk.create({
            data: {
              id,
              documentId: payload.documentId,
              title,
              content,
              chunkIndex: i,
            },
          });
        }
      }

      if (payload.replaceDocumentIds?.length) {
        await this.prisma.guidelineDocument.deleteMany({
          where: { id: { in: payload.replaceDocumentIds } },
        });
      }

      await this.prisma.guidelineDocument.update({
        where: { id: payload.documentId },
        data: { status: 'READY', error: null },
      });
      this.logger.log(`Ingested document ${payload.documentId} with ${chunks.length} chunks`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Ingest failed for ${payload.documentId}: ${message}`);
      await this.prisma.guidelineDocument.update({
        where: { id: payload.documentId },
        data: { status: 'FAILED', error: message },
      });
      throw err;
    }
  }

  private async splitText(text: string): Promise<Array<{ title: string; content: string }>> {
    try {
      const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 100,
      });
      const docs = await splitter.createDocuments([text]);
      return docs.map((d, i) => {
        const heading =
          text
            .split('\n')
            .find((line) => line.startsWith('#') && d.pageContent.includes(line.replace(/^#+\s*/, '').slice(0, 20)))
            ?.replace(/^#+\s*/, '') ?? `Chunk ${i + 1}`;
        return { title: heading.slice(0, 120), content: d.pageContent };
      });
    } catch {
      const parts = text.match(/[\s\S]{1,800}/g) ?? [text];
      return parts.map((content, i) => ({ title: `Chunk ${i + 1}`, content }));
    }
  }
}
