'use client';

import { useState } from 'react';
import { POST_LIMITS } from '@/lib/studio/posts';
import type { PostNote } from '@/lib/studio/posts-db';
import { errorText, send, studioFetch } from '../api';
import Avatar from '../Avatar';
import { showToast } from '../ui';

const when = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', {
    timeZone: 'Australia/Melbourne', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

/** 备注：按时间从旧到新；管理员和客户都能写，只能删自己的（删要点两下） */
export default function NotesThread({
  postId, notes, onNotes,
}: { postId: string; notes: PostNote[] | null; onNotes: (n: PostNote[]) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const base = `/api/studio/posts/${postId}/notes`;

  const add = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await studioFetch<{ notes: PostNote[] }>(base, send('POST', { body: text }));
      onNotes(r.notes);
      setText('');
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    if (confirmId !== id) return setConfirmId(id);
    setConfirmId(null);
    try {
      const r = await studioFetch<{ notes: PostNote[] }>(`${base}?note=${id}`, { method: 'DELETE' });
      onNotes(r.notes);
    } catch (e) {
      showToast(errorText(e));
    }
  };

  return (
    <section>
      <h3 className="mb-2 text-[15px] font-bold">备注</h3>
      {notes === null ? (
        <div className="h-10 animate-pulse rounded-xl bg-[var(--row-line)]" />
      ) : (
        <ul className="grid gap-3">
          {notes.map((n) =>
            n.kind === 'system' ? (
              <li key={n.id} className="text-center text-[13px] text-[var(--muted)]">{n.body}</li>
            ) : (
              <li key={n.id} className="flex gap-2">
                <Avatar person={n.author} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                    <span className="font-medium">{n.author?.name ?? '已离开的人'}</span>
                    <time dateTime={n.createdAt}>{when(n.createdAt)}</time>
                    {n.mine && (
                      <button type="button" onClick={() => del(n.id)} className="ml-auto h-8 px-1 text-[13px] text-[var(--record)]">
                        {confirmId === n.id ? '确认删除' : '删除'}
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[15px]">{n.body}</p>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={POST_LIMITS.note}
        rows={2}
        placeholder="写一条备注"
        className="mt-3 w-full rounded-xl border border-[var(--line)] bg-transparent p-3 text-[15px]"
      />
      <button type="button" disabled={busy || !text.trim()} onClick={add} className="mt-1 h-11 rounded-xl bg-[var(--accent)] px-4 text-[15px] font-bold text-white disabled:opacity-40">
        发送
      </button>
    </section>
  );
}
