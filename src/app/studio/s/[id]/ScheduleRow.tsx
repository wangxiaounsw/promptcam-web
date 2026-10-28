'use client';

import { useEffect, useRef, useState } from 'react';
import { errorText, send, studioFetch, type StudioScript } from '../../api';
import StageTag from '../../StageTag';
import { showToast } from '../../ui';

/** 发布日期（改的是日历上的那一条，走 /api/studio/posts/<id>）+ 只读进度 + 去日历看 */
type ServerPatch = Pick<StudioScript, 'publish_on' | 'record_by' | 'stage'>;

export default function ScheduleRow({ script, industry, onApply, onChanged }: { script: StudioScript; industry: string | null; onApply: (p: ServerPatch) => void; onChanged?: () => void }) {
  const [day, setDay] = useState(script.publish_on ?? '');
  const [saving, setSaving] = useState(false);
  const inflight = useRef(false); // 回车后输入框被禁用会再触发 blur，别重复提交
  useEffect(() => setDay(script.publish_on ?? ''), [script.publish_on, script.id]);

  // 只在失焦或按回车时提交（不是每次 onChange：手输日期时中间值会连发请求）
  const commit = async (next: string) => {
    if (inflight.current || next === (script.publish_on ?? '')) return;
    inflight.current = true;
    const before = script.publish_on ?? '';
    setSaving(true);
    try {
      const { post } = await studioFetch<{ post: { publishOn: string | null; recordBy: string | null; stage: StudioScript['stage'] } }>(
        `/api/studio/posts/${script.id}`,
        send('PATCH', { edit: { publish_on: next || null } }),
      );
      onApply({ publish_on: post.publishOn, record_by: post.recordBy, stage: post.stage });
      onChanged?.();
    } catch (e) {
      setDay(before);
      showToast(errorText(e));
    } finally {
      inflight.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <label className="flex h-11 items-center gap-1.5 text-[15px] text-[var(--muted)]">
        发布日期
        <input
          type="date"
          value={day}
          disabled={saving || script.stage === 'published'}
          onChange={(e) => setDay(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
          className="h-11 rounded-xl border-[1.5px] border-[#8A9690] bg-white px-2 text-[15px] text-[var(--ink)] disabled:opacity-50"
        />
      </label>
      <StageTag stage={script.stage} industry={industry} />
      <a href={`/studio/calendar?post=${script.id}`} className="flex h-11 items-center text-[15px] font-medium text-[var(--accent)]">
        在日历里看 ↗
      </a>
    </>
  );
}
