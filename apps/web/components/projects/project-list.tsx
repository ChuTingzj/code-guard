'use client';

import { useCallback, useState } from 'react';
import {
  ProjectListItem,
  type ProjectActionState,
  type ProjectListItemData,
} from '@/components/projects/project-list-item';

type Props = {
  projects: ProjectListItemData[];
  updateAction: (
    prev: ProjectActionState,
    formData: FormData,
  ) => Promise<ProjectActionState>;
  deleteAction: (
    prev: ProjectActionState,
    formData: FormData,
  ) => Promise<ProjectActionState>;
};

export function ProjectList({ projects, updateAction, deleteAction }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const clearEditing = useCallback(() => setEditingId(null), []);

  return (
    <ul className="divide-y divide-border">
      {projects.map((p) => (
        <ProjectListItem
          key={p.id}
          project={p}
          editing={editingId === p.id}
          onEdit={() => setEditingId(p.id)}
          onCancelEdit={clearEditing}
          updateAction={updateAction}
          deleteAction={deleteAction}
        />
      ))}
      {!projects.length ? <li className="py-6 text-center text-ink-muted">暂无项目</li> : null}
    </ul>
  );
}
