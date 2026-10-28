'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { monthOf, shiftMonth } from '@/lib/studio/calendar';
import type { CalendarPost } from '@/lib/studio/posts-map';
import { errorText, studioFetch } from '../api';
import { showToast } from '../ui';
import { useStudioMe } from '../studio-me';
import { useIsDesktop } from '../useScripts';
import CalendarToolbar, { type AddState } from './CalendarToolbar';
import AgendaList from './AgendaList';
import DraftsRail from './DraftsRail';
import Modal from './Modal';
import MonthGrid from './MonthGrid';
import MonthPicker from './MonthPicker';
import OrgChanges from './OrgChanges';
import PostPanel from './PostPanel';
import StockBar from './StockBar';
import { useMovePost } from './useMovePost';
import { usePosts } from './usePosts';

/**
 * 发布日历。电脑：月格；手机：按日期的列表。
 * 深链接 ?org=<id>&post=<id> 进页面时读一次：管理员先切到那家公司，再选中那一条。
 */
export default function CalendarPage() {
  const ctx = useStudioMe();
  const desktop = useIsDesktop();
  const { data, month, setMonth, reload, replace, remove, patchAll, failed } = usePosts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const linkHandled = useRef(false);
  const [deepPost, setDeepPost] = useState<CalendarPost | null>(null);
  const deepAsked = useRef<string | null>(null);

  useEffect(() => {
    if (linkHandled.current || !ctx) return;
    linkHandled.current = true;
    const q = new URLSearchParams(window.location.search);
    const org = q.get('org');
    const post = q.get('post');
    if (!post) return;
    if (org && ctx.me.isAdmin && ctx.viewing?.id !== org) {
      // 切公司后页面会重挂载，新网址只留 post
      ctx.switchTo(org, `/studio/calendar?post=${encodeURIComponent(post)}`);
      return;
    }
    setSelectedId(post);
  }, [ctx]);

  // 地址栏跟着面板走：开着是 ?post=<id>，关了回到 /studio/calendar（第一次进来还没处理深链接时不动）
  const hadSelection = useRef(false);
  useEffect(() => {
    if (selectedId) {
      hadSelection.current = true;
      window.history.replaceState(null, '', `/studio/calendar?post=${encodeURIComponent(selectedId)}`);
    } else if (hadSelection.current) {
      hadSelection.current = false;
      window.history.replaceState(null, '', '/studio/calendar');
    }
  }, [selectedId]);

  const onOpen = useCallback((id: string) => setSelectedId(id), []);
  const [add, setAdd] = useState<AddState>(null);
  const onAddOnDay = useCallback((day: string) => setAdd({ day }), []);
  const onLeadDays = useCallback(
    (n: number) => {
      patchAll((d) => ({ ...d, leadDays: n }));
      reload(); // 改了天数，录制截止日在服务端重算过，整页对齐
    },
    [patchAll, reload],
  );
  const [railOpen, setRailOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const move = useMovePost(data, reload);
  const onWeekdays = useCallback((w: number[]) => patchAll((d) => ({ ...d, weekdays: w })), [patchAll]);

  const inLists = selectedId ? (data?.posts ?? []).find((p) => p.id === selectedId) : undefined;
  const selected = inLists ?? (deepPost?.id === selectedId ? deepPost : null);

  // 深链接的那条不在已载入的月份里：单独取一条，有日期就翻到它那个月
  useEffect(() => {
    if (!selectedId || !data || inLists || deepAsked.current === selectedId) return;
    deepAsked.current = selectedId;
    studioFetch<{ post: CalendarPost }>(`/api/studio/posts/${selectedId}`)
      .then(({ post }) => {
        setDeepPost(post);
        if (post.publishOn) setMonth(monthOf(post.publishOn));
      })
      .catch((e) => {
        showToast(errorText(e));
        setSelectedId(null);
      });
  }, [selectedId, data, inLists, setMonth]);

  // 面板里的改动：换掉这一条；红点清掉时库存条的新备注数同步减一
  const onPanelChange = useCallback(
    (p: CalendarPost) => {
      const was = (data?.posts ?? []).find((x) => x.id === p.id);
      replace(p);
      // 日期或进度变了：这一条可能要换格子、换月、进出待排，库存条也变，整页对齐
      // 库存条是全局算的：别的月缓存里的也会变，所以只留当前月，其余作废再取
      if (was && (was.publishOn !== p.publishOn || was.stage !== p.stage)) reload();
      setDeepPost(p); // 挪到别的月后，面板靠它继续开着
      if (was?.unread && !p.unread) {
        patchAll((d) => ({ ...d, stock: { ...d.stock, unread: Math.max(0, d.stock.unread - 1) } }));
      }
    },
    [data, replace, patchAll, reload],
  );
  const onPanelDelete = useCallback(
    (id: string) => {
      remove(id);
      setSelectedId(null);
      reload(); // 库存条、系列总数跟着服务端对齐
    },
    [remove, reload],
  );
  const onClose = useCallback(() => setSelectedId(null), []);

  if (!month) {
    // 第一次加载就失败：给出错信息和重试，不能一直骨架
    return failed ? (
      <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-[var(--bg-raised)] p-8 text-center">
        <p className="text-[15px] text-[var(--muted)]">{failed}</p>
        <button type="button" onClick={() => reload()} className="h-11 rounded-xl bg-[var(--accent)] px-5 text-[15px] font-bold text-white">重试</button>
      </div>
    ) : (
      <div className="mt-4 h-64 animate-pulse rounded-2xl bg-[var(--row-line)]" />
    );
  }

  const ready = data && data.month === month ? data : null;
  const rail = ready && (
    <DraftsRail
      drafts={ready.drafts}
      total={ready.draftsTotal}
      today={ready.today}
      onOpen={(id) => {
        setRailOpen(false);
        onOpen(id);
      }}
      onSchedule={(id, day) => void move(id, { day }).then((ok) => ok && setRailOpen(false))}
      onDropBack={(id) => void move(id, 'rail')}
    />
  );
  const thisMonth = data ? monthOf(data.today) : month;
  return (
    <div data-selected-post={selectedId ?? ''}>
      <div className="flex h-11 items-center justify-between">
        <MonthPicker month={month} thisMonth={thisMonth} onPick={setMonth} />
        <div className="flex items-center">
          {month !== thisMonth && (
            <button type="button" className="mr-2 text-[15px] font-medium text-[var(--accent)]" onClick={() => setMonth(thisMonth)}>回到本月</button>
          )}
          <button type="button" className="mr-2 h-11 text-[15px] font-medium text-[var(--accent)]" onClick={() => setChangesOpen(true)}>修改记录</button>
          <button type="button" aria-label="上个月" className="h-11 w-11 text-xl text-[var(--accent)]" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <button type="button" aria-label="下个月" className="h-11 w-11 text-xl text-[var(--accent)]" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
      </div>

      {!ready ? (
        failed ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-[var(--bg-raised)] p-8 text-center">
            <p className="text-[15px] text-[var(--muted)]">{failed}</p>
            <button type="button" onClick={() => reload()} className="h-11 rounded-xl bg-[var(--accent)] px-5 text-[15px] font-bold text-white">重试</button>
          </div>
        ) : (
          <div className="mt-4 h-64 animate-pulse rounded-2xl bg-[var(--row-line)]" />
        )
      ) : (
        <>
          {failed && (
            <div role="status" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-raised)] px-4 py-2 text-[14px] text-[var(--muted)]">
              <span>没刷新成功，重试</span>
              <button type="button" onClick={() => reload()} className="h-11 px-2 font-bold text-[var(--accent)]">重试</button>
            </div>
          )}
          <CalendarToolbar data={ready} add={add} setAdd={setAdd} onDone={() => reload()} onMonth={setMonth} onWeekdays={onWeekdays} onLeadDays={onLeadDays} />
          <StockBar stock={ready.stock} />

          {!desktop && (
            <button type="button" onClick={() => setRailOpen(true)} className="mt-3 h-11 rounded-xl border border-[var(--row-line)] px-4 text-[15px] font-medium">待排 {ready.draftsTotal} 条</button>
          )}
          {desktop ? (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <MonthGrid data={ready} onOpen={onOpen} onAddOnDay={onAddOnDay} onDropOnDay={(id, day) => void move(id, { day })} />
              </div>
              <div className="mt-3 w-64 shrink-0">{rail}</div>
            </div>
          ) : (
            <AgendaList data={ready} onOpen={onOpen} />
          )}
          {!desktop && railOpen && (
            <Modal title="待排" onClose={() => setRailOpen(false)}>{rail}</Modal>
          )}
        </>
      )}

      {changesOpen && data && <OrgChanges isAdmin={data.isAdmin} onOpen={onOpen} onClose={() => setChangesOpen(false)} />}
      {selected && data && (
        <PostPanel post={selected} isAdmin={data.isAdmin} industry={data.industry} today={data.today} onChange={onPanelChange} onDelete={onPanelDelete} onClose={onClose} />
      )}
    </div>
  );
}
