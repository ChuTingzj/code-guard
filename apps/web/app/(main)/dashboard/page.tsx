import { apiGet } from '@/lib/api-client';
import { TrendChart, ViolationBar } from '@/components/charts/trend-chart';
import type { StatsOverview, StatsTrendPoint, TopViolation, ProjectStats } from '@code-guard/shared';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const range = searchParams.range ?? '7d';
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
          <h1 className="font-display text-3xl font-bold">质量大盘</h1>
          <p className="mt-1 text-sm text-slate-600">团队代码审查趋势与违规热点</p>
        </div>
        <div className="flex gap-2 text-sm">
          {['7d', '30d'].map((r) => (
            <a
              key={r}
              href={`/dashboard?range=${r}`}
              className={`rounded-md px-3 py-1.5 ${
                range === r ? 'bg-brand text-white' : 'bg-white/70 text-slate-700'
              }`}
            >
              {r}
            </a>
          ))}
        </div>
      </header>

      {error ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-rejected">{error}</p>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white/80 px-5 py-4 shadow-sm ring-1 ring-slate-200/60">
            <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="mb-4 text-sm font-semibold">通过率趋势</h2>
          <TrendChart data={trend} />
        </div>
        <div className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="mb-4 text-sm font-semibold">最常违反规范</h2>
          <ViolationBar data={violations} />
        </div>
      </section>

      <section className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="mb-4 text-sm font-semibold">项目对比</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2 font-medium">项目</th>
                <th className="pb-2 font-medium">审查数</th>
                <th className="pb-2 font-medium">通过率</th>
              </tr>
            </thead>
            <tbody>
              {byProject.map((p) => (
                <tr key={p.projectName} className="border-t border-slate-100">
                  <td className="py-2">{p.projectName}</td>
                  <td className="py-2">{p.total}</td>
                  <td className="py-2">{Math.round(p.passRate * 100)}%</td>
                </tr>
              ))}
              {!byProject.length ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-400">
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
