'use client';

import Link from 'next/link';
import { useState } from 'react';
import { pendingCount } from '@/lib/studio/checks';
import { dayLabel, daysBetween, groupWeek, shiftWeek, weekLabel, weekOf } from '@/lib/studio/week';
import type { StudioScript } from './api';
import { PlayButton, Pill } from './ui';
import type { ScriptPatch } from './useScripts';

/**
 * 口播库首页，照 App 首页：「本周要录」大卡片（最该录的一条，过期优先）
 * + 按天分组的列表 + 未排期。每行右边一个试听键，不点进去也能听。
 */
type Props = {
  scripts: StudioScript[];
  today: string;
  selectedId?: string | null;
  onOpen?: (id: string) => void;
  onPatch: (id: string, change: ScriptPatch) => void;
};

function Flags({ s }: { s: StudioScript }) {
  const pending = pendingCount(s.checks);
  return (
    <>
      {pending > 0 && <Pill tone="yellow">待核 {pending}</Pill>}
      {s.research > 0 && <Pill tone="red">待补调研</Pill>}
    </>
  );
}

/** 手机上跳到稿子页；电脑上（传了 onOpen）只切换右栏 */
function OpenLink({ id, onOpen, className, children }: { id: string; onOpen?: (id: string) => void; className: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/studio/s/${id}`}
      className={className}
      onClick={(e) => {
        if (onOpen) {
          e.preventDefault();
          onOpen(id);
        }
      }}
    >
      {children}
    </Link>
  );
}

function Row({ s, props, extra }: { s: StudioScript; props: Props; extra?: React.ReactNode }) {
  const done = s.status === 'recorded';
  const selected = props.selectedId === s.id;
  return (
    <div
      className={`flex min-h-14 items-center gap-2 border-b border-[var(--row-line)] pr-2.5 last:border-b-0 ${
        selected ? 'bg-[var(--accent-tint)]' : ''
      } ${done ? 'opacity-50' : ''}`}
    >
      <OpenLink id={s.id} onOpen={props.onOpen} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-1.5 pl-4">
        <span className={`min-w-0 flex-1 truncate text-base font-medium ${done ? 'line-through' : ''}`}>{s.title}</span>
        <Flags s={s} />
      </OpenLink>
      {extra}
      <PlayButton scriptId={s.id} />
    </div>
  );
}

function Group({ label, red, children }: { label: string; red?: boolean; children: React.ReactNode }) {
  return (
    <>
      <div className={`flex h-10 items-center px-1 text-[13px] font-bold ${red ? 'text-[var(--record)]' : 'text-[var(--muted)]'}`}>{label}</div>
      <div className="overflow-hidden rounded-2xl bg-[var(--bg-raised)]">{children}</div>
    </>
  );
}

function DatePick({ onPick }: { onPick: (day: string) => void }) {
  return (
    <label className="relative flex h-11 shrink-0 items-center px-2 text-[15px] font-medium text-[var(--accent)]">
      排到…
      <input type="date" aria-label="选录完的日期" className="absolute inset-0 opacity-0" onChange={(e) => e.target.value && onPick(e.target.value)} />
    </label>
  );
}

export default function WeekView(props: Props) {
  const { scripts, today, onPatch } = props;
  const [weekStart, setWeekStart] = useState(weekOf(today).start);
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const g = groupWeek(scripts, today, weekStart);
  const left = scripts.filter((s) => s.status === 'ready').length;
  const days = Object.entries(g.days).filter(([, list]) => list.length);
  const thisWeek = days.flatMap(([, list]) => list).filter((s) => s.status === 'ready').length + g.overdue.length;
  const next = g.next;

  return (
    <div>
      <div className="flex h-11 items-center justify-between">
        <h1 className="text-[22px] font-bold">本周要录</h1>
        <div className="flex">
          <button type="button" aria-label="上一周" className="h-11 w-11 text-xl text-[var(--accent)]" onClick={() => setWeekStart(weekOf(shiftWeek(weekStart, -1)).start)}>‹</button>
          <button type="button" aria-label="下一周" className="h-11 w-11 text-xl text-[var(--accent)]" onClick={() => setWeekStart(weekOf(shiftWeek(weekStart, 1)).start)}>›</button>
        </div>
      </div>
      <p className="text-sm text-[var(--muted)]">
        {weekLabel(weekStart)} · 这周 {thisWeek} 条 · 待录共 {left} 条
        {weekStart !== weekOf(today).start && (
          <button type="button" className="ml-2 font-medium text-[var(--accent)]" onClick={() => setWeekStart(weekOf(today).start)}>回到本周</button>
        )}
      </p>

      {next && (
        <section className="mt-4 rounded-[20px] bg-[var(--bg-raised)] px-5 pb-2 pt-5">
          <div className="flex items-center justify-between gap-2">
            {next.record_by && next.record_by < today ? (
              <span className="text-[13px] font-bold text-[var(--record)]">已过期 {daysBetween(next.record_by, today)} 天</span>
            ) : (
              <span className="text-[13px] font-bold text-[var(--accent)]">{next.record_by ? dayLabel(next.record_by, today) : ''}</span>
            )}
            <span className="flex gap-1.5"><Flags s={next} /></span>
          </div>
          <h2 className="mt-2 text-[22px] font-bold leading-snug">{next.title}</h2>
          <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-[var(--muted)]">{next.body}</p>
          <div className="mt-4 flex gap-2.5">
            <PlayButton scriptId={next.id} size="wide" />
            <button type="button" onClick={() => onPatch(next.id, { status: 'recorded' })} className="h-14 flex-1 rounded-2xl bg-[var(--accent)] text-[17px] font-bold text-white">
              ✓ 已录
            </button>
          </div>
          <OpenLink id={next.id} onOpen={props.onOpen} className="flex h-11 items-center justify-center text-[15px] font-medium text-[var(--accent)]">
            改稿 · 改日期
          </OpenLink>
        </section>
      )}

      {g.overdue.length > 0 && (
        <Group label="已过期" red>
          {g.overdue.map((s) => <Row key={s.id} s={s} props={props} />)}
        </Group>
      )}
      {days.map(([day, list]) => (
        <Group key={day} label={dayLabel(day, today)}>
          {list.map((s) => <Row key={s.id} s={s} props={props} />)}
        </Group>
      ))}
      {!next && !days.length && !g.overdue.length && (
        <p className="mt-8 text-center text-[15px] text-[var(--muted)]">这周没有排稿子。去灵感库拉几条，或者给下面未排期的选个日期。</p>
      )}

      <div className="mt-3 overflow-hidden rounded-2xl bg-[var(--bg-raised)]">
        <button type="button" onClick={() => setShowUnscheduled((v) => !v)} className="flex h-14 w-full items-center justify-between px-4 text-base font-medium">
          未排期
          <span className="text-[13px] text-[var(--muted)]">{g.unscheduled.length} 条 {showUnscheduled ? '▾' : '›'}</span>
        </button>
        {showUnscheduled &&
          g.unscheduled.map((s) => (
            <div key={s.id} className="border-t border-[var(--row-line)]">
              <Row s={s} props={props} extra={<DatePick onPick={(day) => onPatch(s.id, { record_by: day })} />} />
            </div>
          ))}
      </div>
    </div>
  );
}
