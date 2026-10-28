'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StudioError, studioFetch, studioToken, type StudioMe } from './api';
import Avatar from './Avatar';
import FeedbackSheet from './FeedbackSheet';
import { OrgSelect, ViewingBanner } from './OrgSwitcher';
import { MeContext, type StudioMeContext } from './studio-me';
import { Toaster } from './ui';
import { bindUser, prefetchMonth } from './calendar/monthStore';
import { pathAfterSwitch, readViewing, writeViewing } from './viewing';

/**
 * 工作台外壳。沿用 App 的三个标签：口播库 / 灵感库 / 我的，网页多一个「主页预览」。
 * 手机：底部标签栏（同 App 的 NavigationBar）；电脑：顶部一行。
 * 先问一次 /api/studio/me：能不能进、我是谁、正在看哪家公司。
 * 管理员切换公司时整棵内容重挂载 —— 每页都按新公司重新取数据。
 */
type Gate = 'checking' | 'open' | 'closed';

const TABS = [
  { href: '/studio/calendar', label: '日历', icon: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z' },
  { href: '/studio', label: '口播库', icon: 'M6 3h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM9 11h6M9 15h6' },
  { href: '/studio/ideas', label: '灵感库', icon: 'M9 18h6M10 21h4M8 14a6 6 0 118 0c-.7.7-1 1.5-1 2.5H9c0-1-.3-1.8-1-2.5z' },
  { href: '/studio/showcase', label: '主页预览', icon: 'M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zM11 18h2' },
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
  // 日历是自己的标签：/studio/calendar 不算口播库
  if (href === '/studio') return pathname === '/studio' || pathname.startsWith('/studio/s/');
  return pathname.startsWith(href);
}

export default function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [gate, setGate] = useState<Gate>('checking');

  const [me, setMe] = useState<StudioMe | null>(null);
  const [feedback, setFeedback] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const data = await studioFetch<StudioMe>('/api/studio/me');
      // 存着的公司无效时服务端回落到自己的公司：把本地也改过来
      if (data.orgs && data.viewing && readViewing() !== data.viewing.id) writeViewing(data.viewing.id);
      bindUser(data.me.id); // 换了登录的人就丢掉上一个人的日历缓存
      setMe(data);
      setGate('open');
    } catch (e) {
      if (e instanceof StudioError && e.status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      else setGate('closed');
    }
  }, [pathname, router]);

  useEffect(() => {
    // 直接进日历：本月数据和 /me 同时开始取，不等 /me 回来（页面挂载后接上这个请求）
    if (pathname.startsWith('/studio/calendar')) prefetchMonth(null);
    (async () => {
      if (!(await studioToken())) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      await loadMe();
    })();
    // 只在进入工作台时查一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTo = useCallback(
    (orgId: string, next = pathAfterSwitch(pathname)) => {
      writeViewing(orgId);
      setMe(null);
      setGate('checking');
      router.push(next);
      if (next.startsWith('/studio/calendar')) prefetchMonth(null); // 深链接切公司：同样和 /me 并行
      loadMe();
    },
    [loadMe, router, pathname],
  );

  const openFeedback = useCallback(() => setFeedback(true), []);
  const ctx = useMemo<StudioMeContext | null>(
    () => (me ? { ...me, switchTo, openFeedback } : null),
    [me, switchTo, openFeedback],
  );

  return (
    <MeContext.Provider value={ctx}>
      <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
        <header className="sticky top-0 z-20 hidden border-b border-[var(--line)] bg-[var(--bg-raised)] md:block">
          <nav className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-6">
            <span className="font-semibold">口播工作台</span>
            <OrgSelect />
            <span className="mr-4" />
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
            {me?.me.isAdmin && <Link href="/admin" className="h-10 px-3 text-[15px] leading-10 text-[var(--muted)]">后台</Link>}
            <Link href="/ideas" className="h-10 px-3 text-[15px] leading-10 text-[var(--muted)]">网站</Link>
            {me && (
              <Link href="/studio/me" aria-label="我的" className="ml-1">
                <Avatar person={me.me} size={28} />
              </Link>
            )}
          </nav>
        </header>

        {gate === 'open' && (
          <div className="sticky top-0 z-10 md:top-14">
            <ViewingBanner />
          </div>
        )}

        <main className="mx-auto max-w-[1440px] px-5 pb-28 pt-4 md:px-6 md:pb-10">
          {gate === 'checking' && <div className="mt-10 h-40 animate-pulse rounded-2xl bg-[var(--row-line)]" />}
          {gate === 'closed' && (
            <div className="mt-16 rounded-2xl bg-[var(--bg-raised)] p-6 text-center">
              <p className="text-[17px] font-bold">工作台还没对你开放</p>
              <p className="mt-2 text-[15px] text-[var(--muted)]">你的账号还没加入已开通的公司。联系 Fordexa 开通后再来。</p>
            </div>
          )}
          {gate === 'open' && <div key={me?.viewing?.id ?? 'none'}>{children}</div>}
        </main>

        <Toaster />
        {gate === 'open' && !feedback && (
          <button
            type="button"
            onClick={openFeedback}
            className="fixed bottom-6 right-6 z-30 hidden h-11 items-center rounded-full bg-[var(--bg-raised)] px-4 text-[14px] font-medium text-[var(--muted)] shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:text-[var(--ink)] md:flex"
          >
            反馈问题
          </button>
        )}
        <FeedbackSheet open={feedback} onClose={() => setFeedback(false)} />

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
    </MeContext.Provider>
  );
}
