'use client';

import { isoWeekday, monthGrid, monthOf } from '@/lib/studio/calendar';
import type { CalendarData } from '@/lib/studio/posts-map';
import { dayLabel } from '@/lib/studio/week';
import PostChip from './PostChip';

/** 手机上按日期往下排：只列本月有条目的日子和固定日 */
export default function AgendaList({ data, onOpen }: { data: CalendarData; onOpen: (id: string) => void }) {
  const { today, month, weekdays, posts } = data;
  const days = monthGrid(month).flat().filter((d) => monthOf(d) === month);
  const rows = days
    .map((day) => ({ day, list: posts.filter((p) => p.publishOn === day), fixed: weekdays.includes(isoWeekday(day)) }))
    .filter((r) => r.list.length > 0 || r.fixed);

  if (rows.length === 0) return <p className="mt-8 text-center text-[15px] text-[var(--muted)]">这个月还没有安排。</p>;
  return (
    <div className="mt-3 space-y-2">
      {rows.map(({ day, list, fixed }) => (
        <section
          key={day}
          style={fixed ? { border: '2px solid #FEC03A', background: '#FFF8E6' } : undefined}
          className={`rounded-2xl p-3 ${fixed ? '' : 'bg-[var(--bg-raised)]'}`}
        >
          <h3 className={`mb-1.5 text-[13px] font-bold ${day === today ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>{dayLabel(day, today)}</h3>
          {list.length === 0 ? (
            <p className="text-[14px] text-[var(--muted)]">空着</p>
          ) : (
            <div className="space-y-1.5">
              {list.map((p) => (
                <PostChip key={p.id} post={p} today={today} onOpen={onOpen} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
