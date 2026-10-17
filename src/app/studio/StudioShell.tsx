'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { StudioError, studioFetch, studioToken } from './api';
import { Toaster } from './ui';

/**
 * 工作台外壳。沿用 App 的三个标签：口播库 / 灵感库 / 我的。
 * 手机：底部标签栏（同 App 的 NavigationBar）；电脑：顶部一行。
 * 先探一次接口确认有权限 —— 第一期只对管理员开放。
 */
type Gate = 'checking' | 'open' | 'closed';

const TABS = [
  { href: '/studio', label: '口播库', icon: 'M6 3h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM9 11h6M9 15h6' },
  { href: '/studio/ideas', label: '灵感库', icon: 'M9 18h6M10 21h4M8 14a6 6 0 118 0c-.7.7-1 1.5-1 2.5H9c0-1-.3-1.8-1-2.5z' },
  { href: '/studio/me', label: '我的', icon: 'M12 4a4 4 0 110 8 4 4 0 010-8zM4 20c1.5-4 4.5-6 8-6s6.5 2 8 6' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/studio') return pathname === '/studio' || pathname.startsWith('/studio/s/');
  return pathname.startsWith(href);
}

export default function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [gate, setGate] = useState<Gate>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await studioToken())) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      try {
        await studioFetch('/api/studio/voice');
        if (!cancelled) setGate('open');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof StudioError && e.status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        else setGate('closed');
      }
    })();
    return () => {
      cancelled = true;
    };
    // 只在进入工作台时查一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <header className="sticky top-0 z-20 hidden border-b border-[var(--line)] bg-[var(--bg-raised)] md:block">
        <nav className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-6">
          <span className="mr-6 font-semibold">口播工作台</span>
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex h-10 items-center gap-2 rounded-xl px-4 text-[15px] ${
                isActive(pathname, t.href) ? 'bg-[var(--accent-tint)] font-bold text-[var(--accent)]' : 'text-[var(--muted)]'
              }`}
            >
              <Icon d={t.icon} />
              {t.label}
            </Link>
          ))}
          <span className="flex-1" />
          <Link href="/admin" className="h-10 px-3 text-[15px] leading-10 text-[var(--muted)]">后台</Link>
          <Link href="/ideas" className="h-10 px-3 text-[15px] leading-10 text-[var(--muted)]">网站</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 pb-28 pt-4 md:px-6 md:pb-10">
        {gate === 'checking' && <div className="mt-10 h-40 animate-pulse rounded-2xl bg-[var(--row-line)]" />}
        {gate === 'closed' && (
          <div className="mt-16 rounded-2xl bg-[var(--bg-raised)] p-6 text-center">
            <p className="text-[17px] font-bold">工作台还没对你开放</p>
            <p className="mt-2 text-[15px] text-[var(--muted)]">现在只有 Fordexa 管理员能用。</p>
          </div>
        )}
        {gate === 'open' && children}
      </main>

      <Toaster />

      <nav
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--line)] bg-[var(--bg-raised)] px-2 pt-1.5 md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
      >
        {TABS.map((t) => {
          const on = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 text-xs ${on ? 'font-bold text-[var(--accent)]' : 'font-medium text-[var(--muted)]'}`}
            >
              <span className={`flex h-7 w-14 items-center justify-center rounded-[14px] ${on ? 'bg-[var(--accent-tint)]' : ''}`}>
                <Icon d={t.icon} />
              </span>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
