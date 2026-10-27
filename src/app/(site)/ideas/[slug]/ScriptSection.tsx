'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import ScriptGate, { TakenNote } from './ScriptGate';
import ScriptBody from './ScriptBody';
import PullButton from './PullButton';
import ReactionBar from '@/components/ReactionBar';
import type { Ref } from '@/lib/content';
import { openLogin } from '@/components/LoginDialog';

/**
 * 文章页下面的一条口播:标题 + 编号 + 播放器 + 「展开口播稿」。
 * 正文默认收起,免得一篇文章下面三条口播把页面撑得老长。
 * 播放器和正文都按权限:没权限显示锁,点了去登录/申请(由 ScriptGate 处理)。
 */
export default function ScriptSection({
  slug, code, title, summary, hasAudio, isFree, likes = 0, saves = 0, standalone = false, tags = [], industry = null, industryName = null, refs = [],
  preloaded, badge,
}: {
  refs?: Ref[]; slug: string; code: string; title: string; summary: string | null; hasAudio: boolean; isFree: boolean; likes?: number; saves?: number; standalone?: boolean; tags?: string[]; industry?: string | null; industryName?: string | null;
  /** 审稿页:正文和试听已经拿到了,不再按权限去取;稿子默认展开,不显示点赞和「加到口播库」 */
  preloaded?: { script: string | null; audioUrl: string | null };
  /** 审稿页:标题旁的状态牌(草稿 / 已发布) */
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(preloaded));
  const [audioUrl, setAudioUrl] = useState<string | null>(preloaded?.audioUrl ?? null);
  const [script, setScript] = useState<string | null>(preloaded?.script ?? null);
  const [state, setState] = useState<'loading' | 'open' | 'locked' | 'taken'>(preloaded ? 'open' : 'loading');
  const [signedIn, setSignedIn] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const reviewing = Boolean(preloaded);

  const preScript = preloaded?.script ?? null;
  const preAudio = preloaded?.audioUrl ?? null;
  useEffect(() => {
    if (reviewing) {
      // 审稿页刷新后稿子或试听换了,跟着换
      setScript(preScript);
      setAudioUrl(preAudio);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sb = await browserSupabase();
        const { data } = (await sb?.auth.getSession()) ?? { data: null };
        const token = data?.session?.access_token;
        const res = await fetch(`/api/ideas?slug=${encodeURIComponent(slug)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const body = await res.json();
        if (cancelled) return;
        setSignedIn(Boolean(body?.signedIn));
        if (body?.idea?.script) { setScript(body.idea.script); setAudioUrl(body.idea.audioUrl ?? null); setState('open'); }
        else setState(body?.idea?.taken ? 'taken' : 'locked');
      } catch { if (!cancelled) setState('locked'); }
    })();
    return () => { cancelled = true; };
  }, [slug, reviewing, preScript, preAudio]);

  return (
    <section id={code.toLowerCase()} className="rounded-2xl bg-[var(--bg-raised)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs text-[var(--muted)]">{code}</span>
        {isFree && <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-medium text-white">免费样稿</span>}
        <h3 className="font-display min-w-0 flex-1 text-base font-semibold leading-snug">{title}</h3>
        {badge}
        {!standalone && !reviewing && <ReactionBar code={code} likes={likes} saves={saves} size="sm" next={`/ideas/${slug}`} />}
      </div>
      {summary && <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{summary}</p>}
      {/* 行业 + 标签:点了去口播库按它筛 */}
      {!standalone && (industryName || tags.length > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          {industryName && (
            <Link href={`/ideas?industry=${encodeURIComponent(industry ?? '')}`} className="rounded-full bg-[var(--accent-tint)] px-2 py-0.5 font-medium text-[var(--accent)]">
              {industryName}
            </Link>
          )}
          {tags.map((t) => (
            <Link key={t} href={`/ideas?tag=${encodeURIComponent(t)}`} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[var(--muted)] hover:text-[var(--ink)]">
              {t}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasAudio && state === 'open' && audioUrl && (
          <audio key={audioUrl} ref={player} controls preload="none" src={audioUrl} className="h-9 min-w-0 flex-1" />
        )}
        {reviewing && !audioUrl && <span className="text-sm text-[var(--muted)]">还没生成试听</span>}
        {hasAudio && state === 'locked' && (
          <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="6" width="9" height="7" rx="1.5" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" /></svg>
            朗读和口播稿给合作公司
          </span>
        )}
        <button
          className="rounded-lg bg-[var(--accent-tint)] px-3 py-1.5 text-sm font-medium text-[var(--accent)]"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '收起口播稿 ▴' : '展开口播稿 ▾'}
        </button>
        {state === 'locked' && (signedIn ? (
          <Link href="/apply" className="text-sm text-[var(--accent)] hover:underline">
            申请开通
          </Link>
        ) : (
          <button type="button" onClick={openLogin} className="text-sm text-[var(--accent)] hover:underline">
            登录 / 申请开通
          </button>
        ))}
        {state === 'taken' && <span className="text-sm text-[var(--muted)]">已被其他合作公司使用</span>}
        {state !== 'loading' && !reviewing && <PullButton code={code} refs={refs} />}
      </div>

      {open && (
        state === 'open' && script ? (
          <ScriptBody script={script} code={code} />
        ) : reviewing ? (
          <p className="mt-4 text-sm text-[var(--muted)]">这条还没有稿子。</p>
        ) : state === 'taken' ? (
          <TakenNote />
        ) : (
          <div className="mt-2"><ScriptGate slug={slug} code={code} /></div>
        )
      )}
    </section>
  );
}
