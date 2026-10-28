'use client';

import { useEffect, useRef, useState } from 'react';
import { monthsOfYear, shiftYearOf } from '@/lib/studio/calendar-cache';

interface Props {
  /** 现在显示的月份 'YYYY-MM' */
  month: string;
  /** 今天所在的月份（描边） */
  thisMonth: string;
  onPick: (m: string) => void;
}

/** 点标题弹出的月份选择：一行年份 ‹ ›，下面 4×3 的 1月…12月。Esc / 点外面关闭 */
export default function MonthPicker({ month, thisMonth, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const title = `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月`;
  const toggle = () => {
    setYear(Number(month.slice(0, 4))); // 每次打开从正在看的那一年开始
    setOpen((v) => !v);
  };
  const arrow = 'h-11 w-11 text-xl text-[var(--accent)]';
  return (
    <div ref={box} className="relative">
      <div className="flex items-center">
        <h1 className="text-[22px] font-bold" onClick={toggle}>{title}</h1>
        <button type="button" aria-label="选月份" aria-haspopup="dialog" aria-expanded={open} className="h-11 w-11 text-[14px] text-[var(--muted)]" onClick={toggle}>▾</button>
      </div>
      {open && (
        <div role="dialog" aria-label="选月份" className="absolute left-0 top-12 z-30 w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl border border-[var(--row-line)] bg-[var(--bg-raised)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
          <div className="flex items-center justify-between">
            <button type="button" aria-label="上一年" className={arrow} onClick={() => setYear((y) => shiftYearOf(y, -1))}>‹</button>
            <span className="text-[17px] font-bold">{year} 年</span>
            <button type="button" aria-label="下一年" className={arrow} onClick={() => setYear((y) => shiftYearOf(y, 1))}>›</button>
          </div>
          <div className="mt-1 grid grid-cols-4 gap-2">
            {monthsOfYear(year).map((m, i) => {
              const on = m === month;
              const now = m === thisMonth;
              return (
                <button
                  key={m}
                  type="button"
                  aria-current={on ? 'date' : undefined}
                  className={`h-11 rounded-xl text-[15px] font-medium ${
                    on ? 'bg-[var(--accent)] font-bold text-white' : now ? 'border border-[var(--accent)] text-[var(--accent)]' : 'text-[var(--ink)]'
                  }`}
                  onClick={() => {
                    setOpen(false);
                    onPick(m);
                  }}
                >
                  {i + 1}月
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
