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

type AccountData = { isAdmin?: boolean; canStudio?: boolean; name?: string | null; avatarUrl?: string | null } | null;

/**
 * 页头、手机菜单都用这个 hook,每个又会在拿到会话和会话事件时各问一次 ——
 * 同一个 token 一分钟内只真正请求一次,大家共用结果;换了 token(登录 / 刷新)或过了一分钟才重新问
 * (工作台里改了名字头像,切回站点页头一分钟内会换上)。
 */
const SHARE_MS = 60_000;
let shared: { token: string; at: number; data: Promise<AccountData> } | null = null;

function fetchAccount(token: string): Promise<AccountData> {
  if (shared?.token === token && Date.now() - shared.at < SHARE_MS) return shared.data;
  const data = fetch('/api/account', { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => (res.ok ? (res.json() as Promise<AccountData>) : null))
    .catch((e: unknown) => {
      // 失败的不留着,下次再问
      if (shared?.token === token) shared = null;
      throw e;
    });
  shared = { token, at: Date.now(), data };
  return data;
}

export function useAccount(): Account {
  const [account, setAccount] = useState<Account>(undefined);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    const load = async (token: string | null, email: string | null) => {
      if (!token) return setAccount(SIGNED_OUT);
      try {
        const data = await fetchAccount(token);
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
