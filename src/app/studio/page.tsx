'use client';

import { useEffect, useState } from 'react';
import ScriptPanel from './s/[id]/ScriptPanel';
import { useIsDesktop, useScripts } from './useScripts';
import WeekView from './WeekView';

/**
 * 口播库。手机：本周列表，点进去是稿子页。
 * 电脑：左边列表、右边直接编辑，点行只切换右栏。
 */
export default function StudioHome() {
  const { scripts, today, industry, reload, patch } = useScripts();
  const desktop = useIsDesktop();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (desktop && !selected && scripts?.length) {
      const first = scripts.find((s) => s.status === 'ready') ?? scripts[0];
      setSelected(first.id);
    }
  }, [desktop, selected, scripts]);

  if (!scripts || !today) return <div className="mt-4 h-64 animate-pulse rounded-2xl bg-[var(--row-line)]" />;

  if (!desktop) return <WeekView scripts={scripts} today={today} industry={industry} onPatch={patch} />;

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-6">
      <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto pb-6 pr-1">
        <WeekView scripts={scripts} today={today} industry={industry} onPatch={patch} selectedId={selected} onOpen={setSelected} />
      </div>
      <div>{selected && <ScriptPanel id={selected} onChanged={reload} embedded />}</div>
    </div>
  );
}
