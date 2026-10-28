'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorText, studioFetch, type Person } from '../api';
import Avatar from '../Avatar';
import { showToast } from '../ui';

/** 接口 GET /api/studio/changes 回来的一行 */
export type ChangeItem = { id: string; at: string; text: string; actor: Person | null };

const when = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', {
    timeZone: 'Australia/Melbourne', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

/** 一行记录：头像、说法、时间。onDelete 给了才有「删」（只给管理员），点一下变「确认删除」 */
export function ChangeRow({
  change, confirming, onDelete,
}: { change: ChangeItem; confirming?: boolean; onDelete?: () => void }) {
  return (
    <li className="flex items-start gap-2">
      <Avatar person={change.actor} size={20} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-[14px]">{change.text}</p>
        <time dateTime={change.at} className="text-[12px] text-[var(--muted)]">{when(change.at)}</time>
      </div>
      {onDelete && (
        <button type="button" onClick={onDelete} className="h-8 shrink-0 px-1 text-[13px] text-[var(--record)]">
          {confirming ? '确认删除' : '删'}
        </button>
      )}
    </li>
  );
}

/** 面板里折叠的「修改记录」：展开才取；管理员每条有「删」，在面板里点两下 */
export default function ChangeList({ scriptId, isAdmin, version }: { scriptId: string; isAdmin: boolean; version?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChangeItem[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // alive 判断：换条或重取时，慢回来的旧请求不能盖掉新的
  const load = useCallback(async (alive: () => boolean = () => true) => {
    try {
      const r = await studioFetch<{ changes: ChangeItem[] }>(`/api/studio/changes?scriptId=${encodeURIComponent(scriptId)}`);
      if (alive()) setItems(r.changes);
    } catch (e) {
      if (alive()) showToast(errorText(e));
    }
  }, [scriptId]);

  // 换条先清空；这条改过（version 变了）已展开的就重取
  useEffect(() => setItems(null), [scriptId]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void load(() => alive);
    return () => {
      alive = false;
    };
  }, [open, load, version]);

  const del = async (id: string) => {
    if (confirmId !== id) return setConfirmId(id);
    setConfirmId(null);
    try {
      await studioFetch(`/api/studio/changes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setItems((cur) => (cur ? cur.filter((c) => c.id !== id) : cur));
    } catch (e) {
      showToast(errorText(e));
    }
  };

  return (
    <section>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-11 w-full items-center justify-between text-[15px] font-bold">
        修改记录 <span className="text-[13px] font-normal text-[var(--muted)]">{open ? '▾' : '›'}</span>
      </button>
      {open &&
        (items === null ? (
          <div className="h-10 animate-pulse rounded-xl bg-[var(--row-line)]" />
        ) : items.length === 0 ? (
          <p className="text-[14px] text-[var(--muted)]">还没有记录</p>
        ) : (
          <ul className="grid gap-2.5">
            {items.map((c) => (
              <ChangeRow key={c.id} change={c} confirming={confirmId === c.id} onDelete={isAdmin ? () => del(c.id) : undefined} />
            ))}
          </ul>
        ))}
    </section>
  );
}
