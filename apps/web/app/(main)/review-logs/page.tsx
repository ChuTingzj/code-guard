import { apiGet } from '@/lib/api-client';
import { ReviewLogsClient } from '@/components/reviews/review-logs-client';

export default async function ReviewLogsPage({
  searchParams,
}: {
  searchParams: { projectId?: string; verdict?: string; page?: string };
}) {
  const qs = new URLSearchParams();
  if (searchParams.projectId) qs.set('projectId', searchParams.projectId);
  if (searchParams.verdict) qs.set('verdict', searchParams.verdict);
  qs.set('page', searchParams.page ?? '1');
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
        <h1 className="font-display text-3xl font-bold">审查日志</h1>
        <p className="mt-1 text-sm text-slate-600">共 {data.total} 条 · 点击行查看详情</p>
      </header>
      <form className="flex flex-wrap gap-2 text-sm">
        <select name="verdict" defaultValue={searchParams.verdict ?? ''} className="rounded-md border px-3 py-1.5">
          <option value="">全部结论</option>
          <option value="PASSED">PASSED</option>
          <option value="WARNING">WARNING</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <button className="rounded-md bg-brand px-3 py-1.5 text-white" formAction="/review-logs">
          筛选
        </button>
      </form>
      <ReviewLogsClient items={data.items} />
    </div>
  );
}
