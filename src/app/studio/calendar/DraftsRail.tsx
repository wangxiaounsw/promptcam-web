'use client';

import { useMemo, useState } from 'react';
import type { DraftItem } from '@/lib/studio/posts-map';
import { fieldClass } from './Modal';

type Props = {
  drafts: DraftItem[];
  total: number;
  today: string;
  onOpen: (id: string) => void;
  /** 「排到…」选了日期：手机上没有拖放，靠它 */
  onSchedule: (id: string, day: string) => void;
  /** 日历上的条目拖回来 = 清掉日期 */
  onDropBack: (id: string) => void;
};

/** 待排侧栏：没有发布日期的稿子。可搜（在已取回的条目里搜）、可拖到月历、也是「拖回待排」的落点 */
export default function DraftsRail({ drafts, total, today, onOpen, onSchedule, onDropBack }: Props) {
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? drafts.filter((d) => d.title.toLowerCase().includes(k)) : drafts;
  }, [drafts, q]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/plain');
        if (id) onDropBack(id);
      }}
      style={over ? { outline: '2px dashed var(--accent)' } : undefined}
      className="rounded-2xl bg-[var(--bg-raised)] p-3"
    >
      <h2 className="mb-2 text-[15px] font-bold">待排 {total} 条</h2>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜标题" aria-label="搜待排的稿子" className={fieldClass} />
      <ul className="mt-2 grid gap-1.5">
        {shown.map((d) => (
          <li
            key={d.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', d.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            style={{ border: '1.5px dashed #bbb', background: '#fafafa' }}
            className="cursor-grab rounded-lg px-2 py-1.5 text-[13px]"
          >
            {/* 用 div 而不是 button：Firefox 不会在可拖元素里的 button 上触发 dragstart（同 PostChip） */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(d.id)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onOpen(d.id);
              }}
              className="block w-full text-left"
            >
              <span className="text-[12px] opacity-70">{d.kind === 'video' ? '视频' : '图文'}</span>
              <span className="block font-medium">{d.title || '（还没有标题）'}</span>
            </div>
            {picking === d.id ? (
              <input
                type="date"
                autoFocus
                min={today}
                aria-label="排到哪一天"
                className="mt-1 h-11 w-full rounded-lg border border-[var(--row-line)] bg-transparent px-2 text-[15px]"
                onChange={(e) => {
                  if (!e.target.value) return;
                  setPicking(null);
                  onSchedule(d.id, e.target.value);
                }}
              />
            ) : (
              <button type="button" onClick={() => setPicking(d.id)} className="mt-0.5 h-11 text-[14px] font-medium text-[var(--accent)]">排到…</button>
            )}
            {picking === d.id && (
              <button type="button" onClick={() => setPicking(null)} className="h-11 text-[14px] text-[var(--muted)]">取消</button>
            )}
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="mt-2 text-[14px] text-[var(--muted)]">{q ? '没有匹配的' : '没有待排的稿子'}</p>}
      {total > drafts.length && <p className="mt-2 text-[13px] text-[var(--muted)]">还有 {total - drafts.length} 条没显示</p>}
    </div>
  );
}
