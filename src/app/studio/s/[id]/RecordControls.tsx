'use client';

import { STAGES } from '@/lib/studio/posts';
import type { StudioScript } from '../../api';
import type { ScriptPatch } from '../../useScripts';

/**
 * 「要录完」日期 + 「标为已录」开关。只给要录的视频：图文两个都不显示；
 * 成片及以后的稿子进度由触发器管（拒绝改回待录），开关也藏起来，免得点了没用还显示错。
 */
export default function RecordControls({ script, onSave }: { script: StudioScript; onSave: (c: ScriptPatch) => void }) {
  if (script.kind === 'image') return null;
  const recorded = script.status === 'recorded';
  const locked = STAGES.indexOf(script.stage) >= STAGES.indexOf('cut');
  return (
    <>
      <label className="flex h-11 items-center gap-1.5 text-[15px] text-[var(--muted)]">
        要录完
        <input
          type="date"
          value={script.record_by ?? ''}
          onChange={(e) => onSave({ record_by: e.target.value || null })}
          className="h-11 rounded-xl border-[1.5px] border-[#8A9690] bg-white px-2 text-[15px] text-[var(--ink)]"
        />
      </label>
      {!locked && (
        <button
          type="button"
          onClick={() => onSave({ status: recorded ? 'ready' : 'recorded' })}
          className={`h-11 rounded-xl px-3 text-[15px] font-bold ${recorded ? 'bg-[var(--accent-tint)] text-[var(--accent)]' : 'border-[1.5px] border-[var(--accent)] text-[var(--accent)]'}`}
        >
          {recorded ? '✓ 已录（改回待录）' : '标为已录'}
        </button>
      )}
    </>
  );
}
