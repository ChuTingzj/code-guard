import { apiGet } from '@/lib/api-client';
import { uploadDocument, deleteDocument } from './actions';
import { DocumentListPoll } from '@/components/knowledge/document-list-poll';

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId: projectIdParam } = await searchParams;
  const projects = await apiGet<
    Array<{ id: string; name: string; repoFullName: string }>
  >('/projects').catch(() => []);
  const projectId = projectIdParam ?? projects[0]?.id ?? '';
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
        <h1 className="ui-page-title">规范知识库</h1>
        <p className="ui-page-subtitle">上传团队规范文档，审查时作为最高准则注入</p>
      </header>

      <section className="ui-surface">
        <form className="mb-4">
          <label className="text-sm text-ink-muted">
            选择项目
            <select
              name="projectId"
              defaultValue={projectId}
              className="ui-input ml-2 inline-block w-auto"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-ink-muted">
            通过 URL 参数切换：
            {projects.map((p) => (
              <a
                key={p.id}
                className="ml-2 text-brand underline underline-offset-2 hover:text-brand-dark"
                href={`/knowledge-base?projectId=${p.id}`}
              >
                {p.name}
              </a>
            ))}
          </p>
        </form>

        <form action={uploadDocument} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="projectId" value={projectId} />
          <label className="text-sm">
            <span className="mb-1 block text-ink-muted">上传 Markdown / PDF（≤10MB）</span>
            <input type="file" name="file" accept=".md,.markdown,.pdf" required className="block text-sm" />
          </label>
          <button type="submit" disabled={!projectId} className="ui-btn-primary">
            上传并向量化
          </button>
        </form>
      </section>

      <section className="ui-surface">
        <h2 className="mb-4 text-sm font-semibold">文档列表</h2>
        <DocumentListPoll projectId={projectId} initial={docs} />
        <div className="mt-4 space-y-2">
          {docs.map((d) => (
            <form key={d.id} action={deleteDocument} className="inline">
              <input type="hidden" name="id" value={d.id} />
              <button
                type="submit"
                className="mr-3 cursor-pointer text-xs text-rejected underline underline-offset-2"
              >
                删除 {d.fileName}
              </button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
