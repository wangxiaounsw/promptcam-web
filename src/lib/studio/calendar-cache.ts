/**
 * 日历数据缓存用的纯函数：缓存键、一年的 12 个月、相邻月份、先画快照的判断。
 * 浏览器和测试共用，不碰 window / sessionStorage / 鉴权。
 */
import { monthOf, shiftMonth, type Month } from './calendar.ts';

/** 缓存键 = 公司 + 月份。月份为空是「服务端按今天定月份」的那次请求；公司为空是「自己的公司」。 */
export function cacheKey(org: string | null, month: Month | null): string {
  return `${org ?? 'own'}|${month ?? 'now'}`;
}

/** 某一年的 12 个月，'YYYY-01' … 'YYYY-12' */
export function monthsOfYear(year: number): Month[] {
  const y = String(year).padStart(4, '0');
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
}

/** [上个月, 下个月]，用来预取 */
export function adjacentMonths(month: Month): [Month, Month] {
  return [shiftMonth(month, -1), shiftMonth(month, 1)];
}

export const shiftYearOf = (year: number, n: number): number => year + n;

/** sessionStorage 里「这个人看这家公司当月快照」的键 */
export const snapshotKey = (userId: string, orgId: string): string => `studio-calendar|${userId}|${orgId}`;

/** 刚取回来多久内算新鲜，页面不必再取一遍（外壳预取先回来、页面后挂载的情形） */
export const REUSE_MS = 5000;

export function isRecent(at: number | undefined, now: number): boolean {
  return at !== undefined && now - at < REUSE_MS;
}

/**
 * 刷新页面时能不能先用快照画出来：必须是「今天存的」且「存的就是当月」。
 * 隔天了、或存的是翻到的别的月，都不画 —— 进来永远落在当月，不能先闪一个别的月。
 */
export function snapshotUsable(s: { month: unknown; today: unknown } | null, today: string): boolean {
  if (!s || typeof s.month !== 'string' || typeof s.today !== 'string') return false;
  return s.today === today && s.month === monthOf(s.today);
}

export type FetchPlan = 'join' | 'reuse' | 'fetch';

/**
 * 取一个月之前的决定：接上还在飞的请求 / 直接用刚取回来的缓存 / 发新请求。
 * - fresh（编辑后重取）：一律发新请求。
 * - 飞着的请求如果是在上一次「作废/本地改动」之前发出的（gen 不等于现在），它回来也不会写缓存，不能接。
 * - 预取（low）不吃「刚取回来」的缓存，只负责补缺。
 */
export function planFetch(a: {
  fresh: boolean;
  low: boolean;
  inflightGen: number | undefined;
  generation: number;
  fetchedAt: number | undefined;
  cached: boolean;
  now: number;
}): FetchPlan {
  if (a.fresh) return 'fetch';
  if (a.inflightGen !== undefined && a.inflightGen === a.generation) return 'join';
  if (!a.low && a.cached && isRecent(a.fetchedAt, a.now)) return 'reuse';
  return 'fetch';
}
