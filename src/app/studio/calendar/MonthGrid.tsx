'use client';

import { WEEKDAY_NAMES, isoWeekday, monthGrid, monthOf } from '@/lib/studio/calendar';
import { useState } from 'react';
import type { CalendarData } from '@/lib/studio/posts-map';
import PostChip from './PostChip';

type Props = {
  data: CalendarData;
  onOpen: (id: string) => void;
  /** 点空白格：「加一条」，日期预填为这一天 */
  onAddOnDay: (day: string) => void;
  /** 把一条拖到这一天上 */
  onDropOnDay: (id: string, day: string) => void;
};

/** 电脑上的完整月格，周一开头 */
export default function MonthGrid({ data, onOpen, onAddOnDay, onDropOnDay }: Props) {
  const { today, month, weekdays, posts } = data;
  const [overDay, setOverDay] = useState<string | null>(null);
  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-[var(--bg-raised)]">
      <div className="grid grid-cols-7 border-b border-[var(--row-line)] text-center text-[13px] text-[var(--muted)]">
        {WEEKDAY_NAMES.map((h) => (
          <div key={h} className="py-2">{h}</div>
        ))}
      </div>
      {monthGrid(month).map((row) => (
        <div key={row[0]} className="grid grid-cols-7">
          {row.map((day) => {
            const fixed = weekdays.includes(isoWeekday(day));
            const inMonth = monthOf(day) === month;
            const list = posts.filter((p) => p.publishOn === day);
            return (
              <div
                key={day}
                onClick={() => onAddOnDay(day)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverDay(day);
                }}
                onDragLeave={(e) => {
                  if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
                  setOverDay((d) => (d === day ? null : d));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverDay(null);
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) onDropOnDay(id, day);
                }}
                style={{
                  ...(fixed ? { border: '2px solid #FEC03A', background: '#FFF8E6' } : {}),
                  ...(overDay === day ? { outline: '2px dashed var(--accent)', outlineOffset: -2 } : {}),
                }}
                className={`min-h-[116px] cursor-pointer space-y-1 p-1.5 ${fixed ? '' : 'border-b border-r border-[var(--row-line)]'} ${inMonth ? '' : 'opacity-45'}`}
              >
                <div className={`text-[13px] ${day === today ? 'font-bold text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                  {Number(day.slice(8, 10))}
                </div>
                {list.map((p) => (
                  <PostChip key={p.id} post={p} today={today} onOpen={onOpen} />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
