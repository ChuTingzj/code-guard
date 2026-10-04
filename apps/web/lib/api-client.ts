import { cookies } from 'next/headers';

const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3001/api/v1';

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (await cookies()).get('cg_token')?.value;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.message ?? `API error ${res.status}`);
  }
  return (json.data ?? json) as T;
}

export async function apiMutate<T>(
  path: string,
  options: { method?: string; body?: unknown; formData?: FormData } = {},
): Promise<T> {
  const token = (await cookies()).get('cg_token')?.value;
  const headers: Record<string, string> = {
    Authorization: token ? `Bearer ${token}` : '',
  };
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'POST',
    headers,
    body,
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.message ?? `API error ${res.status}`);
  }
  return (json.data ?? json) as T;
}

export { API_BASE };
