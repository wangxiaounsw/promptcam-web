'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Checks } from '@/lib/studio/checks';
import { errorText, send, studioFetch, type StudioScript, type Version } from '../../api';
import { showToast } from '../../ui';
import type { ScriptPatch } from '../../useScripts';

export type PromptInfo = {
  prompt: string;
  name: string;
  source: 'org' | 'industry' | 'general' | 'default';
  factRules: string;
  hasOrg: boolean;
};

/**
 * 稿子页的数据：稿子本身、它的全部版本、我所在公司的写稿提示词。
 * 生成一版后立刻在后台跑核对（两次模型调用分开，各自不超 60 秒）。
 */
export function useScriptEditor(id: string, onChanged?: () => void) {
  const [script, setScript] = useState<StudioScript | null>(null);
  const [missing, setMissing] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [prompt, setPrompt] = useState<PromptInfo | null>(null);
  const [busy, setBusy] = useState<'generate' | 'save' | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, p] = await Promise.all([
        studioFetch<{ scripts: StudioScript[] }>('/api/studio/scripts'),
        studioFetch<PromptInfo>('/api/studio/prompt'),
      ]);
      const s = list.scripts.find((x) => x.id === id) ?? null;
      // 版本取回来再一起显示，免得先闪一下「还没有版本」
      const v = s?.code ? (await studioFetch<{ versions: Version[] }>(`/api/studio/versions?scriptId=${id}`)).versions : [];
      setVersions(v);
      setPrompt(p);
      setScript(s);
      setMissing(!s);
    } catch (e) {
      showToast(errorText(e));
    }
  }, [id]);

  useEffect(() => {
    setScript(null);
    load();
  }, [load]);

  const save = useCallback(
    async (change: ScriptPatch) => {
      if (!script) return;
      setBusy('save');
      try {
        await studioFetch('/api/studio/scripts', send('PATCH', { id, ...change }));
        const bodyChanged = change.body !== undefined && change.body !== script.body;
        setScript({ ...script, ...change, ...(bodyChanged ? { checks: null, hasAudio: false } : {}) });
        onChanged?.();
      } catch (e) {
        showToast(errorText(e));
      } finally {
        setBusy(null);
      }
    },
    [id, script, onChanged],
  );

  const review = useCallback(async (target: { versionId?: string; scriptId?: string }) => {
    const key = target.versionId ?? 'body';
    setReviewing(key);
    try {
      const { checks } = await studioFetch<{ checks: Checks }>('/api/studio/review', send('POST', target));
      if (target.versionId) setVersions((vs) => vs.map((v) => (v.id === target.versionId ? { ...v, checks } : v)));
      else setScript((s) => (s ? { ...s, checks } : s));
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setReviewing(null);
    }
  }, []);

  /** 生成一版并返回它；随后自动核对 */
  const generate = useCallback(
    async (promptText?: string): Promise<Version | null> => {
      setBusy('generate');
      try {
        const { version } = await studioFetch<{ version: Version }>(
          '/api/studio/generate',
          send('POST', { scriptId: id, ...(promptText ? { prompt: promptText } : {}) }),
        );
        setVersions((vs) => [...vs, version].sort((a, b) => a.n - b.n));
        review({ versionId: version.id });
        return version;
      } catch (e) {
        showToast(errorText(e));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [id, review],
  );

  const adoptVersion = useCallback(
    async (v: Version) => {
      if (!script) return;
      try {
        await studioFetch('/api/studio/versions', send('POST', { versionId: v.id }));
        setScript({ ...script, body: v.body, checks: v.checks, hasAudio: false });
        onChanged?.();
        showToast(v.n === 0 ? '已换回 Fordexa 原版' : `正文已换成第 ${v.n} 版`);
      } catch (e) {
        showToast(errorText(e));
      }
    },
    [script, onChanged],
  );

  const savePrompt = useCallback(async (body: string, note: string) => {
    try {
      await studioFetch('/api/studio/prompt', send('PUT', { body, note }));
      setPrompt((p) => (p ? { ...p, prompt: body, source: 'org' } : p));
      showToast('已存为我的写稿提示词');
    } catch (e) {
      showToast(errorText(e));
    }
  }, []);

  return { script, missing, versions, prompt, busy, reviewing, save, generate, review, adoptVersion, savePrompt, reload: load };
}
