'use client';

import { useRef, useState } from 'react';
import type { ShowcaseData, ShowcaseNote } from '@/lib/studio/showcase';
import { errorText, send, studioFetch } from '../api';
import { showToast } from '../ui';
import { uploadImage } from './upload';

/** 笔记列表：上传封面（可多张）、改标题和点赞、视频还是图文、上下挪、删除 */

/** onData：上传、删除后的整份数据；onNotes：改标题、勾选、顺序时页面先自己改显示 */
type Props = { notes: ShowcaseNote[]; onData: (d: ShowcaseData) => void; onNotes: (next: ShowcaseNote[]) => void };

const input = 'h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[14px]';

export default function NotesEditor({ notes, onData, onNotes }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0); // 还在传的张数
  // 顺序和删除排队一个一个发：后发的一定后到
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const run = (path: string, init: RequestInit, done?: (d: ShowcaseData) => void) => {
    queue.current = queue.current
      .then(() => studioFetch<ShowcaseData>(path, init))
      .then((d) => done?.(d))
      .catch((e) => showToast(errorText(e)));
  };

  const upload = async (files: FileList) => {
    // 一张一张传：每张都是一次请求，避开请求体上限；传完一张主页就多一篇
    const list = Array.from(files);
    setBusy(list.length);
    for (const f of list) {
      try {
        onData(await uploadImage(f, 'note'));
      } catch (e) {
        showToast(errorText(e));
      }
      setBusy((n) => n - 1);
    }
  };

  // 只送改了的那一项（标题、点赞或视频），服务端也只改那一列
  const save = (n: ShowcaseNote, patch: Partial<Pick<ShowcaseNote, 'title' | 'likes' | 'isVideo'>>) => {
    const changed = Object.entries(patch).filter(([k, v]) => n[k as keyof ShowcaseNote] !== v);
    if (!changed.length) return;
    onNotes(notes.map((x) => (x.id === n.id ? { ...x, ...patch } : x)));
    // 每次只改一列，互不覆盖，所以不用排队；keepalive：改完马上离开页面也存得上
    studioFetch('/api/studio/showcase', { ...send('PATCH', { notes: [{ id: n.id, ...Object.fromEntries(changed) }] }), keepalive: true })
      .catch((e) => showToast(errorText(e)));
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= notes.length) return;
    const ids = notes.map((n) => n.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onNotes(ids.map((id) => notes.find((x) => x.id === id)!));
    run('/api/studio/showcase', send('PATCH', { order: ids }));
  };

  const remove = (n: ShowcaseNote) => run(`/api/studio/showcase?note=${n.id}`, { method: 'DELETE' }, onData);

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-[var(--bg-raised)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold">笔记 <span className="text-[14px] font-medium text-[var(--muted)]">{notes.length} 篇</span></h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy > 0}
          className="h-9 rounded-xl bg-[var(--accent)] px-4 text-[14px] font-bold text-white disabled:opacity-60"
        >
          {busy > 0 ? `正在上传，还剩 ${busy} 张` : '上传封面'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files).finally(() => (e.target.value = ''))} />
      </div>
      <p className="text-[13px] text-[var(--muted)]">可以一次选多张。新传的排在最前面，和刚发的笔记一样。标题默认取文件名，点进去就能改。</p>
      <ul className="flex flex-col divide-y divide-[var(--row-line)]">
        {notes.map((n, i) => (
          <li key={n.id} className="flex gap-3 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage link */}
            <img src={n.url} alt="" className="h-[96px] w-[72px] shrink-0 rounded-md object-cover" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <input aria-label="标题" defaultValue={n.title} maxLength={40} placeholder="笔记标题" className={input} onBlur={(e) => save(n, { title: e.target.value.trim() })} />
              <div className="flex items-center gap-2">
                <input aria-label="点赞数" defaultValue={n.likes} maxLength={12} placeholder="点赞，空着显示「赞」" className={`${input} w-[150px]`} onBlur={(e) => save(n, { likes: e.target.value.trim() })} />
                <label className="flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
                  <input type="checkbox" defaultChecked={n.isVideo} onChange={(e) => save(n, { isVideo: e.target.checked })} />视频
                </label>
              </div>
              <div className="flex gap-1 text-[13px]">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="h-8 rounded-lg px-2.5 text-[var(--muted)] disabled:opacity-30">上移</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === notes.length - 1} className="h-8 rounded-lg px-2.5 text-[var(--muted)] disabled:opacity-30">下移</button>
                <span className="flex-1" />
                <button type="button" onClick={() => remove(n)} className="h-8 rounded-lg px-2.5 text-[var(--record)]">删除</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
