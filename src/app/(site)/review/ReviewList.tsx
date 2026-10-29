'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import type { ReviewListItem } from '@/lib/content';
import { openLogin } from '@/components/LoginDialog';

type State = 'loading' | 'anon' | 'forbidden' | 'error' | 'ok';
type Item = ReviewListItem & { hasFacts: boolean };

/** Claude 放进新草稿,这一页自己出现,不用手动刷新 */
const POLL_MS = 10000;

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '';

/** 审稿列表:还没发布的文章和口播,点进去就是那篇的审稿页 */
export default function ReviewList() {
  const [state, setState] = useState<State>('loading');
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    try {
      const sb = await browserSupabase();
      const { data } = (await sb?.auth.getSession()) ?? { data: null };
      const token = data?.session?.access_token;
      if (!token) return setState('anon');
      const res = await fetch('/api/admin/review/list', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 403) return setState('forbidden');
      if (!res.ok) return setState('error');
      const body = (await res.json()) as { items: Item[] };
      setItems(body.items);
      setState('ok');
    } catch {
      setState((s) => (s === 'ok' ? s : 'error'));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-14">
      <h1 className="font-display text-2xl font-semibold">待审稿</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        还没发布的文章和口播。点进去看稿、听试听、核事实；要改哪里跟 Claude 说，说「发布」才上线。
      </p>

      {state === 'loading' && <div className="mt-8 h-40 animate-pulse rounded-2xl bg-[var(--row-line)]" />}
      {state === 'anon' && (
        <p className="mt-8 text-[var(--muted)]">
          要先
          <button type="button" onClick={openLogin} className="mx-1 text-[var(--accent)] hover:underline">登录</button>
          管理员账号。
        </p>
      )}
      {state === 'forbidden' && <p className="mt-8 text-[var(--muted)]">这个账号不是管理员，看不了审稿页。</p>}
      {state === 'error' && <p className="mt-8 text-[var(--muted)]">取不到列表，过几秒会自动再试。</p>}

      {state === 'ok' && items.length === 0 && <p className="mt-8 text-[var(--muted)]">没有待审的稿子。</p>}
      {state === 'ok' && items.length > 0 && (
        <ul className="mt-8 divide-y divide-[var(--row-line)] border-y border-[var(--row-line)]">
          {items.map((i) => (
            <li key={i.code}>
              <Link
                href={`/review/${i.code.toLowerCase()}`}
                className="flex items-start gap-3 py-3.5 transition-colors hover:bg-[var(--row-line)]/40"
              >
                <span className="w-16 shrink-0 pt-0.5 font-mono text-xs text-[var(--muted)]">{i.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium leading-snug text-[var(--ink)]">{i.title}</span>
                  <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                    {i.status === 'draft' ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">文章草稿</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">文章已发布</span>
                    )}
                    {i.draftScripts > 0 && <span className="py-0.5">口播草稿 {i.draftScripts} 条</span>}
                    {i.hasFacts && <span className="py-0.5">有事实核对</span>}
                    {i.industryName && <span className="py-0.5">{i.industryName}</span>}
                  </span>
                </span>
                <span className="shrink-0 pt-0.5 text-xs text-[var(--muted)]">{day(i.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
