import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3001/api/v1';

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const token = cookies().get('cg_token')?.value;
  const path = params.path.join('/');
  const search = _req.nextUrl.search;
  const res = await fetch(`${API_BASE}/${path}${search}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
    cache: 'no-store',
  });
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const token = cookies().get('cg_token')?.value;
  const path = params.path.join('/');
  const body = await req.text();
  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    body,
    cache: 'no-store',
  });
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
