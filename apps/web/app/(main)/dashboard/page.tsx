import Link from 'next/link';
import { apiGet } from '@/lib/api-client';
import { TrendChart, ViolationBar } from '@/components/charts/trend-chart';
import type { StatsOverview, StatsTrendPoint, TopViolation, ProjectStats } from '@code-guard/shared';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = rangeParam ?? '7d';
  let overview: StatsOverview = {
    totalReviews: 0,
    criticalBlocked: 0,
    passRate: 0,
    avgDurationMs: 0,
  };
  let trend: StatsTrendPoint[] = [];
  let violations: TopViolation[] = [];
  let byProject: ProjectStats[] = [];
  let error = '';

  try {
    [overview, trend, violations, byProject] = await Promise.all([
      apiGet<StatsOverview>(`/stats/overview?range=${range}`),
      apiGet<StatsTrendPoint[]>(`/stats/trend?range=30d&interval=week`),
      apiGet<TopViolation[]>(`/stats/top-violations?range=30d&limit=10`),
      apiGet<ProjectStats[]>(`/stats/by-project?range=30d`),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : '加载失败';
  }

  const cards = [
    { label: '审查总数', value: String(overview.totalReviews) },
    { label: '高危拦截', value: String(overview.criticalBlocked) },
    { label: '通过率', value: `${Math.round(overview.passRate * 100)}%` },
    { label: '平均耗时', value: `${Math.round(overview.avgDurationMs / 1000)}s` },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="ui-page-title">质量大盘</h1>
          <p className="ui-page-subtitle">团队代码审查趋势与违规热点</p>
        </div>
        <div className="flex gap-2 text-sm">
          {['7d', '30d'].map((r) => (
            <Link
              key={r}
              href={`/dashboard?range=${r}`}
              scroll={false}
              className={range === r ? 'ui-btn-primary px-3 py-1.5' : 'ui-btn-secondary'}
            >
              {r}
            </Link>
          ))}
        </div>
      </header>

      {error ? <p className="ui-error">{error}</p> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="ui-surface px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-ink-muted">{c.label}</p>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="ui-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">通过率趋势</h2>
          <TrendChart data={trend} />
        </div>
        <div className="ui-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">最常违反规范</h2>
          <ViolationBar data={violations} />
        </div>
      </section>

      <section className="ui-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">项目对比</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-muted">
              <tr>
                <th className="pb-2 font-medium">项目</th>
                <th className="pb-2 font-medium">审查数</th>
                <th className="pb-2 font-medium">通过率</th>
              </tr>
            </thead>
            <tbody>
              {byProject.map((p) => (
                <tr key={p.projectName} className="border-t border-border">
                  <td className="py-2">{p.projectName}</td>
                  <td className="py-2">{p.total}</td>
                  <td className="py-2">{Math.round(p.passRate * 100)}%</td>
                </tr>
              ))}
              {!byProject.length ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-ink-muted">
                    暂无数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
