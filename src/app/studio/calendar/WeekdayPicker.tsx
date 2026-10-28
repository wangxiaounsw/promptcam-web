'use client';

import { useState } from 'react';
import { WEEKDAY_NAMES } from '@/lib/studio/calendar';
import { errorText, send, studioFetch } from '../api';
import { showToast } from '../ui';

/** 7 个可切换的星期按钮（1 = 周一 … 7 = 周日）；只管显示和回调 */
export function WeekdayPicker({ value, onChange, disabled = false }: { value: number[]; onChange: (next: number[]) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="发在星期几">
      {WEEKDAY_NAMES.map((l, i) => {
        const n = i + 1;
        const on = value.includes(n);
        return (
          <button
            key={n}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== n) : [...value, n].sort((a, b) => a - b))}
            className={`h-11 w-11 rounded-xl text-[15px] font-medium disabled:opacity-60 ${on ? 'bg-[var(--accent)] text-white' : 'border border-[var(--row-line)] text-[var(--muted)]'}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

/** 页面上的「固定发布日」：乐观切换，立刻 PATCH；失败退回并提示；请求中不能再点 */
export function OrgWeekdays({ weekdays, onSaved }: { weekdays: number[]; onSaved: (next: number[]) => void }) {
  const [local, setLocal] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = local ?? weekdays;
  const change = async (next: number[]) => {
    const before = shown;
    setLocal(next);
    setSaving(true);
    try {
      const r = await studioFetch<{ weekdays: number[] }>('/api/studio/org', send('PATCH', { weekdays: next }));
      onSaved(r.weekdays);
      setLocal(null);
    } catch (e) {
      setLocal(before);
      showToast(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-[14px] text-[var(--muted)]">固定发布日</span>
      <WeekdayPicker value={shown} onChange={change} disabled={saving} />
    </div>
  );
}

/** 「提前 [5] 天录完」：失焦保存；不合法或没变就退回，失败退回并提示 */
export function OrgLeadDays({ leadDays, onSaved }: { leadDays: number; onSaved: (n: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const commit = async () => {
    if (text === null) return;
    const n = Number(text);
    setText(null);
    if (text.trim() === '' || !Number.isInteger(n) || n < 0 || n > 30) return showToast('提前天数要在 0 到 30 之间');
    if (n === leadDays) return;
    setSaving(true);
    try {
      const r = await studioFetch<{ leadDays: number }>('/api/studio/org', send('PATCH', { leadDays: n }));
      onSaved(r.leadDays);
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <label className="flex items-center gap-2 text-[14px] text-[var(--muted)]">
      提前
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={30}
        disabled={saving}
        value={text ?? String(leadDays)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="提前几天录完"
        className="h-11 w-16 rounded-xl border border-[var(--row-line)] bg-transparent px-2 text-center text-[15px] text-[var(--ink)]"
      />
      天录完
    </label>
  );
}
