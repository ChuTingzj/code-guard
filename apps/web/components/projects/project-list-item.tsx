'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';

export type ProjectListItemData = {
  id: string;
  name: string;
  platform: string;
  repoFullName: string;
  enabled: boolean;
  webhookSecretMasked: string;
};

export type ProjectActionState = {
  error: string;
  ok: boolean;
  conflict?: boolean;
};

type Props = {
  project: ProjectListItemData;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  updateAction: (
    prev: ProjectActionState,
    formData: FormData,
  ) => Promise<ProjectActionState>;
  deleteAction: (
    prev: ProjectActionState,
    formData: FormData,
  ) => Promise<ProjectActionState>;
};

const initialState: ProjectActionState = { error: '', ok: false };

function ProjectEditForm({
  project,
  updateAction,
  onCancelEdit,
}: {
  project: ProjectListItemData;
  updateAction: Props['updateAction'];
  onCancelEdit: () => void;
}) {
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateAction,
    initialState,
  );

  useEffect(() => {
    if (updateState.ok) {
      onCancelEdit();
    }
  }, [updateState.ok, onCancelEdit]);

  return (
    <>
      <form action={updateFormAction} className="mt-3 grid gap-3 md:grid-cols-2">
        <input type="hidden" name="id" value={project.id} />
        <input
          name="name"
          defaultValue={project.name}
          required
          placeholder="项目名称"
          className="ui-input"
        />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={project.enabled}
            className="size-4 rounded-control border-border"
          />
          启用
        </label>
        <p className="text-ink-muted md:col-span-2">
          {project.platform} · {project.repoFullName}（不可修改）
        </p>
        <input
          name="accessToken"
          type="password"
          placeholder="Access Token（留空则不修改）"
          className="ui-input md:col-span-2"
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button type="submit" className="ui-btn-primary" disabled={updatePending}>
            {updatePending ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            className="ui-btn-secondary"
            disabled={updatePending}
            onClick={onCancelEdit}
          >
            取消
          </button>
        </div>
      </form>
      {updateState.error ? <p className="ui-error mt-3">{updateState.error}</p> : null}
    </>
  );
}

export function ProjectListItem({
  project,
  editing,
  onEdit,
  onCancelEdit,
  updateAction,
  deleteAction,
}: Props) {
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    initialState,
  );
  const [, startTransition] = useTransition();
  const deleteFormRef = useRef<HTMLFormElement>(null);

  function submitDelete(force: boolean) {
    const form = deleteFormRef.current;
    if (!form) return;
    const data = new FormData(form);
    if (force) {
      data.set('force', 'true');
    }
    startTransition(() => {
      deleteFormAction(data);
    });
  }

  function handleDeleteClick() {
    if (!window.confirm('确认删除该项目？此操作不可恢复')) {
      return;
    }
    submitDelete(false);
  }

  function handleForceDeleteClick() {
    if (
      !window.confirm(
        '将同时删除该项目下的所有文档与评审记录，且不可恢复。确认强制删除？',
      )
    ) {
      return;
    }
    submitDelete(true);
  }

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{project.name}</p>
          <p className="text-ink-muted">
            {project.platform} · {project.repoFullName} · secret{' '}
            <span className="font-mono text-xs">{project.webhookSecretMasked}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              project.enabled
                ? 'rounded-control bg-emerald-50 px-2 py-0.5 text-xs font-medium text-passed'
                : 'rounded-control bg-paper px-2 py-0.5 text-xs text-ink-muted'
            }
          >
            {project.enabled ? '启用' : '停用'}
          </span>
          {!editing ? (
            <>
              <button type="button" className="ui-btn-secondary" onClick={onEdit}>
                编辑
              </button>
              <button
                type="button"
                className="ui-btn-secondary text-rejected"
                disabled={deletePending}
                onClick={handleDeleteClick}
              >
                {deletePending ? '删除中…' : '删除'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <form ref={deleteFormRef} className="hidden" aria-hidden>
        <input type="hidden" name="id" value={project.id} />
      </form>

      {editing ? (
        <ProjectEditForm
          project={project}
          updateAction={updateAction}
          onCancelEdit={onCancelEdit}
        />
      ) : null}

      {!editing && deleteState.error ? (
        <div className="mt-3 space-y-2">
          <p className="ui-error">{deleteState.error}</p>
          {deleteState.conflict ? (
            <button
              type="button"
              className="ui-btn-secondary text-rejected"
              disabled={deletePending}
              onClick={handleForceDeleteClick}
            >
              {deletePending ? '删除中…' : '强制删除'}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
