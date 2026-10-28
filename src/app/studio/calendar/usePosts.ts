'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CalendarData, CalendarPost } from '@/lib/studio/posts-map';
import { errorText } from '../api';
import { useStudioMe } from '../studio-me';
import { showToast } from '../ui';
import { currentOrg, dropMonths, dropOthers, fetchMonth, peek, peekCurrent, prefetchAround, putMonth, saveSnapshot, updateAllMonths } from './monthStore';

/**
 * 当月的日历数据。month 为空时由服务端按墨尔本今天定月份。
 * 数据放在 monthStore 的缓存里：先画缓存，再后台刷新；改动先在本地换掉（不可变），再由调用方 reload 对齐。
 */
export function usePosts() {
  const me = useStudioMe();
  const orgId = me?.viewing?.id ?? null;
  const userId = me?.me.id ?? null;
  const org = currentOrg(); // 缓存键里的公司：和请求头同一个来源，切公司时页面会重挂载
  const [asked, setAsked] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // 进页面时先拿当月已有的数据（内存或今天存的 sessionStorage），没有就是 null
  const [latest, setLatest] = useState<string | null>(() => peekCurrent(org, userId, orgId)?.month ?? null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const seq = useRef(0);

  // 显示的月份以最后一次点的为准，连点 ‹ › 每下都往前走
  const month = asked ?? latest ?? '';
  const monthRef = useRef(month);
  monthRef.current = month;
  const data = (month ? peek(org, month) : undefined) ?? (latest ? peek(org, latest) : undefined) ?? null;

  const load = useCallback(
    async (m: string | null, fresh = false) => {
      const mine = ++seq.current;
      try {
        const d = await fetchMonth(org, m, { fresh });
        if (mine !== seq.current) return; // 丢掉翻得太快而过期的回应
        // 请求回来了却没进缓存（被作废/本地改动盖过）：当失败处理，出重试行，绝不留着骨架屏
        if (!peek(org, d.month)) throw new Error('没取到数据，请重试');
        if (m === null) setLatest(d.month);
        setFailed(null);
        bump();
        prefetchAround(org, d.month);
      } catch (e) {
        if (mine !== seq.current) return;
        const shown = m ? peek(org, m) : latest ? peek(org, latest) : undefined;
        setFailed(errorText(e)); // 有缓存在屏幕上时页面只显示一行「没刷新成功，重试」
        if (!shown) showToast(errorText(e));
      }
    },
    [org, latest],
  );

  useEffect(() => {
    load(asked);
    // latest 变化不该再取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, org]);

  /**
   * 重新取当前月。affected 给了就只作废这几个月（改日期：旧月和新月）；
   * 不给就作废其他所有月（系列、新增、删除会动很多月）。当前月先留着旧的，新的回来再换。
   */
  const reload = useCallback(
    (affected?: string[]) => {
      if (affected) dropMonths(org, affected.filter((m) => m !== monthRef.current));
      else dropOthers(org, monthRef.current);
      return load(asked, true);
    },
    [org, asked, load],
  );

  // 屏幕上的这个月变了（本地改动或刷新回来）：同步进缓存，当月的再存一份给刷新页面用
  useEffect(() => {
    if (data && data.month === month && orgId && userId) saveSnapshot(userId, orgId, data);
  }, [data, month, orgId, userId]);

  const setData = useCallback(
    (fn: (d: CalendarData | null) => CalendarData | null) => {
      const cur = peek(org, monthRef.current) ?? null;
      const next = fn(cur);
      if (next && next !== cur) {
        putMonth(org, next);
        bump();
      }
    },
    [org],
  );

  /** 公司级字段的改动（固定发布日、未读数）：这家公司每个已缓存的月都换 */
  const patchAll = useCallback(
    (fn: (d: CalendarData) => CalendarData) => {
      updateAllMonths(org, fn);
      bump();
    },
    [org],
  );

  // 一条稿子可能出现在多个已缓存的月里：所有已缓存的月一起换（侧栏草稿里的也换）
  const replace = useCallback(
    (p: CalendarPost) => {
      const swap = (list: CalendarPost[]) => list.map((x) => (x.id === p.id ? p : x));
      patchAll((d) => ({
        ...d,
        posts: swap(d.posts),
        drafts: d.drafts.map((x) => (x.id === p.id ? { ...x, title: p.title, kind: p.kind, stage: p.stage, updatedAt: p.updatedAt } : x)),
      }));
    },
    [patchAll],
  );

  const remove = useCallback(
    (id: string) => {
      patchAll((d) => {
        const drafts = d.drafts.filter((x) => x.id !== id);
        const gone = d.drafts.length - drafts.length;
        return { ...d, posts: d.posts.filter((x) => x.id !== id), drafts, draftsTotal: Math.max(0, d.draftsTotal - gone) };
      });
    },
    [patchAll],
  );

  return { data, month, setMonth: setAsked, reload, replace, remove, setData, patchAll, failed };
}
