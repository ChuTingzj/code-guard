import { apiGet } from '@/lib/api-client';
import { ReviewLogsClient } from '@/components/reviews/review-logs-client';

export default async function ReviewLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; verdict?: string; page?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.projectId) qs.set('projectId', params.projectId);
  if (params.verdict) qs.set('verdict', params.verdict);
  qs.set('page', params.page ?? '1');
  qs.set('pageSize', '20');

  const data = await apiGet<{
    items: Array<{
      id: string;
      prNumber: number;
      prTitle?: string | null;
      prAuthor?: string | null;
      status: string;
      createdAt: string;
      record?: { verdict: string; durationMs: number } | null;
      project?: { name: string; repoFullName: string };
    }>;
    total: number;
  }>(`/reviews?${qs.toString()}`).catch(() => ({ items: [], total: 0 }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="ui-page-title">审查日志</h1>
        <p className="ui-page-subtitle">共 {data.total} 条 · 点击行查看详情</p>
      </header>
      <form className="flex flex-wrap gap-2 text-sm">
        <select name="verdict" defaultValue={params.verdict ?? ''} className="ui-input w-auto">
          <option value="">全部结论</option>
          <option value="PASSED">PASSED</option>
          <option value="WARNING">WARNING</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <button className="ui-btn-primary" formAction="/review-logs">
          筛选
        </button>
      </form>
      <ReviewLogsClient items={data.items} />
    </div>
  );
}
