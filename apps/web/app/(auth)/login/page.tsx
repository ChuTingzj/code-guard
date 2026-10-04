'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@codeguard.local');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? '登录失败');
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="ui-surface">
        <div className="mb-8">
          <p className="text-3xl font-semibold tracking-tight text-brand">CodeGuard</p>
          <p className="mt-2 text-sm text-ink-muted">研发团队全自动代码审查助手</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">邮箱</span>
            <input
              className="ui-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="username"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">密码</span>
            <input
              className="ui-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="ui-error">{error}</p> : null}
          <button type="submit" disabled={loading} className="ui-btn-primary w-full py-2.5">
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </main>
  );
}
