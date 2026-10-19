'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Avatar from '@/app/studio/Avatar';
import { signOut, useAccount } from './useAccount';

/**
 * 页头右侧（电脑）：没登录是「登录」，登录了显示头像、邮箱和「退出」；
 * 能进工作台的人（管理员 + 已开通公司的成员）多一个「工作台」，管理员再多一个「后台」。
 * 手机上这些都收进 MobileMenu 的三条杠里。
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
      {account.canStudio && <Link href="/studio" className="whitespace-nowrap font-medium text-[var(--accent)]">工作台</Link>}
      {account.isAdmin && <Link href="/admin" className="whitespace-nowrap text-[var(--muted)] hover:text-[var(--ink)]">后台</Link>}
      <span className="flex items-center gap-1.5">
        <Avatar person={{ id: '', name: account.name ?? account.email, avatarUrl: account.avatarUrl, isAdmin: account.isAdmin }} size={20} />
        <span className="max-w-[180px] truncate text-[var(--muted)]">{account.email}</span>
      </span>
      <button className="text-[var(--muted)] transition-colors hover:text-[var(--ink)]" onClick={signOut}>
        退出
      </button>
    </span>
  );
}
