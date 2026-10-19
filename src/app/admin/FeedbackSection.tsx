'use client';

import { useCallback, useEffect, useState } from 'react';

/** 工作台里提交的反馈：看内容和截图，标已处理 / 重新打开。默认只看未处理的 */
type Report = {
  id: string;
  reporterName: string;
  orgName: string | null;
  pageUrl: string | null;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  imageUrls: string[];
};

const card = 'rounded-xl border border-white/10 bg-[var(--bg-raised)] p-4';
const btnGhost =
  'rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-40';

const WHEN = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Australia/Melbourne',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export default function FeedbackSection({ token }: { token: string }) {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [err, setErr] = useState('');

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`/api/admin/feedback${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body;
    },
    [token],
  );

  const load = useCallback(async () => {
    setReports(null);
    try {
      setReports((await api(`?status=${status}`)).reports);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api, status]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = async (id: string, to: 'open' | 'resolved') => {
    try {
      await api('', { method: 'PATCH', body: JSON.stringify({ id, status: to }) });
      setReports((list) => list?.filter((r) => r.id !== id) ?? null);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        {(['open', 'resolved'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setStatus(k)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              status === k ? 'bg-[var(--accent)] font-medium text-black' : 'border border-white/15 text-[var(--muted)]'
            }`}
          >
            {k === 'open' ? '未处理' : '已处理'}
          </button>
        ))}
      </div>
      {err && <p className="text-sm text-[var(--record)]">{err}</p>}
      {reports === null ? (
        <div className={`${card} h-20 animate-pulse`} />
      ) : !reports.length ? (
        <p className="text-sm text-[var(--muted)]">{status === 'open' ? '没有未处理的反馈。' : '还没有处理过的反馈。'}</p>
      ) : (
        reports.map((r) => (
          <article key={r.id} className={`${card} space-y-2`}>
            <p className="text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">{r.reporterName}</span>
              {r.orgName && ` · ${r.orgName}`} · {WHEN.format(new Date(r.createdAt))}
              {r.pageUrl && <code className="ml-2 text-xs">{r.pageUrl}</code>}
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">{r.message}</p>
            {r.imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {r.imageUrls.map((u, i) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-lg border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`截图 ${i + 1}`} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            <button className={btnGhost} onClick={() => mark(r.id, r.status === 'open' ? 'resolved' : 'open')}>
              {r.status === 'open' ? '标为已处理' : '重新打开'}
            </button>
          </article>
        ))
      )}
    </section>
  );
}
