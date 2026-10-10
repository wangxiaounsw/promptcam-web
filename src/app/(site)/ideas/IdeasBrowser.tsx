'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import type { PublicIdea } from '@/lib/content';

type Sort = 'new' | 'old' | 'industry';

/**
 * 总览的搜索 / 筛选 / 排序 / 试听。
 *
 * 筛选状态放在 URL 里(/ideas?industry=accounting&tag=BAS),
 * 所以每个组合都能分享、能被搜索引擎单独收录,刷新也不丢。
 *
 * 试听:进页面时带着登录态问一次 /api/ideas/audio,拿回「我能听的」链接表。
 * 免费的谁都有;其余只有客户有。没拿到链接的显示锁,点了去详情页登录。
 * 整页只有一个 <audio>,点别的会把上一条停掉。
 */
type Filters = { q: string; industry: string; tag: string; sort: Sort; free: boolean; audio: boolean };
const EMPTY: Filters = { q: '', industry: '', tag: '', sort: 'new', free: false, audio: false };

function fromSearch(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    q: p.get('q') ?? '',
    industry: p.get('industry') ?? '',
    tag: p.get('tag') ?? '',
    sort: (p.get('sort') as Sort) || 'new',
    free: p.get('free') === '1',
    audio: p.get('audio') === '1',
  };
}

export default function IdeasBrowser({ ideas }: { ideas: PublicIdea[] }) {
  /**
   * 筛选状态不用 Next 的 useSearchParams:那个钩子会让静态页把整段列表
   * 留到浏览器再画,HTML 里就没有列表了,Google 看到的是空页。
   * 这里服务端先按「无筛选」把完整列表印出来,浏览器接手后再读一次网址套上筛选。
   */
  const [f, setF] = useState<Filters>(EMPTY);
  useEffect(() => {
    setF(fromSearch(window.location.search));
    const onPop = () => setF(fromSearch(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const { q, industry, tag, sort, free: onlyFree, audio: onlyAudio } = f;

  const set = (patch: Partial<Record<'q' | 'industry' | 'tag' | 'sort' | 'free' | 'audio', string | null>>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    const qs = next.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    setF(fromSearch(qs));
  };

  // 搜索框本地跟手,停 200ms 再写进 URL,免得每敲一个字就改一次历史
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => set({ q: draft.trim() || null }), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const industries = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    for (const i of ideas) {
      const key = i.industry ?? '';
      const name = i.industryName ?? '通用';
      m.set(key, { name, n: (m.get(key)?.n ?? 0) + 1 });
    }
    return [...m.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : b.n - a.n));
  }, [ideas]);

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    const pool = industry ? ideas.filter((i) => (i.industry ?? '') === industry) : ideas;
    for (const i of pool) for (const t of i.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
  }, [ideas, industry]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = ideas.filter((i) => {
      if (industry && (i.industry ?? '') !== industry) return false;
      if (tag && !i.tags.includes(tag)) return false;
      if (onlyFree && !i.isFree) return false;
      if (onlyAudio && !i.hasAudio) return false;
      if (needle) {
        const hay = [i.title, i.summary ?? '', i.code, ...i.tags].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const at = (i: PublicIdea) => (i.publishedAt ? Date.parse(i.publishedAt) : 0);
    if (sort === 'old') list = [...list].sort((a, b) => at(a) - at(b));
    else if (sort === 'industry')
      list = [...list].sort(
        (a, b) =>
          (a.industryName ?? '通用').localeCompare(b.industryName ?? '通用', 'zh') || at(b) - at(a),
      );
    else list = [...list].sort((a, b) => at(b) - at(a));
    return list;
  }, [ideas, q, industry, tag, sort, onlyFree, onlyAudio]);

  // ── 试听 ──
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = await browserSupabase();
        const { data } = (await sb?.auth.getSession()) ?? { data: null };
        const token = data?.session?.access_token;
        const res = await fetch('/api/ideas/audio', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = await res.json();
        if (!cancelled) setAudio(body.audio ?? {});
      } catch {
        /* 拿不到就都显示锁 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (code: string) => {
    const el = player.current;
    if (!el) return;
    if (playing === code) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = audio[code];
    el.play().catch(() => setPlaying(null));
    setPlaying(code);
  };

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm transition-colors ${
      active
        ? 'bg-[var(--accent)] text-white'
        : 'bg-[var(--bg-raised)] text-[var(--muted)] hover:text-[var(--ink)]'
    }`;

  return (
    <div className="mt-12">
      <audio ref={player} onEnded={() => setPlaying(null)} onPause={() => setPlaying(null)} />

      {/* 搜索 + 排序 */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] px-4 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]"
          placeholder="搜标题、摘要、标签，或者编号 FX-0007"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <select
          className="rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2.5 text-sm"
          value={sort}
          onChange={(e) => set({ sort: e.target.value === 'new' ? null : e.target.value })}
        >
          <option value="new">最新在前</option>
          <option value="old">最早在前</option>
          <option value="industry">按行业</option>
        </select>
      </div>

      {/* 行业 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={chip(!industry)} onClick={() => set({ industry: null, tag: null })}>
          全部 {ideas.length}
        </button>
        {industries.map((i) => (
          <button
            key={i.key}
            className={chip(industry === i.key)}
            onClick={() => set({ industry: industry === i.key ? null : i.key, tag: null })}
          >
            {i.name} {i.n}
          </button>
        ))}
        <span className="mx-1 self-center text-[var(--line)]">|</span>
        <button className={chip(onlyFree)} onClick={() => set({ free: onlyFree ? null : '1' })}>
          免费样稿
        </button>
        <button className={chip(onlyAudio)} onClick={() => set({ audio: onlyAudio ? null : '1' })}>
          有朗读
        </button>
      </div>

      {/* 标签 */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map(([t, n]) => (
            <button
              key={t}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                tag === t
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => set({ tag: tag === t ? null : t })}
            >
              {t} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
      )}

      {/* 列表 */}
      <p className="mt-8 text-xs text-[var(--muted)]">
        {shown.length === ideas.length ? `${ideas.length} 条` : `${shown.length} / ${ideas.length} 条`}
      </p>
      {!shown.length && (
        <p className="mt-6 text-[var(--muted)]">
          {ideas.length ? '没有符合条件的，换个筛选试试。' : '选题还在整理中，过几天再来看看。'}
        </p>
      )}
      <div className="mt-3 space-y-2.5">
        {shown.map((i) => {
          const canPlay = Boolean(audio[i.code]);
          return (
            <div
              key={i.code}
              className="flex items-start gap-4 rounded-2xl bg-[var(--bg-raised)] p-5 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(18,24,21,0.18)]"
            >
              {/* 试听键 */}
              {i.hasAudio ? (
                canPlay ? (
                  <button
                    aria-label={playing === i.code ? '暂停' : '试听'}
                    onClick={() => toggle(i.code)}
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                      playing === i.code
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--accent-tint)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white'
                    }`}
                  >
                    {playing === i.code ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z" /></svg>
                    )}
                  </button>
                ) : (
                  <Link
                    href={`/ideas/${i.slug}`}
                    title="登录后试听"
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--row-line)] text-[var(--muted)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="6" width="9" height="7" rx="1.5" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" /></svg>
                  </Link>
                )
              ) : (
                <span className="mt-0.5 h-10 w-10 shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <Link href={`/ideas/${i.slug}`} className="block">
                  <h3 className="font-display text-lg font-semibold leading-snug hover:text-[var(--accent)]">
                    {i.title}
                  </h3>
                </Link>
                {i.summary && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                    {i.summary}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-[var(--muted)]">
                  <span className="font-mono">{i.code}</span>
                  {i.industryName && (
                    <span className="rounded-full bg-[var(--accent-tint)] px-2 py-0.5 font-medium text-[var(--accent)]">
                      {i.industryName}
                    </span>
                  )}
                  {i.tags.map((t) => (
                    <button
                      key={t}
                      className="rounded-full border border-[var(--line)] px-2 py-0.5 hover:text-[var(--ink)]"
                      onClick={() => set({ tag: t })}
                    >
                      {t}
                    </button>
                  ))}
                  {i.isFree && (
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-medium text-white">
                      免费样稿
                    </span>
                  )}
                  {i.publishedAt && (
                    <time dateTime={i.publishedAt}>
                      {new Date(i.publishedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </time>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-20 rounded-2xl bg-[var(--bg-raised)] p-8">
        <h2 className="font-display mb-3 text-xl font-semibold">想直接拿去拍？</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          Fordexa 的客户打开 App 就能看到这些选题的完整口播稿，举起手机照着念，
          录完发回给我们，剪辑和发布也由我们做。
          <Link className="text-[var(--accent)] hover:underline" href="/login?next=%2Fideas">
            登录
          </Link>
          后可以直接申请开通，整家公司的人一起能看。
        </p>
      </div>
    </div>
  );
}
