'use client';

import { useEffect, useState } from 'react';
import { changeCount, diffLines } from '@/lib/studio/prompt-diff';

/**
 * 「这一版用的提示词」：就地改 → 再生成一次；满意了 → 存为我的提示词。
 * 就地改的只用于下一次生成，不会自动覆盖默认的那份。
 * 手机上是可上拉的底部面板（收起只露一行），电脑上是右边常驻的一栏。
 */
type Props = {
  base: string;
  previous: string | null;
  sourceLabel: string;
  factRules: string;
  canGenerate: boolean;
  generating: boolean;
  onGenerate: (prompt: string) => void;
  onSave: (prompt: string, note: string) => void;
  layout: 'sheet' | 'column';
};

function Body({ base, previous, sourceLabel, factRules, canGenerate, generating, onGenerate, onSave }: Props) {
  const [draft, setDraft] = useState(base);
  const [note, setNote] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  useEffect(() => setDraft(base), [base]);

  const mine = changeCount(base, draft);
  const sincePrev = previous !== null ? changeCount(previous, base) : 0;
  return (
    <div>
      <p className="text-[13px] text-[var(--muted)]">
        {sourceLabel}
        {sincePrev > 0 && <span> · 比上一版改了 {sincePrev} 处</span>}
        {mine > 0 && <span className="font-bold text-[var(--accent)]"> · 你又改了 {mine} 处</span>}
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="写稿提示词"
        className="mt-2 h-64 w-full resize-y rounded-2xl border-[1.5px] border-[#8A9690] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[var(--accent)]"
      />
      {mine > 0 && (
        <button type="button" className="h-11 text-[14px] font-medium text-[var(--accent)]" onClick={() => setShowDiff((v) => !v)}>
          {showDiff ? '收起改动' : '看改了哪里'}
        </button>
      )}
      {showDiff && (
        <div className="max-h-48 overflow-auto rounded-xl bg-[var(--bg)] p-2 font-mono text-[12px] leading-relaxed">
          {diffLines(base, draft)
            .filter((l) => l.kind !== 'same')
            .map((l, i) => (
              <div key={i} className={l.kind === 'add' ? 'bg-[var(--accent-tint)]' : 'bg-[#FBE9E7] line-through'}>
                {l.kind === 'add' ? '+ ' : '− '}
                {l.text}
              </div>
            ))}
        </div>
      )}
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          disabled={!canGenerate || generating}
          onClick={() => onGenerate(draft)}
          className="h-14 flex-1 rounded-2xl bg-[var(--accent)] text-[17px] font-bold text-white disabled:opacity-40"
        >
          {generating ? '生成中…' : '再生成一次'}
        </button>
      </div>
      <details className="mt-3">
        <summary className="flex h-11 cursor-pointer items-center text-[15px] font-medium text-[var(--accent)]">存为我的提示词…</summary>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="版本说明：这版改了什么、为什么（选填）"
          className="h-14 w-full rounded-2xl border-[1.5px] border-[#8A9690] bg-white px-4 text-[15px] outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          onClick={() => onSave(draft, note)}
          className="mt-2 h-14 w-full rounded-2xl border-[1.5px] border-[var(--accent)] text-[17px] font-bold text-[var(--accent)]"
        >
          存为我的提示词
        </button>
        <p className="mt-1 text-[13px] text-[var(--muted)]">存了以后，这家公司以后生成都用这份；旧的留在历史里。</p>
      </details>
      <details className="mt-1">
        <summary className="flex h-11 cursor-pointer items-center text-[13px] text-[var(--muted)]">系统固定规则（不可改）</summary>
        <pre className="whitespace-pre-wrap rounded-xl bg-[var(--bg)] p-3 text-[12px] leading-relaxed text-[var(--muted)]">{factRules}</pre>
      </details>
    </div>
  );
}

export default function PromptPanel(props: Props) {
  const [open, setOpen] = useState(false);
  if (props.layout === 'column') {
    return (
      <aside className="rounded-2xl bg-[var(--bg-raised)] p-4">
        <h3 className="mb-1 text-[16px] font-bold">提示词</h3>
        <Body {...props} />
      </aside>
    );
  }
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-[#121815]/50" onClick={() => setOpen(false)} />}
      <section
        className={`fixed inset-x-0 z-40 rounded-t-3xl bg-[var(--bg-raised)] px-5 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] ${
          open ? 'bottom-0 max-h-[85dvh] overflow-y-auto' : ''
        }`}
        // 收起时贴在底部标签栏上面(标签栏高 52 + 安全区)
        style={
          open
            ? { paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }
            : { bottom: 'calc(max(env(safe-area-inset-bottom), 10px) + 52px)' }
        }
      >
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full flex-col items-center pt-2" aria-expanded={open}>
          <span className="h-[5px] w-9 rounded-full bg-[var(--line)]" />
          <span className="flex h-12 w-full items-center justify-between text-[15px] font-bold">
            这一版用的提示词
            <span className="text-[13px] font-medium text-[var(--accent)]">{open ? '收起' : '展开改'}</span>
          </span>
        </button>
        {/* 点了再生成就收起面板，让你看着稿子一个字一个字写出来 */}
        {open && (
          <Body
            {...props}
            onGenerate={(p) => {
              setOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              props.onGenerate(p);
            }}
          />
        )}
      </section>
    </>
  );
}
