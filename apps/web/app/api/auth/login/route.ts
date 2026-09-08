import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const base =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:3001/api/v1';

  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const data = json.data ?? json;

  if (!res.ok || !data?.accessToken) {
    return NextResponse.json(
      { message: json.message ?? '登录失败' },
      { status: res.status || 401 },
    );
  }

  const response = NextResponse.json({
    user: data.user,
  });
  response.cookies.set('cg_token', data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 3600,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
