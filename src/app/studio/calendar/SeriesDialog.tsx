'use client';

import { useEffect, useRef, useState } from 'react';
import { WEEKDAY_NAMES, isoWeekday, monthOf } from '@/lib/studio/calendar';
import { errorText, send, studioFetch } from '../api';
import { showToast } from '../ui';
import Modal, { fieldClass, primaryBtn } from './Modal';
import { WeekdayPicker } from './WeekdayPicker';

type PlanItem = { day: string; title: string; kind: 'video' | 'image'; episode: number };

/** 「11/3 周二 · 安全 2/8 · 标题」；总数取预览里最后一集的集数（= 现有 + 新排） */
function previewLine(p: PlanItem, series: string, total: number): string {
  const d = `${Number(p.day.slice(5, 7))}/${Number(p.day.slice(8, 10))} 周${WEEKDAY_NAMES[isoWeekday(p.day) - 1]}`;
  return `${d} · ${series.trim()} ${p.episode}/${total} · ${p.kind === 'image' ? '图文：' : ''}${p.title}`;
}

interface Props {
  today: string;
  seriesNames: string[];
  defaultWeekdays: number[];
  onClose: () => void;
  onDone: (firstMonth: string) => void;
}

/** 排一个系列：输入停 400ms 后 dryRun 出预览，确认才真排 */
export default function SeriesDialog({ today, seriesNames, defaultWeekdays, onClose, onDone }: Props) {
  const [series, setSeries] = useState('');
  const [lines, setLines] = useState('');
  const [start, setStart] = useState(today);
  const [weekdays, setWeekdays] = useState(defaultWeekdays);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [planKey, setPlanKey] = useState(''); // 这份预览对应的输入；和当前输入对不上就是过期
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  const key = JSON.stringify([series, lines, start, weekdays]);
  const fresh = planKey === key;

  useEffect(() => {
    const mine = ++seq.current;
    if (!series.trim() || !lines.trim()) {
      setPlan([]);
      setError('');
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await studioFetch<{ plan: PlanItem[] }>('/api/studio/posts/series', send('POST', { series, lines, start, weekdays, dryRun: true }));
        if (mine !== seq.current) return; // 丢掉过期的预览
        setPlan(r.plan);
        setPlanKey(key);
        setError('');
      } catch (e) {
        if (mine !== seq.current) return;
        setPlan([]);
        setPlanKey(key);
        setError(errorText(e));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [series, lines, start, weekdays, key]);

  const submit = async () => {
    if (saving || !fresh || plan.length === 0) return;
    setSaving(true);
    seq.current++; // 作废还在路上的预览
    try {
      await studioFetch('/api/studio/posts/series', send('POST', { series, lines, start, weekdays, dryRun: false }));
      onClose();
      onDone(monthOf(plan[0].day));
    } catch (e) {
      setError(errorText(e));
      showToast(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const total = plan.length ? plan[plan.length - 1].episode : 0;
  return (
    <Modal title="排一个系列" onClose={onClose} busy={saving} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <input className={fieldClass} placeholder="系列名" list="series-names" value={series} onChange={(e) => setSeries(e.target.value)} autoFocus />
          <datalist id="series-names">{seriesNames.map((n) => <option key={n} value={n} />)}</datalist>
          <textarea className="min-h-36 w-full rounded-xl border border-[var(--row-line)] bg-transparent p-3 text-[15px]" placeholder="一行一集；行首写「图文：」就是图文" value={lines} onChange={(e) => setLines(e.target.value)} />
          <label className="flex flex-col gap-1 text-[14px] text-[var(--muted)]">
            从哪天开始
            <input type="date" className={fieldClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <div className="flex flex-col gap-1 text-[14px] text-[var(--muted)]">
            发在星期几
            <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[14px] text-[var(--muted)]">预览</p>
          {!fresh && series.trim() && lines.trim() ? (
            <p className="text-[14px] text-[var(--muted)]">排期计算中…</p>
          ) : error ? (
            <p className="text-[14px] text-red-600">{error}</p>
          ) : plan.length === 0 ? (
            <p className="text-[14px] text-[var(--muted)]">填好系列名和每集标题就能看到排期</p>
          ) : (
            <ul className="flex flex-col gap-1 text-[14px]">
              {plan.map((p) => <li key={p.episode}>{previewLine(p, series, total)}</li>)}
            </ul>
          )}
        </div>
      </div>
      <button type="button" disabled={saving || !fresh || plan.length === 0} onClick={submit} className={`${primaryBtn} mt-4 w-full`}>{saving ? '保存中…' : '确认排上'}</button>
    </Modal>
  );
}
