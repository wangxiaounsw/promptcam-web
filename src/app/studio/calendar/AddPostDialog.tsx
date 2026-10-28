'use client';

import { useState } from 'react';
import { monthOf } from '@/lib/studio/calendar';
import { errorText, send, studioFetch } from '../api';
import { showToast } from '../ui';
import Modal, { fieldClass, primaryBtn } from './Modal';

/** 加一条：标题、视频/图文、日期（留空 = 未排期）、热点 */
export default function AddPostDialog({ initialDay, onClose, onDone }: { initialDay: string; onClose: () => void; onDone: (month: string | null) => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'video' | 'image'>('video');
  const [day, setDay] = useState(initialDay);
  const [isExtra, setIsExtra] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await studioFetch('/api/studio/posts', send('POST', { title, kind, publishOn: day || null, isExtra }));
      onClose();
      onDone(day ? monthOf(day) : null); // 有日期就翻到那个月
    } catch (e) {
      setError(errorText(e));
      showToast(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="加一条" onClose={onClose} busy={saving}>
      <div className="flex flex-col gap-3">
        <input className={fieldClass} placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="flex gap-2">
          {(['video', 'image'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`h-11 flex-1 rounded-xl text-[15px] font-medium ${kind === k ? 'bg-[var(--accent)] text-white' : 'border border-[var(--row-line)] text-[var(--muted)]'}`}>
              {k === 'video' ? '视频' : '图文'}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-[14px] text-[var(--muted)]">
          发布日期（留空就是未排期）
          <input type="date" className={fieldClass} value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="flex h-11 items-center gap-2 text-[15px]">
          <input type="checkbox" checked={isExtra} onChange={(e) => setIsExtra(e.target.checked)} /> 热点
        </label>
        {error && <p className="text-[14px] text-red-600">{error}</p>}
        <button type="button" disabled={saving} onClick={submit} className={primaryBtn}>{saving ? '保存中…' : '加上'}</button>
      </div>
    </Modal>
  );
}
