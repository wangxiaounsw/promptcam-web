'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';

/**
 * 页头右侧:没登录是「登录」,登录了显示邮箱和「退出」。
 * 服务端渲染时不知道登录态,先渲染成空位,浏览器里再补 —— 避免闪一下。
 */
export default function UserMenu() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let unsub = () => {};
    browserSupabase().then((sb) => {
      if (!sb) return setEmail(null);
      sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
      const { data } = sb.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
      unsub = () => data.subscription.unsubscribe();
    });
    return () => unsub();
  }, []);

  if (email === undefined) return <span className="w-12" />;

  if (!email) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname || '/ideas')}`}
        className="text-[15px] text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
      >
        登录
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-3 text-sm">
      <span className="hidden max-w-[180px] truncate text-[var(--muted)] sm:inline">{email}</span>
      <button
        className="text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        onClick={async () => {
          const sb = await browserSupabase();
          await sb?.auth.signOut();
          window.location.reload();
        }}
      >
        退出
      </button>
    </span>
  );
}
