/**
 * 口播库的周历。「今天」「本周」「过期」一律按墨尔本时间算 ——
 * 服务器跑在 UTC，周日晚上在墨尔本已经是周一了。
 * 日期一律用 'YYYY-MM-DD' 字符串传，加减时落到 UTC 正午，避开夏令时跳变。
 */
export type DayKey = string;
export type ScriptStatus = 'ready' | 'recorded' | 'archived';
export type WeekItem = { id: string; record_by: DayKey | null; status: ScriptStatus };
export type WeekGroups<T> = {
  overdue: T[];
  days: Record<DayKey, T[]>;
  unscheduled: T[];
  next: T | null;
};

const melbourne = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Melbourne',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function melbourneDay(now: Date): DayKey {
  return melbourne.format(now);
}

function noon(day: DayKey): Date {
  return new Date(`${day}T12:00:00Z`);
}

function addDays(day: DayKey, n: number): DayKey {
  const d = noon(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekOf(day: DayKey): { start: DayKey; end: DayKey; days: DayKey[] } {
  const sinceMonday = (noon(day).getUTCDay() + 6) % 7;
  const start = addDays(day, -sinceMonday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return { start, end: days[6], days };
}

export function shiftWeek(day: DayKey, weeks: number): DayKey {
  return addDays(day, weeks * 7);
}

const byDate = <T extends WeekItem>(a: T, b: T) => (a.record_by ?? '').localeCompare(b.record_by ?? '');

export function groupWeek<T extends WeekItem>(items: T[], today: DayKey, weekStart: DayKey): WeekGroups<T> {
  const live = items.filter((x) => x.status !== 'archived');
  const isOverdue = (x: T) => x.status === 'ready' && x.record_by !== null && x.record_by < today;
  const overdue = live.filter(isOverdue).sort(byDate);
  const unscheduled = live.filter((x) => x.status === 'ready' && x.record_by === null);

  const days: Record<DayKey, T[]> = {};
  for (const day of weekOf(weekStart).days) {
    const onDay = live.filter((x) => x.record_by === day && !isOverdue(x));
    days[day] = [...onDay.filter((x) => x.status === 'ready'), ...onDay.filter((x) => x.status === 'recorded')];
  }

  const upcoming = live
    .filter((x) => x.status === 'ready' && x.record_by !== null && x.record_by >= today)
    .sort(byDate);
  return { overdue, days, unscheduled, next: overdue[0] ?? upcoming[0] ?? null };
}

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function monthDay(day: DayKey): { m: number; d: number } {
  return { m: Number(day.slice(5, 7)), d: Number(day.slice(8, 10)) };
}

/** 今天 · 周六 / 明天 · 周日 / 周二 · 10月20日 */
export function dayLabel(day: DayKey, today: DayKey): string {
  const weekday = WEEKDAY[noon(day).getUTCDay()];
  if (day === today) return `今天 · ${weekday}`;
  if (day === addDays(today, 1)) return `明天 · ${weekday}`;
  const { m, d } = monthDay(day);
  return `${weekday} · ${m}月${d}日`;
}

/** 10月12日 – 18日 / 10月26日 – 11月1日 */
export function weekLabel(weekStart: DayKey): string {
  const { m: m1, d: d1 } = monthDay(weekStart);
  const { m: m2, d: d2 } = monthDay(addDays(weekStart, 6));
  return m1 === m2 ? `${m1}月${d1}日 – ${d2}日` : `${m1}月${d1}日 – ${m2}月${d2}日`;
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / 86_400_000);
}
