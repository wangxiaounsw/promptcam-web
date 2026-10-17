'use client';

import type { Checks } from '@/lib/studio/checks';
import { highlight } from '@/lib/studio/highlight';

/**
 * 只读正文 + 上色：黄 = 在文章里没找到依据，请自己确认；红 = 文章里没有，要找 Fordexa 补调研。
 * 顶上一行说明这是辅助提示，不保证找全。
 */
export default function CheckedBody({
  body,
  checks,
  checking,
  onRetry,
}: {
  body: string;
  checks: Checks | null;
  checking?: boolean;
  onRetry?: () => void;
}) {
  const { segments, unplaced } = highlight(body, checks);
  const flagged = segments.some((s) => s.kind !== 'plain') || unplaced.length > 0;

  return (
    <div>
      {checks && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
          {checking ? (
            <span className="font-medium text-[var(--accent)]">核对中…</span>
          ) : checks.claimsFailed ? (
            <>
              <span className="font-medium text-[#7A5A00]">逐句复核没跑成，下面只核了数字</span>
              {onRetry && <button type="button" onClick={onRetry} className="h-11 font-bold text-[var(--accent)]">重试</button>}
            </>
          ) : (
            <span>{flagged ? '黄色 = 在文章里没找到依据，请自己确认。这是辅助提示，不保证找全。' : '核对过：数字和说法都在文章里找到了依据。'}</span>
          )}
          {checks.truncated && <span>（文章过长，后半段没参与核对）</span>}
        </div>
      )}
      <div className="whitespace-pre-wrap text-[17px] leading-[1.8]">
        {segments.map((s, i) =>
          s.kind === 'plain' ? (
            <span key={i}>{s.text}</span>
          ) : (
            <mark key={i} className={s.kind === 'research' ? 'rounded bg-[#FBE9E7] px-0.5 text-[var(--record)]' : 'rounded bg-[#FFF0B3] px-0.5 text-inherit'}>
              {s.text}
            </mark>
          ),
        )}
      </div>
      {unplaced.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#FFF8DD] p-3 text-[14px] leading-relaxed">
          <p className="font-bold text-[#7A5A00]">另有 {unplaced.length} 处没在文章里找到依据</p>
          {unplaced.map((c, i) => (
            <p key={i} className="mt-1.5">「{c.sentence}」<span className="text-[var(--muted)]">{c.missing}</span></p>
          ))}
        </div>
      )}
      {checks?.claims?.some((c) => c.missing) && (
        <details className="mt-3 text-[14px] text-[var(--muted)]">
          <summary className="flex h-11 cursor-pointer items-center font-medium text-[var(--accent)]">每处缺什么</summary>
          {checks.claims.map((c, i) => (
            <p key={i} className="mt-1">「{c.sentence}」— {c.missing}</p>
          ))}
        </details>
      )}
    </div>
  );
}
