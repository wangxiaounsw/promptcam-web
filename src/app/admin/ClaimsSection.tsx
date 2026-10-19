'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Fordexa 稿占用：一份稿子全站只给一家。永久占用，不自动解除；
 * 要放出来给别家用，在这里手动释放（已经拉走的稿子不受影响）。
 */
type Claim = { code: string; title: string | null; orgName: string | null; claimedBy: string | null; claimedAt: string };

const card = 'rounded-xl border border-white/10 bg-[var(--bg-raised)] p-4';
const btnGhost =
  'rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-40';

export default function ClaimsSection({ token }: { token: string }) {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [err, setErr] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const api = useCallback(
    async (query = '', method = 'GET') => {
      const res = await fetch(`/api/admin/claims${query}`, { method, headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body;
    },
    [token],
  );

  const load = useCallback(async () => {
    try {
      setClaims((await api()).claims);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const release = async (code: string) => {
    setConfirming(null);
    try {
      await api(`?code=${encodeURIComponent(code)}`, 'DELETE');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section className="space-y-3">
      <div className={card}>
        <h2 className="font-display text-lg font-semibold">Fordexa 稿占用</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
          一个选题的 Fordexa 稿只给一家公司用。别家照样能拉这个选题，但拉过去是空稿子，按自己的风格生成。释放后，谁先导入归谁。
        </p>
      </div>
      {err && <p className="text-sm text-[var(--record)]">{err}</p>}
      {claims === null ? (
        <div className={`${card} h-16 animate-pulse`} />
      ) : !claims.length ? (
        <p className="text-sm text-[var(--muted)]">还没有被占用的 Fordexa 稿。</p>
      ) : (
        claims.map((c) => (
          <div key={c.code} className={`${card} flex flex-wrap items-center gap-3`}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <span className="mr-2 text-[var(--muted)]">{c.code}</span>
                {c.title ?? '（选题已删除）'}
              </p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {c.orgName ?? '未知公司'} · {c.claimedBy ?? '未知'} · {c.claimedAt.slice(0, 10)}
              </p>
            </div>
            {confirming === c.code ? (
              <span className="flex items-center gap-2 text-sm">
                确定释放？
                <button className={btnGhost} onClick={() => release(c.code)}>释放</button>
                <button className={btnGhost} onClick={() => setConfirming(null)}>算了</button>
              </span>
            ) : (
              <button className={btnGhost} onClick={() => setConfirming(c.code)}>释放</button>
            )}
          </div>
        ))
      )}
    </section>
  );
}
