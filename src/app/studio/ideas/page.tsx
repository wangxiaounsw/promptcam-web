'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { errorText, send, studioFetch, studioToken } from '../api';
import { Pill, showToast } from '../ui';

/**
 * 灵感库：Fordexa 的公共选题。一篇文章下面挂几条口播，按单条「拉到我这里」——
 * 原样复制 Fordexa 原版进我的口播库（未排期），之后在自己的稿子里改、按风格生成。
 */
type Idea = {
  code: string;
  slug: string;
  title: string;
  summary: string | null;
  industryName: string | null;
  tags: string[];
  hasScript: boolean;
  article: string | null;
};
type Child = { code: string; title: string; summary: string | null; hasScript: boolean };

async function authedGet<T>(path: string): Promise<T> {
  const token = await studioToken();
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('读取灵感库失败');
  return res.json() as Promise<T>;
}

function PullButton({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const pull = async () => {
    setState('busy');
    try {
      const { id } = await studioFetch<{ id: string }>('/api/studio/pull', send('POST', { code }));
      setState('done');
      showToast('已拉到口播库（未排期）', { label: '排个日期', run: () => router.push(`/studio/s/${id}`) });
    } catch (e) {
      setState('idle');
      showToast(errorText(e));
    }
  };
  return (
    <button
      type="button"
      onClick={pull}
      disabled={state === 'busy'}
      className={`h-11 shrink-0 rounded-xl px-3 text-[15px] font-bold ${
        state === 'done' ? 'bg-[var(--accent-tint)] text-[var(--accent)]' : 'bg-[var(--accent)] text-white'
      } disabled:opacity-50`}
    >
      {state === 'busy' ? '拉取中…' : state === 'done' ? '已拉 ✓' : '拉到我这里'}
    </button>
  );
}

function IdeaCard({ idea }: { idea: Idea }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Child[] | null>(null);

  const toggle = async () => {
    setOpen((v) => !v);
    if (children) return;
    try {
      const { idea: full } = await authedGet<{ idea: { children?: Child[] } }>(`/api/ideas?slug=${encodeURIComponent(idea.slug)}`);
      setChildren(full.children ?? []);
    } catch (e) {
      showToast(errorText(e));
    }
  };

  // 没有子口播的：它自己就是一条口播
  const items: Child[] = children?.length ? children : idea.hasScript ? [{ code: idea.code, title: idea.title, summary: null, hasScript: true }] : [];

  return (
    <article className="rounded-2xl bg-[var(--bg-raised)]">
      <button type="button" onClick={toggle} className="w-full p-4 text-left" aria-expanded={open}>
        <h2 className="text-[17px] font-bold leading-snug">{idea.title}</h2>
        {idea.summary && <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-[var(--muted)]">{idea.summary}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill tone="gray">{idea.code}</Pill>
          {idea.industryName && <Pill>{idea.industryName}</Pill>}
          {idea.article && <Pill tone="gray">文章</Pill>}
        </div>
      </button>
      {open && (
        <div className="border-t border-[var(--row-line)]">
          {children === null ? (
            <div className="m-4 h-12 animate-pulse rounded-xl bg-[var(--row-line)]" />
          ) : items.length ? (
            items.map((c) => (
              <div key={c.code} className="flex min-h-14 items-center gap-3 border-b border-[var(--row-line)] px-4 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium">{c.title}</p>
                  <p className="text-[13px] text-[var(--muted)]">{c.code}</p>
                </div>
                {c.hasScript ? <PullButton code={c.code} /> : <span className="text-[13px] text-[var(--muted)]">还没有口播稿</span>}
              </div>
            ))
          ) : (
            <p className="p-4 text-[15px] text-[var(--muted)]">这篇还没有拆出口播。</p>
          )}
        </div>
      )}
    </article>
  );
}

export default function StudioIdeas() {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    authedGet<{ ideas: Idea[] }>('/api/ideas')
      .then((d) => setIdeas(d.ideas))
      .catch((e) => showToast(errorText(e)));
  }, []);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!ideas || !k) return ideas ?? [];
    return ideas.filter((i) => [i.title, i.summary ?? '', i.code, ...i.tags].some((t) => t.toLowerCase().includes(k)));
  }, [ideas, q]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="flex h-11 items-center text-[22px] font-bold">灵感库</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜标题、摘要、标签、编号…"
        className="mt-2 h-14 w-full rounded-2xl border-[1.5px] border-[#8A9690] bg-white px-4 text-base outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-3 flex flex-col gap-3">
        {ideas === null ? (
          <div className="h-32 animate-pulse rounded-2xl bg-[var(--row-line)]" />
        ) : shown.length ? (
          shown.map((i) => <IdeaCard key={i.code} idea={i} />)
        ) : (
          <p className="mt-6 text-center text-[15px] text-[var(--muted)]">没有找到。</p>
        )}
      </div>
    </div>
  );
}
