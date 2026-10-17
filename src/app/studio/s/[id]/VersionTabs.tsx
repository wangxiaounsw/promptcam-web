'use client';

import { pendingCount } from '@/lib/studio/checks';
import type { Version } from '../../api';

/** 「正文 · Fordexa 原版 · 第 1 版 · 第 2 版…」—— App 的三段切换样式，多了就横滑 */
export type Tab = 'body' | string; // 'body' 或版本 id

export function versionLabel(v: Version): string {
  return v.n === 0 ? 'Fordexa 原版' : `第 ${v.n} 版`;
}

export default function VersionTabs({
  versions,
  current,
  inUseId,
  onSelect,
}: {
  versions: Version[];
  current: Tab;
  inUseId: string | null;
  onSelect: (tab: Tab) => void;
}) {
  const tabs: { id: Tab; label: string; dot?: boolean }[] = [
    { id: 'body', label: '正文' },
    ...versions.map((v) => ({ id: v.id, label: versionLabel(v) + (v.id === inUseId ? ' · 在用' : ''), dot: pendingCount(v.checks) > 0 })),
  ];
  return (
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="版本">
      <div className="inline-flex min-w-full gap-0 rounded-xl bg-[#E1E6E3] p-[3px]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={current === t.id}
            onClick={() => onSelect(t.id)}
            className={`relative flex h-[38px] shrink-0 items-center whitespace-nowrap rounded-[9px] px-3.5 text-[15px] ${
              current === t.id ? 'bg-white font-bold text-[var(--ink)]' : 'font-medium text-[var(--muted)]'
            }`}
          >
            {t.label}
            {t.dot && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#E0A800]" aria-label="有待核" />}
          </button>
        ))}
      </div>
    </div>
  );
}
