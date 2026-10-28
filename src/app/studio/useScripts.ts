'use client';

import { useCallback, useEffect, useState } from 'react';
import { errorText, send, studioFetch, type StudioScript } from './api';
import { showToast } from './ui';

export type ScriptPatch = Partial<Pick<StudioScript, 'title' | 'body' | 'status' | 'record_by'>>;

/** 我的稿子 + 改一条。改的时候先在本地换掉（不可变地），失败再拉一次对齐 */
export function useScripts() {
  const [scripts, setScripts] = useState<StudioScript[] | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await studioFetch<{ scripts: StudioScript[]; today: string; industry: string | null }>('/api/studio/scripts');
      setScripts(data.scripts);
      setToday(data.today);
      setIndustry(data.industry ?? null);
    } catch (e) {
      showToast(errorText(e));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const patch = useCallback(
    async (id: string, change: ScriptPatch) => {
      setScripts((list) => list?.map((s) => (s.id === id ? { ...s, ...change } : s)) ?? null);
      try {
        await studioFetch('/api/studio/scripts', send('PATCH', { id, ...change }));
      } catch (e) {
        showToast(errorText(e));
        reload();
      }
    },
    [reload],
  );

  return { scripts, today, industry, reload, patch };
}

/** 电脑宽度（≥1024）下口播库是左右两栏 */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(q.matches);
    update();
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  return desktop;
}
