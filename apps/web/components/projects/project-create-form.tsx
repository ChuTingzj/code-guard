'use client';

import { useActionState, useState } from 'react';

export type CreateProjectState = {
  error: string;
  ok: boolean;
  name?: string;
  webhookSecret?: string;
  webhookUrl?: string;
  webhookSetupHint?: string;
};

type Props = {
  createAction: (
    prev: CreateProjectState,
    formData: FormData,
  ) => Promise<CreateProjectState>;
};

const initialState: CreateProjectState = { error: '', ok: false };

export function ProjectCreateForm({ createAction }: Props) {
  const [state, formAction, pending] = useActionState(createAction, initialState);
  const [copied, setCopied] = useState<'secret' | 'url' | null>(null);

  async function copyText(kind: 'secret' | 'url', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore clipboard failures; user can still select text
    }
  }

  return (
    <div className="space-y-4">
      <form
        key={state.ok ? `created-${state.webhookSecret}` : 'create'}
        action={formAction}
        className="grid gap-3 md:grid-cols-2"
      >
        <input name="name" placeholder="项目名称" required className="ui-input" />
        <select name="platform" className="ui-input" defaultValue="GITHUB">
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
        <button type="submit" className="ui-btn-primary md:col-span-2" disabled={pending}>
          {pending ? '创建中…' : '创建并生成 Webhook Secret'}
        </button>
      </form>

      {state.error ? <p className="ui-error">{state.error}</p> : null}

      {state.ok && state.webhookSecret && state.webhookUrl ? (
        <div className="rounded-control border border-border bg-teal-50/60 p-4 text-sm">
          <p className="font-medium text-ink">
            {state.name ? `「${state.name}」` : '项目'}已创建。请立即复制下方信息配置 Webhook（仅展示一次）。
          </p>
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-xs font-medium text-ink-muted">Webhook URL</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <code className="break-all font-mono text-xs text-ink">{state.webhookUrl}</code>
                <button
                  type="button"
                  className="ui-btn-secondary"
                  onClick={() => copyText('url', state.webhookUrl!)}
                >
                  {copied === 'url' ? '已复制' : '复制'}
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">Webhook Secret / Token</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <code className="break-all font-mono text-xs text-ink">{state.webhookSecret}</code>
                <button
                  type="button"
                  className="ui-btn-secondary"
                  onClick={() => copyText('secret', state.webhookSecret!)}
                >
                  {copied === 'secret' ? '已复制' : '复制'}
                </button>
              </dd>
            </div>
            {state.webhookSetupHint ? (
              <div>
                <dt className="text-xs font-medium text-ink-muted">配置提示</dt>
                <dd className="mt-1 text-ink-muted">{state.webhookSetupHint}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
