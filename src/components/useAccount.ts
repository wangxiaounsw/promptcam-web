'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';

/**
 * 页头要知道的登录态：邮箱 + 是不是管理员（管理员才露出工作台和后台的入口）。
 * undefined = 还在浏览器里确认，先别渲染，免得闪一下。
 * profiles 对本人只读，is_admin 只有服务端能写，这里读到的只是「显不显示入口」——
 * 真正的权限在接口上查。
 */
export type Account = { email: string | null; isAdmin: boolean } | undefined;

export function useAccount(): Account {
  const [account, setAccount] = useState<Account>(undefined);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    const load = async (userId: string | null, email: string | null) => {
      if (!userId) return setAccount({ email: null, isAdmin: false });
      const sb = await browserSupabase();
      const { data } = (await sb?.from('profiles').select('is_admin').eq('id', userId).maybeSingle()) ?? { data: null };
      if (!cancelled) setAccount({ email, isAdmin: Boolean(data?.is_admin) });
    };
    browserSupabase().then((sb) => {
      if (!sb) return setAccount({ email: null, isAdmin: false });
      sb.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null, data.session?.user.email ?? null));
      const { data } = sb.auth.onAuthStateChange((_e, s) => load(s?.user.id ?? null, s?.user.email ?? null));
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
