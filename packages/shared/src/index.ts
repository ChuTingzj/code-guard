export type GitPlatform = 'GITHUB' | 'GITLAB';

export type TaskStatus = 'QUEUED' | 'ANALYZING' | 'COMPLETED' | 'FAILED';

export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';

export type Verdict = 'PASSED' | 'WARNING' | 'REJECTED';

export type IssueCategory = 'STYLE' | 'SECURITY' | 'ARCHITECTURE';

export type IssueSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type UserRole = 'ADMIN' | 'TECH_LEAD';

export interface ReviewJobPayload {
  taskId: string;
  projectId: string;
  platform: GitPlatform;
  repoFullName: string;
  prNumber: number;
  headSha: string;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

export interface CreateProjectRequest {
  name: string;
  platform: GitPlatform;
  repoFullName: string;
  accessToken: string;
}

export interface StatsOverview {
  totalReviews: number;
  criticalBlocked: number;
  passRate: number;
  avgDurationMs: number;
}

export interface StatsTrendPoint {
  period: string;
  passed: number;
  warning: number;
  rejected: number;
}

export interface TopViolation {
  ruleTitle: string;
  count: number;
}

export interface ProjectStats {
  projectName: string;
  total: number;
  passRate: number;
}

export const REVIEW_QUEUE = 'review-queue';
export const INGEST_QUEUE = 'ingest-queue';
