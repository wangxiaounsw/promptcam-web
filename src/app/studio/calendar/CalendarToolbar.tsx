'use client';

import { useState } from 'react';
import type { CalendarData } from '@/lib/studio/posts-map';
import AddPostDialog from './AddPostDialog';
import SeriesDialog from './SeriesDialog';
import { OrgLeadDays, OrgWeekdays } from './WeekdayPicker';

export type AddState = { day: string } | null;

interface Props {
  data: CalendarData;
  add: AddState;
  setAdd: (s: AddState) => void;
  onDone: () => void;
  onMonth: (m: string) => void;
  onWeekdays: (w: number[]) => void;
  onLeadDays: (n: number) => void;
}

/** 工具栏：排一个系列、加一条、固定发布日、提前几天录完。管理员和公司成员都能用 */
export default function CalendarToolbar({ data, add, setAdd, onDone, onMonth, onWeekdays, onLeadDays }: Props) {
  const [series, setSeries] = useState(false);
  const btn = 'h-11 rounded-xl border border-[var(--row-line)] px-4 text-[15px] font-medium';
  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={() => setSeries(true)}>排一个系列</button>
        <button type="button" className={btn} onClick={() => setAdd({ day: '' })}>加一条</button>
        <OrgWeekdays weekdays={data.weekdays} onSaved={onWeekdays} />
        <OrgLeadDays leadDays={data.leadDays} onSaved={onLeadDays} />
      </div>
      {series && (
        <SeriesDialog
          today={data.today}
          seriesNames={data.seriesNames}
          defaultWeekdays={data.weekdays}
          onClose={() => setSeries(false)}
          onDone={(m) => {
            onMonth(m);
            onDone();
          }}
        />
      )}
      {add && <AddPostDialog
          initialDay={add.day}
          onClose={() => setAdd(null)}
          onDone={(m) => {
            if (m) onMonth(m);
            onDone();
          }}
        />}
    </>
  );
}
