'use client';

import { STAGES, stageLabel, stagesFor, type Stage } from '@/lib/studio/posts';
import type { CalendarPost } from '@/lib/studio/posts-map';

/** 进度条：当前一步高亮；双方都能点某一步直接设成那一步（已发布只能走「已发布 · 贴链接」） */
export default function StageBar({
  post, industry, busy, onPick,
}: { post: CalendarPost; industry: string | null; busy: boolean; onPick: (s: Stage) => void }) {
  const published = post.stage === 'published';
  const now = STAGES.indexOf(post.stage);
  return (
    <ol className="flex gap-1" aria-label="进度">
      {stagesFor(post.kind).map((s) => {
        const current = s === post.stage;
        const passed = STAGES.indexOf(s) < now;
        const clickable = !busy && !published && s !== 'published' && !current;
        const label = stageLabel(s, industry);
        const cls = `flex h-11 w-full items-center justify-center rounded-xl px-1 text-[13px] font-medium ${
          current ? 'bg-[var(--accent)] text-white' : passed ? 'bg-[var(--accent-tint)] text-[var(--accent)]' : 'border border-[var(--line)] text-[var(--muted)]'
        }`;
        return (
          <li key={s} className="min-w-0 flex-1">
            {clickable ? (
              <button type="button" onClick={() => onPick(s)} className={cls}>{label}</button>
            ) : (
              <span aria-current={current ? 'step' : undefined} className={cls}>{label}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
