'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useAccount } from './useAccount';

/**
 * 页头右侧（电脑）：没登录是「登录」，登录了显示邮箱和「退出」；
 * 管理员多两个入口：口播工作台、后台。手机上这些都收进 MobileMenu 的三条杠里。
 */
export default function UserMenu() {
  const pathname = usePathname();
  const account = useAccount();

  if (account === undefined) return <span className="hidden w-12 sm:inline" />;

  if (!account.email) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname || '/ideas')}`}
        className="hidden text-[15px] text-[var(--muted)] transition-colors hover:text-[var(--ink)] sm:inline"
      >
        登录
      </Link>
    );
  }

  return (
    <span className="hidden items-center gap-4 text-sm sm:flex">
      {account.isAdmin && (
        <>
          <Link href="/studio" className="whitespace-nowrap font-medium text-[var(--accent)]">工作台</Link>
          <Link href="/admin" className="whitespace-nowrap text-[var(--muted)] hover:text-[var(--ink)]">后台</Link>
        </>
      )}
      <span className="max-w-[180px] truncate text-[var(--muted)]">{account.email}</span>
      <button className="text-[var(--muted)] transition-colors hover:text-[var(--ink)]" onClick={signOut}>
        退出
      </button>
    </span>
  );
}
