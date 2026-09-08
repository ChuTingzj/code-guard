-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TECH_LEAD');

-- CreateEnum
CREATE TYPE "GitPlatform" AS ENUM ('GITHUB', 'GITLAB');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('PASSED', 'WARNING', 'REJECTED');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('STYLE', 'SECURITY', 'ARCHITECTURE');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TECH_LEAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "GitPlatform" NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidelineDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidelineDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidelineChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidelineChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "prTitle" TEXT,
    "prAuthor" TEXT,
    "headSha" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRecord" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "verdict" "Verdict" NOT NULL,
    "finalMarkdown" TEXT NOT NULL,
    "tokenUsage" JSONB NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewIssue" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "filePath" TEXT NOT NULL,
    "line" INTEGER,
    "ruleTitle" TEXT,
    "description" TEXT NOT NULL,
    "suggestion" TEXT,
    "patch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_platform_repoFullName_key" ON "Project"("platform", "repoFullName");

-- CreateIndex
CREATE INDEX "GuidelineChunk_documentId_idx" ON "GuidelineChunk"("documentId");

-- CreateIndex
CREATE INDEX "ReviewTask_projectId_createdAt_idx" ON "ReviewTask"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTask_projectId_prNumber_headSha_key" ON "ReviewTask"("projectId", "prNumber", "headSha");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRecord_taskId_key" ON "ReviewRecord"("taskId");

-- CreateIndex
CREATE INDEX "ReviewRecord_verdict_createdAt_idx" ON "ReviewRecord"("verdict", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewIssue_ruleTitle_idx" ON "ReviewIssue"("ruleTitle");

-- CreateIndex
CREATE INDEX "ReviewIssue_category_severity_createdAt_idx" ON "ReviewIssue"("category", "severity", "createdAt");

-- AddForeignKey
ALTER TABLE "GuidelineDocument" ADD CONSTRAINT "GuidelineDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidelineDocument" ADD CONSTRAINT "GuidelineDocument_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidelineChunk" ADD CONSTRAINT "GuidelineChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "GuidelineDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRecord" ADD CONSTRAINT "ReviewRecord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ReviewTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIssue" ADD CONSTRAINT "ReviewIssue_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ReviewRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- HNSW index for vector similarity search
CREATE INDEX guideline_chunk_embedding_idx
  ON "GuidelineChunk" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
