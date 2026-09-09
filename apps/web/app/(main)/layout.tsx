import Link from 'next/link';
import { AppNav } from '@/components/shell/app-nav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-0 px-4 py-6 md:gap-8 md:px-8">
      <aside className="hidden w-56 shrink-0 border-r border-border pr-6 md:block">
        <div className="sticky top-6 space-y-6">
          <div>
            <Link href="/dashboard" className="text-xl font-semibold tracking-tight text-brand">
              CodeGuard
            </Link>
            <p className="mt-1 text-xs text-ink-muted">AI 审查助手</p>
          </div>
          <AppNav />
        </div>
      </aside>
      <main className="min-w-0 flex-1 pb-16 md:pl-0">{children}</main>
    </div>
  );
}
