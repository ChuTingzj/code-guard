import Link from 'next/link';

const NAV = [
  { href: '/dashboard', label: '质量大盘' },
  { href: '/projects', label: '项目管理' },
  { href: '/knowledge-base', label: '规范知识库' },
  { href: '/review-logs', label: '审查日志' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-8 px-4 py-6 md:px-8">
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-6 space-y-8">
          <div>
            <Link href="/dashboard" className="font-display text-2xl font-bold text-brand">
              CodeGuard
            </Link>
            <p className="mt-1 text-xs text-slate-500">AI 审查助手</p>
          </div>
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-white/70 hover:text-brand"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <main className="min-w-0 flex-1 pb-16">{children}</main>
    </div>
  );
}
