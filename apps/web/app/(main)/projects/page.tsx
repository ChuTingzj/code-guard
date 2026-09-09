import { revalidatePath } from 'next/cache';
import { apiGet, apiMutate } from '@/lib/api-client';

async function createProject(formData: FormData) {
  'use server';
  await apiMutate('/projects', {
    method: 'POST',
    body: {
      name: String(formData.get('name') ?? ''),
      platform: String(formData.get('platform') ?? 'GITHUB'),
      repoFullName: String(formData.get('repoFullName') ?? ''),
      accessToken: String(formData.get('accessToken') ?? ''),
    },
  });
  revalidatePath('/projects');
}

export default async function ProjectsPage() {
  let projects: Array<{
    id: string;
    name: string;
    platform: string;
    repoFullName: string;
    enabled: boolean;
    webhookSecretMasked: string;
  }> = [];
  let error = '';
  try {
    projects = await apiGet('/projects');
  } catch (e) {
    error = e instanceof Error ? e.message : '加载失败';
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="ui-page-title">项目管理</h1>
        <p className="ui-page-subtitle">接入 GitHub / GitLab 仓库并配置 Webhook</p>
      </header>

      {error ? <p className="ui-error">{error}</p> : null}

      <section className="ui-surface">
        <h2 className="mb-4 text-sm font-semibold">接入新仓库</h2>
        <form action={createProject} className="grid gap-3 md:grid-cols-2">
          <input name="name" placeholder="项目名称" required className="ui-input" />
          <select name="platform" className="ui-input">
            <option value="GITHUB">GitHub</option>
            <option value="GITLAB">GitLab</option>
          </select>
          <input
            name="repoFullName"
            placeholder="owner/repo 或 path_with_namespace"
            required
            className="ui-input md:col-span-2"
          />
          <input
            name="accessToken"
            placeholder="Access Token"
            required
            className="ui-input md:col-span-2"
          />
          <button type="submit" className="ui-btn-primary md:col-span-2">
            创建并生成 Webhook Secret
          </button>
        </form>
      </section>

      <section className="ui-surface">
        <h2 className="mb-4 text-sm font-semibold">已接入项目</h2>
        <ul className="divide-y divide-border">
          {projects.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-ink-muted">
                  {p.platform} · {p.repoFullName} · secret{' '}
                  <span className="font-mono text-xs">{p.webhookSecretMasked}</span>
                </p>
              </div>
              <span
                className={
                  p.enabled
                    ? 'rounded-control bg-emerald-50 px-2 py-0.5 text-xs font-medium text-passed'
                    : 'rounded-control bg-paper px-2 py-0.5 text-xs text-ink-muted'
                }
              >
                {p.enabled ? '启用' : '停用'}
              </span>
            </li>
          ))}
          {!projects.length ? <li className="py-6 text-center text-ink-muted">暂无项目</li> : null}
        </ul>
      </section>
    </div>
  );
}
