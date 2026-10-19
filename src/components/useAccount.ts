'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';

/**
 * 页头要知道的登录态：邮箱、是不是管理员、能不能进工作台、名字和头像。
 * undefined = 还在浏览器里确认，先别渲染，免得闪一下。
 * 这里只决定「显不显示入口」—— 真正的权限在接口上查。
 */
export type Account =
  | { email: string | null; isAdmin: boolean; canStudio: boolean; name: string | null; avatarUrl: string | null }
  | undefined;

const SIGNED_OUT = { email: null, isAdmin: false, canStudio: false, name: null, avatarUrl: null };

export function useAccount(): Account {
  const [account, setAccount] = useState<Account>(undefined);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    const load = async (token: string | null, email: string | null) => {
      if (!token) return setAccount(SIGNED_OUT);
      try {
        const res = await fetch('/api/account', { headers: { Authorization: `Bearer ${token}` } });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        setAccount({
          email,
          isAdmin: Boolean(data?.isAdmin),
          canStudio: Boolean(data?.canStudio),
          name: data?.name ?? null,
          avatarUrl: data?.avatarUrl ?? null,
        });
      } catch {
        if (!cancelled) setAccount({ ...SIGNED_OUT, email });
      }
    };
    browserSupabase().then((sb) => {
      if (!sb) return setAccount(SIGNED_OUT);
      sb.auth.getSession().then(({ data }) => load(data.session?.access_token ?? null, data.session?.user.email ?? null));
      const { data } = sb.auth.onAuthStateChange((_e, s) => load(s?.access_token ?? null, s?.user.email ?? null));
      unsub = () => data.subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return account;
}

export async function signOut() {
  const sb = await browserSupabase();
  await sb?.auth.signOut();
  window.location.reload();
}
