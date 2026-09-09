'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: '质量大盘' },
  { href: '/projects', label: '项目管理' },
  { href: '/knowledge-base', label: '规范知识库' },
  { href: '/review-logs', label: '审查日志' },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="主导航">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`ui-nav-link ${active ? 'ui-nav-link-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
