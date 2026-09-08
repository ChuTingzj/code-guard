import { apiGet } from '@/lib/api-client';
import { uploadDocument, deleteDocument } from './actions';
import { DocumentListPoll } from '@/components/knowledge/document-list-poll';

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: { projectId?: string };
}) {
  const projects = await apiGet<
    Array<{ id: string; name: string; repoFullName: string }>
  >('/projects').catch(() => []);
  const projectId = searchParams.projectId ?? projects[0]?.id ?? '';
  const docs = projectId
    ? await apiGet<
        Array<{
          id: string;
          fileName: string;
          status: string;
          error?: string | null;
          _count?: { chunks: number };
        }>
      >(`/knowledge/documents?projectId=${projectId}`).catch(() => [])
    : [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">规范知识库</h1>
        <p className="mt-1 text-sm text-slate-600">上传团队规范文档，审查时作为最高准则注入</p>
      </header>

      <section className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-slate-200/60">
        <form className="mb-4">
          <label className="text-sm text-slate-600">
            选择项目
            <select
              name="projectId"
              defaultValue={projectId}
              className="ml-2 rounded-md border px-3 py-1.5"
              onChange={() => undefined}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-slate-400">
            通过 URL 参数切换：
            {projects.map((p) => (
              <a key={p.id} className="ml-2 text-brand underline" href={`/knowledge-base?projectId=${p.id}`}>
                {p.name}
              </a>
            ))}
          </p>
        </form>

        <form action={uploadDocument} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="projectId" value={projectId} />
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">上传 Markdown / PDF（≤10MB）</span>
            <input type="file" name="file" accept=".md,.markdown,.pdf" required className="block text-sm" />
          </label>
          <button
            type="submit"
            disabled={!projectId}
            className="rounded-md bg-brand px-4 py-2 text-white disabled:opacity-50"
          >
            上传并向量化
          </button>
        </form>
      </section>

      <section className="rounded-xl bg-white/80 p-5 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="mb-4 text-sm font-semibold">文档列表</h2>
        <DocumentListPoll projectId={projectId} initial={docs} />
        <div className="mt-4 space-y-2">
          {docs.map((d) => (
            <form key={d.id} action={deleteDocument} className="inline">
              <input type="hidden" name="id" value={d.id} />
              <button type="submit" className="mr-3 text-xs text-rejected underline">
                删除 {d.fileName}
              </button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
