'use client';

import { dueWarning, recordWarning } from '@/lib/studio/calendar';
import { toneOf } from '@/lib/studio/posts';
import type { CalendarPost } from '@/lib/studio/posts-map';

/** 进度颜色：草稿/精修中虚线灰，定稿黄，已录/成片浅绿，已发布紫 */
const TONE_STYLE = {
  todo: { border: '1.5px dashed #bbb', background: '#fafafa', color: 'var(--ink)' },
  final: { border: '1.5px solid #FDE7B0', background: '#FDE7B0', color: '#7a4d00' },
  made: { border: '1.5px solid #DDF3E4', background: '#DDF3E4', color: '#14532d' },
  done: { border: '1.5px solid #EDE4FA', background: '#EDE4FA', color: '#4c1d95' },
} as const;

/** 只写有的数：赞和藏都没有就不显示这一行 */
const statsLine = (likes: number | null, saves: number | null) =>
  [likes !== null ? `❤ ${likes}` : null, saves !== null ? `★ ${saves}` : null].filter(Boolean).join(' · ');

/** 格子里的一条，月历和手机列表共用 */
export default function PostChip({ post, today, onOpen }: { post: CalendarPost; today: string; onOpen: (id: string) => void }) {
  const tone = toneOf(post.stage);
  const warn = dueWarning(post, today);
  const record = recordWarning(post, today);
  const ep = post.episode !== null ? ` ${post.episode}${post.seriesTotal ? `/${post.seriesTotal}` : ''}` : '';
  const series = post.series ? `${post.series}${ep}` : null;
  return (
    // 用 div 而不是 button：Firefox 不会在可拖的 button 上触发 dragstart
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation(); // 不要冒泡成「点了空白格」
        onOpen(post.id);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        onOpen(post.id);
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={TONE_STYLE[tone]}
      className="relative block w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug"
    >
      {post.unread && <span aria-label="有新备注" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--record)]" />}
      <span className="flex flex-wrap items-center gap-1 pr-3 text-[12px] opacity-80">
        <span>{post.kind === 'video' ? '视频' : '图文'}</span>
        {series && <span>· {series}</span>}
        {post.isExtra && <span className="rounded px-1 font-medium" style={{ background: '#FDE2E1', color: '#991b1b' }}>热点</span>}
      </span>
      <span className="mt-0.5 block font-medium">{post.title || '（还没有标题）'}</span>
      {tone === 'done' && statsLine(post.likes, post.saves) && (
        <span className="mt-0.5 block text-[12px]">{statsLine(post.likes, post.saves)}</span>
      )}
      {record && <span className="mt-0.5 block text-[12px] font-bold text-[var(--record)]">该录了</span>}
      {warn && (
        <span className="mt-0.5 block text-[12px] font-bold text-[var(--record)]">
          {warn.kind === 'overdue' ? '过期未发' : `差 ${warn.days} 天`}
        </span>
      )}
    </div>
  );
}
