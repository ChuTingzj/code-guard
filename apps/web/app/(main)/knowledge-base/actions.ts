'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { API_BASE } from '@/lib/api-client';

export async function uploadDocument(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  const file = formData.get('file');
  if (!projectId || !(file instanceof File)) {
    throw new Error('projectId and file required');
  }
  const token = (await cookies()).get('cg_token')?.value;
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API_BASE}/knowledge/documents?projectId=${projectId}`, {
    method: 'POST',
    headers: { Authorization: token ? `Bearer ${token}` : '' },
    body,
  });
  const json = await res.json();
  if (!res.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.message ?? 'upload failed');
  }
  revalidatePath('/knowledge-base');
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const token = (await cookies()).get('cg_token')?.value;
  const res = await fetch(`${API_BASE}/knowledge/documents/${id}`, {
    method: 'DELETE',
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  const json = await res.json();
  if (!res.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.message ?? 'delete failed');
  }
  revalidatePath('/knowledge-base');
}
