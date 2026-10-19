'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Checks } from '@/lib/studio/checks';
import { readNdjson } from '@/lib/ndjson';
import { errorText, send, studioFetch, studioHeaders, studioToken, type StudioScript, type Version } from '../../api';
import { forgetAudio, prepareAudio } from '../../player';
import { showToast } from '../../ui';
import type { ScriptPatch } from '../../useScripts';

type StreamEvent = { t: 'delta'; text: string } | { t: 'done'; version: Version; cut: boolean } | { t: 'error'; error: string };

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
  const [drafting, setDrafting] = useState<string | null>(null);
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
        if (bodyChanged) forgetAudio({ scriptId: id });
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

  /**
   * 生成一版：字边写边显示（drafting），存好后返回这一版，
   * 并立刻在后台核对、用你的声音念好 —— 你读完稿子点试听时一般已经能直接播。
   */
  const generate = useCallback(
    async (promptText?: string): Promise<Version | null> => {
      setBusy('generate');
      setDrafting('');
      try {
        const token = await studioToken();
        if (!token) throw new Error('请先登录');
        const res = await fetch('/api/studio/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...studioHeaders(token) },
          body: JSON.stringify({ scriptId: id, ...(promptText ? { prompt: promptText } : {}) }),
        });
        // 参数不对等早期错误还是普通 JSON
        if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? '生成失败');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let text = '';
        let version: Version | null = null;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const read = readNdjson(buffer + decoder.decode(value, { stream: true }));
          buffer = read.rest;
          for (const ev of read.events as StreamEvent[]) {
            if (ev.t === 'delta') {
              text += ev.text;
              setDrafting(text);
            } else if (ev.t === 'done') {
              version = ev.version;
              if (ev.cut) showToast('稿子太长，结尾可能被截断了，看一下最后一句');
            } else if (ev.t === 'error') {
              throw new Error(ev.error);
            }
          }
        }
        if (!version) throw new Error('生成中断了，再点一次');
        const saved = version;
        setVersions((vs) => [...vs, saved].sort((a, b) => a.n - b.n));
        review({ versionId: saved.id });
        prepareAudio({ versionId: saved.id });
        return saved;
      } catch (e) {
        showToast(errorText(e));
        return null;
      } finally {
        setDrafting(null);
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
        // 这一版念好了的话，服务端已经把音频拿来当正文的试听；没念好就现在念
        forgetAudio({ scriptId: id });
        prepareAudio({ scriptId: id });
        onChanged?.();
        showToast(v.n === 0 ? '已换回 Fordexa 原版' : `正文已换成第 ${v.n} 版`);
      } catch (e) {
        showToast(errorText(e));
      }
    },
    [id, script, onChanged],
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

  return { script, missing, versions, prompt, busy, reviewing, drafting, save, generate, review, adoptVersion, savePrompt, reload: load };
}
