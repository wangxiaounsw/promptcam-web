'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '@/app/studio/Avatar';
import { signOut, useAccount } from './useAccount';

/**
 * 手机页头右上角的三条杠。390 宽下导航和登录放不下，收进这里；
 * 能进工作台的人多一个「口播工作台」，管理员再多一个「后台」。
 */
const NAV = [
  { href: '/how', label: '怎么运作' },
  { href: '/ideas', label: '口播库' },
  { href: '/apply', label: '申请开通' },
];

const row = 'flex h-14 items-center border-b border-[var(--row-line)] px-5 text-base last:border-b-0';

export default function MobileMenu() {
  const pathname = usePathname();
  const account = useAccount();
  const [open, setOpen] = useState(false);

  // 换页就收起
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? '收起菜单' : '打开菜单'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="-mr-2 flex h-11 w-11 items-center justify-center text-[var(--ink)]"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {/* 挂到 body 上：页头有 backdrop-blur，会把里面的 fixed 元素圈在页头那 56px 里 */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 top-14 z-30 bg-[#121815]/40 sm:hidden" onClick={() => setOpen(false)} />
          <nav className="fixed inset-x-0 top-14 z-40 border-b sm:hidden border-[var(--line)] bg-[var(--bg-raised)] shadow-lg">
            {account?.canStudio && (
              <div className="border-b-8 border-[var(--bg)]">
                <Link href="/studio" className={`${row} font-bold text-[var(--accent)]`}>口播工作台</Link>
                {account.isAdmin && <Link href="/admin" className={`${row} font-medium`}>后台</Link>}
              </div>
            )}
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={row}>{n.label}</Link>
            ))}
            {account?.email ? (
              <div className="flex h-14 items-center justify-between border-t-8 border-[var(--bg)] px-5 text-[15px]">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar person={{ id: '', name: account.name ?? account.email, avatarUrl: account.avatarUrl, isAdmin: account.isAdmin }} size={28} />
                  <span className="min-w-0 truncate text-[var(--muted)]">{account.email}</span>
                </span>
                <button type="button" onClick={signOut} className="h-11 shrink-0 pl-4 font-medium text-[var(--muted)]">退出</button>
              </div>
            ) : (
              account !== undefined && (
                <Link href={`/login?next=${encodeURIComponent(pathname || '/ideas')}`} className={`${row} border-t-8 border-t-[var(--bg)] font-medium text-[var(--accent)]`}>
                  登录
                </Link>
              )
            )}
          </nav>
        </>,
        document.body,
      )}
    </div>
  );
}
