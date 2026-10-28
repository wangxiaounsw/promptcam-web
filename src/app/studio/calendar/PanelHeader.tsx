'use client';

import { WEEKDAY_NAMES, isoWeekday } from '@/lib/studio/calendar';
import { POST_LIMITS } from '@/lib/studio/posts';
import type { CalendarPost } from '@/lib/studio/posts-map';
import { showToast } from '../ui';
import Blurred from './Blurred';
import type { SavePost } from './usePostPatch';

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

function headline(p: CalendarPost): string {
  const day = p.publishOn ? `发布 ${md(p.publishOn)} 周${WEEKDAY_NAMES[isoWeekday(p.publishOn) - 1]}` : '未排期';
  const rec = p.kind === 'video' && p.recordBy ? `要录完 ${md(p.recordBy)}` : null;
  const ep = p.episode !== null ? ` ${p.episode}${p.seriesTotal ? `/${p.seriesTotal}` : ''}` : '';
  return [day, rec, p.kind === 'video' ? '视频' : '图文', p.series ? `${p.series}${ep}` : null].filter(Boolean).join(' · ');
}

/** 面板顶部：进度一行字、标题、复制链接、关闭。双方都能改标题、视频/图文、热点（系列和集数只读） */
export default function PanelHeader({
  post, overdue, orgId, busy, save, onClose,
}: {
  post: CalendarPost; overdue: boolean; orgId: string | null; busy: boolean; save: SavePost; onClose: () => void;
}) {
  const copyLink = async () => {
    const org = orgId ? `org=${encodeURIComponent(orgId)}&` : '';
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/studio/calendar?${org}post=${post.id}`);
      showToast('已复制');
    } catch {
      showToast('复制失败，浏览器没给权限');
    }
  };
  return (
    <header className="border-b border-[var(--line)] px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--muted)]">
            {headline(post)}
            {post.isExtra && <span className="rounded px-1 font-medium" style={{ background: '#FDE2E1', color: '#991b1b' }}>热点</span>}
            {overdue && <span className="font-bold text-[var(--record)]">过期未发</span>}
          </p>
          <Blurred
            placeholder="标题"
            maxLength={POST_LIMITS.title}
            value={post.title}
            onSave={(v) => save({ edit: { title: v } })}
            className="mt-1 h-11 w-full rounded-xl border border-transparent bg-transparent px-1 text-[18px] font-bold hover:border-[var(--line)]"
          />
        </div>
        <button type="button" onClick={copyLink} className="h-11 shrink-0 px-2 text-[14px] font-medium text-[var(--accent)]">复制链接</button>
        <button type="button" aria-label="关闭" onClick={onClose} className="h-11 w-11 shrink-0 text-xl">×</button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {(['video', 'image'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={post.kind === k}
            disabled={busy}
            onClick={() => post.kind !== k && save({ edit: { kind: k } })}
            className={`h-11 rounded-xl px-4 text-[15px] font-medium disabled:opacity-60 ${post.kind === k ? 'bg-[var(--accent)] text-white' : 'border border-[var(--row-line)] text-[var(--muted)]'}`}
          >
            {k === 'video' ? '视频' : '图文'}
          </button>
        ))}
        <label className="flex h-11 items-center gap-2 text-[15px]">
          <input type="checkbox" checked={post.isExtra} disabled={busy} onChange={(e) => save({ edit: { is_extra: e.target.checked } })} /> 热点
        </label>
      </div>
    </header>
  );
}
