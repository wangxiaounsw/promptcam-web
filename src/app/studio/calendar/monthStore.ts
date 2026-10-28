'use client';

import { monthOf } from '@/lib/studio/calendar';
import { adjacentMonths, cacheKey, planFetch, snapshotKey, snapshotUsable } from '@/lib/studio/calendar-cache';
import type { CalendarData } from '@/lib/studio/posts-map';
import { melbourneDay } from '@/lib/studio/week';
import { studioFetch } from '../api';
import { readViewing } from '../viewing';

/**
 * 日历的月份缓存（浏览器内存，整个标签页共用）。
 * 键 = 正在看的公司 + 月份，所以管理员切公司不会串数据。
 * - 外壳在问 /me 的同时就调 prefetchMonth(null)，页面挂载后直接接上这个还在飞的请求，不再等 /me 回来才开始。
 * - 页面先画缓存，再后台刷新（stale-while-revalidate）。
 */
const memory = new Map<string, CalendarData>();
const inflight = new Map<string, { p: Promise<CalendarData>; gen: number }>();
const fetchedAt = new Map<string, number>(); // 键 -> 刚取回来的时间；5 秒内页面不必再取
const nowMonth = new Map<string, string>(); // 'org|now' 当时解析成了哪个月
const started = new Map<string, number>(); // 每个键最近一次请求的序号：只认最新的那次写缓存
let generation = 0; // 作废缓存时加一：作废之前发出的请求，回来了也不写
let counter = 0;
let boundUser: string | null = null;

/** 请求头里带的公司（和 studioFetch 一样读 readViewing），也是缓存键里的公司 */
export const currentOrg = (): string | null => readViewing();

export const peek = (org: string | null, month: string): CalendarData | undefined => memory.get(cacheKey(org, month));

/** 换了登录的人：丢掉上一个人的所有缓存。第一次绑定不丢，免得清掉刚发出去的预取 */
export function bindUser(userId: string): void {
  if (boundUser !== null && boundUser !== userId) {
    memory.clear();
    inflight.clear();
    fetchedAt.clear();
    nowMonth.clear();
    generation++;
  }
  boundUser = userId;
}

export interface FetchOpts {
  /** 强制重新取（编辑之后）；否则接上同一个键还在飞的请求 */
  fresh?: boolean;
  /** 预取：低优先级，别和用户正在等的请求抢 */
  low?: boolean;
}

/** 取一个月（null = 服务端按墨尔本今天定月份）。结果写进缓存；同一个键同时只飞一个请求 */
export function fetchMonth(org: string | null, month: string | null, opts: FetchOpts = {}): Promise<CalendarData> {
  const k = cacheKey(org, month);
  const running = inflight.get(k);
  const cachedMonth = month ?? nowMonth.get(k) ?? '';
  const hit = memory.get(cacheKey(org, cachedMonth));
  const plan = planFetch({
    fresh: !!opts.fresh,
    low: !!opts.low,
    inflightGen: running?.gen,
    generation,
    fetchedAt: fetchedAt.get(k),
    cached: !!hit,
    now: Date.now(),
  });
  if (plan === 'join' && running) return running.p;
  if (plan === 'reuse' && hit) return Promise.resolve(hit);
  const gen = generation;
  const mine = ++counter;
  started.set(k, mine);
  // 请求头里的公司和缓存键用同一个来源（org），不再各读一次
  const init = { ...(opts.low ? { priority: 'low' } : {}), ...(org ? { headers: { 'x-studio-org': org } } : {}) } as RequestInit;
  const p = studioFetch<CalendarData>(`/api/studio/posts${month ? `?month=${month}` : ''}`, init).then(
    (d) => {
      if (gen === generation && started.get(k) === mine) {
        memory.set(cacheKey(org, d.month), d);
        const now = Date.now();
        fetchedAt.set(k, now);
        fetchedAt.set(cacheKey(org, d.month), now);
        if (month === null) nowMonth.set(k, d.month);
      }
      if (inflight.get(k)?.p === p) inflight.delete(k);
      return d;
    },
    (e) => {
      if (inflight.get(k)?.p === p) inflight.delete(k);
      throw e;
    },
  );
  inflight.set(k, { p, gen });
  return p;
}

/** 外壳调：进日历路径时和 /me 同时开始取。出错忽略，页面自己会再取一次并报错 */
export function prefetchMonth(month: string | null): void {
  fetchMonth(currentOrg(), month).catch(() => {});
}

/** 当前月已有数据的话，前后各一个月悄悄取好，‹ › 就是即时的 */
export function prefetchAround(org: string | null, month: string): void {
  for (const m of adjacentMonths(month)) {
    if (memory.has(cacheKey(org, m)) || inflight.has(cacheKey(org, m))) continue;
    fetchMonth(org, m, { low: true }).catch(() => {});
  }
}

function dropKeys(match: (k: string) => boolean): void {
  generation++;
  for (const k of [...memory.keys()]) if (match(k)) memory.delete(k);
  for (const k of [...fetchedAt.keys()]) if (match(k)) fetchedAt.delete(k);
  for (const k of [...inflight.keys()]) if (match(k)) inflight.delete(k);
}

/** 这几个月的缓存作废（改了日期：旧月和新月） */
export function dropMonths(org: string | null, months: string[]): void {
  const keys = new Set(months.map((m) => cacheKey(org, m)));
  dropKeys((k) => keys.has(k));
}

/** 除当前月以外这家公司的缓存全部作废（系列、新增、删除会动很多月） */
export function dropOthers(org: string | null, keep: string): void {
  const prefix = cacheKey(org, ''); // 'org|'
  const keepKey = cacheKey(org, keep);
  const nowKey = cacheKey(org, null);
  dropKeys((k) => k.startsWith(prefix) && k !== keepKey && k !== nowKey);
}

/** 本地改动（换掉一条、删一条）同步进缓存，回头翻到这个月不会看到旧样子 */
export function putMonth(org: string | null, d: CalendarData): void {
  generation++; // 本地改动之后，更早发出的请求回来了也不许盖掉它
  fetchedAt.delete(cacheKey(org, d.month));
  memory.set(cacheKey(org, d.month), d);
}

/** 公司级的字段（固定发布日、未读数、未排期的那些条）在每个已缓存的月里都有一份：一起换掉 */
export function updateAllMonths(org: string | null, fn: (d: CalendarData) => CalendarData): void {
  generation++;
  const prefix = cacheKey(org, '');
  for (const [k, d] of [...memory.entries()]) {
    if (!k.startsWith(prefix)) continue;
    memory.set(k, fn(d));
    fetchedAt.delete(k);
  }
}

// —— sessionStorage 快照：刷新页面时先画出来，仍然会后台刷新 ——
function store(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveSnapshot(userId: string, orgId: string, d: CalendarData): void {
  if (d.month !== monthOf(d.today)) return; // 只存当月：刷新永远落在当月
  try {
    store()?.setItem(snapshotKey(userId, orgId), JSON.stringify(d));
  } catch {
    // 存满了或被禁：只是少了刷新时的先画，不影响功能
  }
}

function readSnapshot(userId: string, orgId: string): CalendarData | null {
  try {
    const raw = store()?.getItem(snapshotKey(userId, orgId));
    if (!raw) return null;
    const d = JSON.parse(raw) as CalendarData;
    return snapshotUsable(d, melbourneDay(new Date())) && Array.isArray(d.posts) ? d : null;
  } catch {
    return null;
  }
}

/** 进页面时当月已有的数据：内存里有就用；没有再看 sessionStorage（今天存的才算） */
export function peekCurrent(org: string | null, userId: string | null, orgId: string | null): CalendarData | null {
  const month = monthOf(melbourneDay(new Date()));
  const hit = peek(org, month);
  if (hit) return hit;
  const snap = userId && orgId ? readSnapshot(userId, orgId) : null;
  if (snap) memory.set(cacheKey(org, snap.month), snap);
  return snap;
}
