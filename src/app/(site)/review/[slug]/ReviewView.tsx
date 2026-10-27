'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import { renderArticle } from '@/lib/article';
import type { ReviewIdea, ReviewStatus } from '@/lib/content';
import { openLogin } from '@/components/LoginDialog';
import ScriptSection from '../../ideas/[slug]/ScriptSection';
import { IdeaHeader, RefList } from '../../ideas/[slug]/IdeaParts';

type State = 'loading' | 'anon' | 'forbidden' | 'missing' | 'error' | 'ok';

/** 打开着就每隔几秒取一次:Claude 改了稿子或重做了试听,这边自己换上,不用手动刷新 */
const POLL_MS = 4000;

const STATUS: Record<ReviewStatus, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'bg-amber-100 text-amber-800' },
  published: { label: '已发布', cls: 'bg-emerald-100 text-emerald-800' },
  offline: { label: '已下线', cls: 'bg-[var(--row-line)] text-[var(--muted)]' },
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  const s = STATUS[status];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>;
}

/**
 * 审稿页:和公开的文章页同一套版式,区别只在 ——
 * 没发布的口播也在,稿子默认展开带试听,顶上一条审稿栏。
 * 改稿和发布都是跟 Claude 说,这一页只负责看和听。
 */
export default function ReviewView({ slug }: { slug: string }) {
  const [state, setState] = useState<State>('loading');
  const [idea, setIdea] = useState<ReviewIdea | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const last = useRef('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    // 前一次还没回来又发了一次:只认最后发出的那次,慢的旧结果不许盖掉新的
    const mine = ++seq.current;
    try {
      const sb = await browserSupabase();
      const { data } = (await sb?.auth.getSession()) ?? { data: null };
      const token = data?.session?.access_token;
      if (!token) return setState('anon');
      const res = await fetch(`/api/admin/review?key=${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 403) return setState('forbidden');
      if (res.status === 404) return setState('missing');
      if (!res.ok) return setState('error');
      const text = await res.text();
      if (mine !== seq.current) return;
      if (text !== last.current) {
        // 第一次不算「更新」,之后内容变了才亮一下
        if (last.current) setUpdatedAt(new Date());
        last.current = text;
        setIdea((JSON.parse(text) as { idea: ReviewIdea }).idea);
      }
      setState('ok');
    } catch {
      setState((s) => (s === 'ok' ? s : 'error'));
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const articleHtml = useMemo(() => (idea?.article ? renderArticle(idea.article) : null), [idea?.article]);

  if (state !== 'ok' || !idea) {
    return (
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-14">
        {state === 'loading' && <div className="h-40 animate-pulse rounded-2xl bg-[var(--row-line)]" />}
        {state === 'anon' && (
          <p className="text-[var(--muted)]">
            审稿页要先
            <button type="button" onClick={openLogin} className="mx-1 text-[var(--accent)] hover:underline">登录</button>
            管理员账号。
          </p>
        )}
        {state === 'forbidden' && <p className="text-[var(--muted)]">这个账号不是管理员，看不了审稿页。</p>}
        {state === 'missing' && <p className="text-[var(--muted)]">没找到 {slug}。</p>}
        {state === 'error' && <p className="text-[var(--muted)]">取不到内容，过几秒会自动再试。</p>}
      </main>
    );
  }

  const drafts = idea.children.filter((c) => c.status === 'draft').length;

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-14">
      {/* 贴在站点顶栏(h-14 / sm:h-16)下面,往下滚也看得到 */}
      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-2.5 text-sm text-amber-900 shadow-sm backdrop-blur sm:top-[72px]">
        <span className="font-semibold">审稿</span>
        <span>文章 <StatusBadge status={idea.status} /></span>
        <span>口播 {idea.children.length} 条{drafts ? `（${drafts} 条草稿）` : ''}</span>
        {idea.children.length > 0 && (
          <a href="#scripts" className="font-medium text-amber-900 underline underline-offset-2">跳到口播 ↓</a>
        )}
        <span className="text-amber-800/80">要改哪里直接跟 Claude 说；说「发布」就上线并更新 Notion</span>
        {updatedAt && (
          <span className="ml-auto text-xs text-amber-800/80">
            {updatedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 已更新
          </span>
        )}
      </div>

      {idea.status === 'published' && (
        <Link
          href={`/ideas/${idea.slug}`}
          className="mt-6 inline-block text-sm text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          看公开页 →
        </Link>
      )}

      <IdeaHeader idea={idea} />

      {articleHtml && <article className="article mt-8" dangerouslySetInnerHTML={{ __html: articleHtml }} />}

      {idea.children.length > 0 && (
        <section id="scripts" className="mt-12 scroll-mt-40">
          <h2 className="font-display mb-4 text-sm font-semibold tracking-wide text-[var(--muted)]">
            这篇出的口播 · {idea.children.length} 条
          </h2>
          <div className="space-y-3">
            {idea.children.map((k) => (
              <ScriptSection
                key={k.code}
                {...k}
                refs={idea.refs}
                preloaded={{ script: k.script ?? null, audioUrl: k.audioUrl ?? null }}
                badge={<StatusBadge status={k.status} />}
              />
            ))}
          </div>
        </section>
      )}

      <RefList refs={idea.refs} />
    </main>
  );
}
