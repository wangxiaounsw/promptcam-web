'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import ReactionBar, { type Mine } from '@/components/ReactionBar';
import type { PublicIdea, Topic } from '@/lib/content';

type Sort = 'new' | 'hot';

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
type Filters = { q: string; industry: string; topic: string; tag: string; sort: Sort; free: boolean; audio: boolean; saved: boolean; liked: boolean };
const EMPTY: Filters = { q: '', industry: '', topic: '', tag: '', sort: 'new', free: false, audio: false, saved: false, liked: false };

function fromSearch(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    q: p.get('q') ?? '',
    industry: p.get('industry') ?? '',
    topic: p.get('topic') ?? '',
    tag: p.get('tag') ?? '',
    sort: p.get('sort') === 'hot' ? 'hot' : 'new',
    free: p.get('free') === '1',
    audio: p.get('audio') === '1',
    saved: p.get('saved') === '1',
    liked: p.get('liked') === '1',
  };
}

export default function IdeasBrowser({ ideas, topics }: { ideas: PublicIdea[]; topics: Topic[] }) {
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

  const { q, industry, topic, tag, sort, free: onlyFree, audio: onlyAudio, saved: onlySaved, liked: onlyLiked } = f;

  const set = (patch: Partial<Record<'q' | 'industry' | 'topic' | 'tag' | 'sort' | 'free' | 'audio' | 'saved' | 'liked', string | null>>) => {
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

  // 点赞/收藏:进页面时一次拉全部(计数 + 我点过哪些),每行按钮共用,不各自请求
  const [mine, setMine] = useState<Record<string, Mine>>({});
  const [counts, setCounts] = useState<Record<string, { likes: number; saves: number }>>({});
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const headers: Record<string, string> = {};
      try {
        const d = localStorage.getItem('fx_device'); if (d) headers['x-device'] = d;
        const sb = await browserSupabase();
        const { data } = (await sb?.auth.getSession()) ?? { data: null };
        if (data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      } catch { /* 未登录 */ }
      const r = await fetch('/api/reactions?all=1', { headers }).then((x) => x.json()).catch(() => null);
      if (cancelled || !r) return;
      setMine(r.mine ?? {}); setCounts(r.counts ?? {}); setSignedIn(Boolean(r.signedIn));
    })();
    return () => { cancelled = true; };
  }, []);
  // 「我的收藏」开关:没登录就送去登录页
  useEffect(() => {
    if (onlySaved && signedIn === false) window.location.href = '/login?next=' + encodeURIComponent('/ideas?saved=1');
  }, [onlySaved, signedIn]);
  const onReact = (code: string, m: Mine, likes: number, saves: number) => {
    setMine((prev) => ({ ...prev, [code]: m }));
    setCounts((prev) => ({ ...prev, [code]: { likes, saves } }));
  };
  const likesOf = (i: PublicIdea) => counts[i.code]?.likes ?? i.likes;
  const savesOf = (i: PublicIdea) => counts[i.code]?.saves ?? i.saves;

  // 行业胶囊。没填行业的是「通用」,哪个行业都能讲,所以不单独成一个胶囊,选任何行业都带着它们
  const industries = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    for (const i of ideas) {
      if (!i.industry) continue;
      m.set(i.industry, { name: i.industryName ?? i.industry, n: (m.get(i.industry)?.n ?? 0) + 1 });
    }
    return [...m.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.n - a.n);
  }, [ideas]);

  // 当前行业的主题,只列有口播的,按主题表顺序
  const topicChips = useMemo(() => {
    if (!industry) return [];
    const have = new Set(ideas.filter((i) => (i.industry ?? '') === industry).map((i) => i.topic ?? ''));
    return topics.filter((t) => t.industry === industry && have.has(t.key));
  }, [ideas, topics, industry]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = ideas.filter((i) => {
      // 通用(没填行业)的在任何行业下都显示
      if (industry && i.industry && i.industry !== industry) return false;
      if (topic && (i.topic ?? '') !== topic) return false;
      if (tag && !i.tags.includes(tag)) return false;
      if (onlyFree && !i.isFree) return false;
      if (onlyAudio && !i.hasAudio) return false;
      if (onlySaved && !mine[i.code]?.saved) return false;
      if (onlyLiked && !mine[i.code]?.liked) return false;
      if (needle) {
        const hay = [i.title, i.summary ?? '', i.code, ...i.tags].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const at = (i: PublicIdea) => (i.publishedAt ? Date.parse(i.publishedAt) : 0);
    if (sort === 'hot') list = [...list].sort((a, b) => (likesOf(b) + savesOf(b) * 2) - (likesOf(a) + savesOf(a) * 2) || at(b) - at(a));
    else list = [...list].sort((a, b) => at(b) - at(a));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideas, q, industry, topic, tag, sort, onlyFree, onlyAudio, onlySaved, onlyLiked, mine, counts]);

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
    `shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors ${
      active
        ? 'bg-[var(--ink)] text-white'
        : 'bg-[var(--bg-raised)] text-[var(--muted)] hover:text-[var(--ink)]'
    }`;
  const sub = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
      active
        ? 'border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]'
        : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
    }`;
  const small = (active: boolean) =>
    `whitespace-nowrap transition-colors ${active ? 'font-medium text-[var(--accent)]' : 'hover:text-[var(--ink)]'}`;
  const dateOf = (iso: string) => {
    const d = new Date(iso);
    const thisYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('zh-CN', thisYear ? { month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="mt-6">
      <audio ref={player} onEnded={() => setPlaying(null)} onPause={() => setPlaying(null)} />

      {/* 第一层：搜索 + 排序 */}
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] px-4 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]"
          placeholder="搜标题、标签或编号"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <select
          aria-label="排序"
          className="shrink-0 rounded-xl border border-[var(--line)] bg-[var(--bg-raised)] px-3 py-2.5 text-sm"
          value={sort}
          onChange={(e) => set({ sort: e.target.value === 'new' ? null : e.target.value })}
        >
          <option value="new">最新</option>
          <option value="hot">最热</option>
        </select>
      </div>

      {/* 第二层：行业，一行横滑不换行 */}
      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <button className={chip(!industry)} onClick={() => set({ industry: null, topic: null, tag: null })}>
          全部
        </button>
        {industries.map((i) => (
          <button key={i.key} className={chip(industry === i.key)} onClick={() => set({ industry: industry === i.key ? null : i.key, topic: null, tag: null })}>
            {i.name}
          </button>
        ))}
      </div>

      {/* 第三层：主题，选了行业才出现 */}
      {topicChips.length > 0 && (
        <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <button className={sub(!topic)} onClick={() => set({ topic: null })}>全部主题</button>
          {topicChips.map((t) => (
            <button key={t.key} className={sub(topic === t.key)} onClick={() => set({ topic: topic === t.key ? null : t.key })}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* 计数 + 小开关。标签筛选只从详情页/文章页点进来，这里只显示可关掉的当前标签 */}
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--muted)]">
        <span>{shown.length === ideas.length ? `${ideas.length} 条` : `${shown.length} / ${ideas.length} 条`}</span>
        <span className="text-[var(--line)]">|</span>
        <button className={small(onlyFree)} onClick={() => set({ free: onlyFree ? null : '1' })}>免费样稿</button>
        <button className={small(onlyAudio)} onClick={() => set({ audio: onlyAudio ? null : '1' })}>有朗读</button>
        {signedIn && (
          <>
            <button className={small(onlyLiked)} onClick={() => set({ liked: onlyLiked ? null : '1' })}>赞过</button>
            <button className={small(onlySaved)} onClick={() => set({ saved: onlySaved ? null : '1' })}>收藏</button>
          </>
        )}
        {tag && (
          <button
            className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)] px-2 py-0.5 text-[var(--accent)]"
            onClick={() => set({ tag: null })}
            aria-label={`取消标签 ${tag}`}
          >
            {tag} <span aria-hidden>×</span>
          </button>
        )}
      </div>

      {/* 列表：一条一张轻卡片，每条三行：标题、一句摘要、一行元信息 */}
      {!shown.length && (
        <p className="mt-8 text-[var(--muted)]">
          {ideas.length ? '没有符合条件的，换个筛选试试。' : '选题还在整理中，过几天再来看看。'}
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {shown.map((i) => {
          const canPlay = Boolean(audio[i.code]);
          return (
            <li key={i.code} className="flex items-start gap-3 rounded-xl bg-[var(--bg-raised)] px-4 py-4 transition-shadow hover:shadow-[0_6px_20px_-12px_rgba(18,24,21,0.2)] sm:px-5">
              <div className="min-w-0 flex-1">
                <Link href={`/ideas/${i.slug}`} className="block">
                  <h3 className="font-display text-[17px] font-semibold leading-snug hover:text-[var(--accent)] sm:text-lg">
                    {i.title}
                  </h3>
                </Link>
                {i.summary && (
                  <p className="mt-1 line-clamp-1 text-sm leading-relaxed text-[var(--muted)] sm:line-clamp-2">
                    {i.summary}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
                  {/* 左边超长就截断，右边的赞和收藏固定同一行 */}
                  <div className="min-w-0 flex-1 truncate">
                    {[
                      <span key="ind">{i.industryName ?? '通用'}</span>,
                      i.topicName && <span key="top">{i.topicName}</span>,
                      i.isFree && <span key="free" className="font-medium text-[var(--accent)]">免费样稿</span>,
                      i.article && <span key="art">有文章</span>,
                      i.publishedAt && <time key="at" dateTime={i.publishedAt}>{dateOf(i.publishedAt)}</time>,
                    ]
                      .filter(Boolean)
                      .map((el, k) => (
                        <span key={k}>
                          {k > 0 && <span aria-hidden className="mx-1.5">·</span>}
                          {el}
                        </span>
                      ))}
                  </div>
                  <span className="shrink-0">
                    <ReactionBar code={i.code} likes={likesOf(i)} saves={savesOf(i)} plain next="/ideas" mine={mine[i.code] ?? { liked: false, saved: false }} onChange={onReact} />
                  </span>
                </div>
              </div>

              {/* 试听键：有朗读才出现，贴着标题右侧 */}
              {i.hasAudio &&
                (canPlay ? (
                  <button
                    aria-label={playing === i.code ? '暂停' : '试听'}
                    onClick={() => toggle(i.code)}
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                      playing === i.code
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--accent-tint)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white'
                    }`}
                  >
                    {playing === i.code ? (
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" /></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z" /></svg>
                    )}
                  </button>
                ) : (
                  <Link
                    href={`/ideas/${i.slug}`}
                    title="登录后试听"
                    aria-label="登录后试听"
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--row-line)] text-[var(--muted)]"
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="6" width="9" height="7" rx="1.5" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" /></svg>
                  </Link>
                ))}
            </li>
          );
        })}
      </ul>

      <div className="mt-16 rounded-2xl bg-[var(--bg-raised)] p-6 sm:p-8">
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
