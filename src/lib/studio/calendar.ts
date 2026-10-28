/**
 * 发布日历的日期逻辑。纯函数，服务端、浏览器、测试共用，不引入任何鉴权或 server-only 的东西。
 * 日期一律是墨尔本的 'YYYY-MM-DD' 字符串，加减走 week.ts 的 addDays（落在 UTC 正午，不受夏令时影响）。
 */
import type { PostKind, Stage } from './posts.ts';
import { addDays, daysBetween, weekOf, type DayKey } from './week.ts';

export type Month = string; // 'YYYY-MM'

/** 周一到周日的单字，下标 = isoWeekday - 1 */
export const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** 提前几天还没做好就提醒 */
export const SHORT_DAYS = 3;
/** 铺开系列最多往后找多久（天） */
const SPREAD_LIMIT_DAYS = 366 * 3;

export function monthOf(day: DayKey): Month {
  return day.slice(0, 7);
}

export function shiftMonth(month: Month, n: number): Month {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

/** 1 = 周一 … 7 = 周日 */
export function isoWeekday(day: DayKey): number {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** 每行 7 天、周一开头，首尾补上前后月份的日子 */
export function monthGrid(month: Month): DayKey[][] {
  const first = `${month}-01`;
  const next = `${shiftMonth(month, 1)}-01`;
  const length = daysBetween(first, next);
  const start = weekOf(first).start;
  const rows = Math.ceil((daysBetween(start, first) + length) / 7);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: 7 }, (_, c) => addDays(start, r * 7 + c)));
}

/** 从 start 起（含当天）找出 count 个落在 weekdays 上、且没被占的日子 */
export function spreadDays(a: { start: DayKey; weekdays: number[]; count: number; taken: Set<DayKey> }): DayKey[] {
  const out: DayKey[] = [];
  if (a.weekdays.length === 0) return out;
  for (let i = 0; i <= SPREAD_LIMIT_DAYS && out.length < a.count; i++) {
    const day = addDays(a.start, i);
    if (a.weekdays.includes(isoWeekday(day)) && !a.taken.has(day)) out.push(day);
  }
  return out;
}

export type StockItem = { publishOn: DayKey | null; isExtra: boolean; stage: Stage };

const isDone = (s: Stage) => s === 'cut' || s === 'published';

/** 做好的够发到哪一天；同一天只要有一条没好，那天整天都不算。一天都没有则 null */
export function stockUntil(items: StockItem[], today: DayKey): DayKey | null {
  const live = items
    .filter((x): x is StockItem & { publishOn: DayKey } => x.publishOn !== null && x.publishOn >= today && !x.isExtra)
    .sort((a, b) => a.publishOn.localeCompare(b.publishOn));
  const days = [...new Set(live.map((x) => x.publishOn))];
  let until: DayKey | null = null;
  for (const day of days) {
    if (!live.filter((x) => x.publishOn === day).every((x) => isDone(x.stage))) break;
    until = day;
  }
  return until;
}

export type DueWarning = { kind: 'short'; days: number } | { kind: 'overdue' } | null;

export function dueWarning(p: { publishOn: DayKey | null; stage: Stage }, today: DayKey): DueWarning {
  if (p.publishOn === null || p.stage === 'published') return null;
  const days = daysBetween(today, p.publishOn);
  if (days < 0) return { kind: 'overdue' };
  if (p.stage !== 'cut' && days <= SHORT_DAYS) return { kind: 'short', days };
  return null;
}

/** 录制截止日 = 发布日 − 提前天数；图文不用录、没排期都没有 */
export function recordByFor(publishOn: DayKey | null, leadDays: number, kind: PostKind): DayKey | null {
  if (publishOn === null || kind === 'image') return null;
  return addDays(publishOn, -leadDays);
}

/** 「该录了」：视频、定稿了还没录，录制截止日已过 */
export function recordWarning(p: { kind: PostKind; stage: Stage; recordBy: DayKey | null }, today: DayKey): boolean {
  return p.kind === 'video' && p.stage === 'final' && p.recordBy !== null && p.recordBy < today;
}
