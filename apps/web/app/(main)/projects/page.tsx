import { revalidatePath } from 'next/cache';
import { apiGet, apiMutate } from '@/lib/api-client';
import { ProjectCreateForm, type CreateProjectState } from '@/components/projects/project-create-form';
import { ProjectList } from '@/components/projects/project-list';
import type { ProjectActionState } from '@/components/projects/project-list-item';

async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  'use server';
  try {
    const name = String(formData.get('name') ?? '');
    const result = await apiMutate<{
      name: string;
      webhookSecret: string;
      webhookUrl: string;
      webhookSetupHint: string;
    }>('/projects', {
      method: 'POST',
      body: {
        name,
        platform: String(formData.get('platform') ?? 'GITHUB'),
        repoFullName: String(formData.get('repoFullName') ?? ''),
        accessToken: String(formData.get('accessToken') ?? ''),
      },
    });
    revalidatePath('/projects');
    return {
      error: '',
      ok: true,
      name: result.name ?? name,
      webhookSecret: result.webhookSecret,
      webhookUrl: result.webhookUrl,
      webhookSetupHint: result.webhookSetupHint,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : '创建失败',
      ok: false,
    };
  }
}

async function updateProject(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  'use server';
  try {
    const id = String(formData.get('id') ?? '');
    const name = String(formData.get('name') ?? '');
    const accessToken = String(formData.get('accessToken') ?? '');
    const enabledRaw = formData.get('enabled');
    const enabled = enabledRaw === 'on' || enabledRaw === 'true';
    const body: { name: string; enabled: boolean; accessToken?: string } = {
      name,
      enabled,
    };
    if (accessToken) {
      body.accessToken = accessToken;
    }
    await apiMutate(`/projects/${id}`, { method: 'PATCH', body });
    revalidatePath('/projects');
    return { error: '', ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : '更新失败',
      ok: false,
    };
  }
}

async function deleteProject(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  'use server';
  try {
    const id = String(formData.get('id') ?? '');
    const force = formData.get('force') === 'true';
    const path = force ? `/projects/${id}?force=true` : `/projects/${id}`;
    await apiMutate(path, { method: 'DELETE' });
    revalidatePath('/projects');
    return { error: '', ok: true, conflict: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : '删除失败';
    const conflict =
      message.includes('文档或评审任务') || message.includes('无法删除');
    return {
      error: message,
      ok: false,
      conflict,
    };
  }
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
        <ProjectCreateForm createAction={createProject} />
      </section>

      <section className="ui-surface">
        <h2 className="mb-4 text-sm font-semibold">已接入项目</h2>
        <ProjectList
          projects={projects}
          updateAction={updateProject}
          deleteAction={deleteProject}
        />
      </section>
    </div>
  );
}
