'use client';

import { useState } from 'react';
import type { ReviewFact, ReviewFacts } from '@/lib/review-facts';

/**
 * 审稿页的「事实核对」:稿子里每个数字靠的那条事实、官网原句标黄截图、出处链接。
 * 截不到图的写明原因(表格值、PDF、页面打不开),点链接自己核。
 */
export default function FactsSection({ data }: { data: ReviewFacts }) {
  const shot = data.facts.filter((f) => f.shot.ok).length;
  return (
    <section id="facts" className="mt-12 scroll-mt-40">
      <h2 className="font-display mb-1 text-sm font-semibold tracking-wide text-[var(--muted)]">
        事实核对 · {data.facts.length} 条（{shot} 条有官网截图）
      </h2>
      <p className="mb-4 text-xs text-[var(--muted)]">
        调研的事实表，稿子里的数字只能来自这里。有问题的条目直接跟 Claude 说第几条。
      </p>

      {data.warnings.length > 0 && (
        <div className="mb-4 space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.warnings.map((w) => (
            <p key={w}>⚠️ {w}</p>
          ))}
        </div>
      )}

      <ol className="space-y-3">
        {data.facts.map((f) => (
          <FactItem key={f.n} fact={f} />
        ))}
      </ol>

      {data.missing.length > 0 && (
        <details className="mt-4 rounded-xl border border-[var(--row-line)] px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">【缺】没查到官方依据的 {data.missing.length} 条</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
            {data.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function host(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}

function FactItem({ fact: f }: { fact: ReviewFact }) {
  const [big, setBig] = useState(false);
  return (
    <li className="rounded-xl border border-[var(--row-line)] px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 font-mono text-xs text-[var(--muted)]">{f.n}</span>
        <p className="text-[15px] leading-relaxed">
          {f.key && <span className="mr-1.5 rounded bg-[var(--ink)] px-1.5 py-0.5 align-middle text-[10px] font-semibold text-white">关键</span>}
          {f.claim}
        </p>
      </div>

      {f.shot.ok && f.shotUrl ? (
        <button
          type="button"
          onClick={() => setBig((v) => !v)}
          className={`mt-3 block w-full overflow-hidden rounded-lg border border-[var(--row-line)] text-left ${big ? '' : 'max-h-64'}`}
          aria-label={big ? '收起截图' : '展开截图'}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 签名链接,会过期,不走 next/image 缓存 */}
          <img src={f.shotUrl} alt={`第 ${f.n} 条的官网原文截图`} className="w-full" loading="lazy" />
        </button>
      ) : (
        <p className="mt-2 text-xs text-amber-800">没截图：{f.shot.ok ? '截图链接过期，刷新一下' : f.shot.reason}</p>
      )}

      <details className="mt-2 text-xs text-[var(--muted)]">
        <summary className="cursor-pointer">英文原句和出处</summary>
        <p className="mt-1.5 whitespace-pre-wrap">{f.quote || '（没有原句）'}</p>
        <p className="mt-1.5">{f.source}</p>
        {f.published && <p className="mt-1">发布 / 期间：{f.published}</p>}
      </details>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {f.urls.map((u) => (
          <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--accent)] hover:underline">
            {host(u)} ↗
          </a>
        ))}
        {f.urlsFrom && <span className="text-[var(--muted)]">（链接沿用第 {f.urlsFrom} 条）</span>}
      </div>
    </li>
  );
}
