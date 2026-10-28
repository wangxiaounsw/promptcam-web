'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, studioFetch } from '../api';
import { showToast } from '../ui';
import { ChangeRow, type ChangeItem } from './ChangeList';
import Modal from './Modal';

type OrgChange = ChangeItem & { scriptId: string; scriptTitle: string };

/** 日历页的「修改记录」抽屉：这家公司最近的改动，点一条打开那一条的面板；管理员能删（点两下） */
export default function OrgChanges({ isAdmin, onOpen, onClose }: { isAdmin: boolean; onOpen: (id: string) => void; onClose: () => void }) {
  const [items, setItems] = useState<OrgChange[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // 父组件每次渲染 onClose 都是新函数：用 ref 存着，取数只在挂载时跑一次
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    studioFetch<{ changes: OrgChange[] }>('/api/studio/changes?scope=org&limit=100')
      .then((r) => setItems(r.changes))
      .catch((e) => {
        showToast(errorText(e));
        closeRef.current();
      });
  }, []);

  const del = useCallback(
    async (id: string) => {
      if (confirmId !== id) return setConfirmId(id);
      setConfirmId(null);
      try {
        await studioFetch(`/api/studio/changes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        setItems((cur) => (cur ? cur.filter((c) => c.id !== id) : cur));
      } catch (e) {
        showToast(errorText(e));
      }
    },
    [confirmId],
  );

  return (
    <Modal title="修改记录" onClose={onClose}>
      {items === null ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--row-line)]" />
      ) : items.length === 0 ? (
        <p className="text-[14px] text-[var(--muted)]">还没有记录</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onOpen(c.scriptId);
                  onClose();
                }}
                className="mb-0.5 block max-w-full truncate text-[13px] font-medium text-[var(--accent)]"
              >
                {c.scriptTitle}
              </button>
              <ul><ChangeRow change={c} confirming={confirmId === c.id} onDelete={isAdmin ? () => del(c.id) : undefined} /></ul>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
