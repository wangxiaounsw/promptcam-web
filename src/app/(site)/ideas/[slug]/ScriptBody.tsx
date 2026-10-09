import type { ReactNode } from 'react';
import CopyButton from './CopyButton';

/**
 * 口播稿正文的排版。付费的由 ScriptGate 在浏览器里取到后渲染,
 * 免费样稿由页面直接服务端渲染 —— 同一个组件,长得一样。
 */
export default function ScriptBody({
  script,
  code,
  badge,
  children,
}: {
  script: string;
  code: string;
  badge?: string;
  children?: ReactNode;
}) {
  // 按空行分段显示 —— 整块灰字读起来像合同,念的人需要换气的地方
  const paras = script.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chars = script.replace(/\s/g, '').length;
  const secs = Math.max(10, Math.ceil(chars / 4 / 10) * 10);
  const length =
    secs < 60
      ? `约 ${secs} 秒`
      : secs % 60 === 0
        ? `约 ${Math.floor(secs / 60)} 分钟`
        : `约 ${Math.floor(secs / 60)} 分 ${secs % 60} 秒`;

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-sm font-semibold tracking-wide text-[var(--muted)]">
          口播稿 · {code}
        </h2>
        {badge && (
          <span className="rounded-full bg-[var(--accent-tint)] px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
            {badge}
          </span>
        )}
        <span className="text-xs text-[var(--muted)]">
          {chars} 字 · 念完{length}
        </span>
        <div className="flex-1" />
        <CopyButton text={script} />
      </div>
      <div className="rounded-2xl bg-[var(--bg-raised)] p-7">
        {paras.map((p, i) => (
          <p
            key={i}
            className="whitespace-pre-wrap text-[17px] leading-[1.95] text-[var(--ink)]"
            style={{ marginTop: i === 0 ? 0 : '1.25rem' }}
          >
            {p}
          </p>
        ))}
      </div>
      {children && (
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{children}</p>
      )}
    </section>
  );
}
