'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { errorText, send, studioFetch, studioHeaders, studioToken } from '../api';
import { Pill, showToast } from '../ui';

/**
 * 灵感库：Fordexa 的公共选题。一篇文章下面挂几条口播，按单条「拉到我这里」——
 * 原样复制 Fordexa 原版进口播库（未排期），之后在自己的稿子里改、按风格生成。
 * Fordexa 稿全站只给一家：被别家用了的，照样能拉，但拉来的是空稿子，自己生成。
 */
type Claim = 'ours' | 'taken';
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
  const res = await fetch(path, { headers: token ? studioHeaders(token) : {} });
  if (!res.ok) throw new Error('读取灵感库失败');
  return res.json() as Promise<T>;
}

function PullButton({ code, claim }: { code: string; claim: Claim | undefined }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const pull = async () => {
    setState('busy');
    try {
      const { id, taken } = await studioFetch<{ id: string; taken: boolean }>('/api/studio/pull', send('POST', { code }));
      setState('done');
      showToast(
        taken
          ? '已拉到口播库。Fordexa 稿已被别家使用，正文是空的——在稿子页点生成，按你们的风格写一份'
          : '已拉到口播库（未排期）',
        { label: taken ? '去生成' : '排个日期', run: () => router.push(`/studio/s/${id}`) },
      );
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
      {state === 'busy' ? '拉取中…' : state === 'done' ? '已拉 ✓' : claim === 'taken' ? '拉来自己写' : '拉到我这里'}
    </button>
  );
}

function ClaimTag({ claim }: { claim: Claim | undefined }) {
  if (claim === 'taken') return <Pill tone="yellow">Fordexa 稿已被使用</Pill>;
  if (claim === 'ours') return <span className="text-[13px] text-[var(--muted)]">已在你们的口播库</span>;
  return null;
}

function IdeaCard({ idea, claims }: { idea: Idea; claims: Record<string, Claim> }) {
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
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--muted)]">
                    {c.code}
                    <ClaimTag claim={claims[c.code]} />
                  </p>
                </div>
                {c.hasScript ? <PullButton code={c.code} claim={claims[c.code]} /> : <span className="text-[13px] text-[var(--muted)]">还没有口播稿</span>}
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
  const [claims, setClaims] = useState<Record<string, Claim>>({});

  useEffect(() => {
    authedGet<{ ideas: Idea[] }>('/api/ideas')
      .then((d) => setIdeas(d.ideas))
      .catch((e) => showToast(errorText(e)));
    // 占用状态拿不到不挡路：拉的时候服务端照样会按占用处理
    studioFetch<{ claims: Record<string, Claim> }>('/api/studio/claims')
      .then((d) => setClaims(d.claims))
      .catch(() => {});
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
          shown.map((i) => <IdeaCard key={i.code} idea={i} claims={claims} />)
        ) : (
          <p className="mt-6 text-center text-[15px] text-[var(--muted)]">没有找到。</p>
        )}
      </div>
    </div>
  );
}
