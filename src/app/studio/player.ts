'use client';

import { useEffect, useState } from 'react';
import { send, studioFetch } from './api';

/**
 * 口播库列表里的快捷试听。全页只有一个在播：点另一条的试听，前一条自动停。
 * 正在念的时候再点，就等它念完接着播，不会念第二遍。
 * 稿子页里用的是 AudioPreview(能暂停、往回 5 秒、拖进度)，两边开始播时互相让。
 */
type Target = { scriptId?: string; versionId?: string; force?: boolean };
type State = { key: string | null; loading: string[]; startedAt: Record<string, number> };

const URL_TTL = 50 * 60_000; // 签名链接 60 分钟有效，留 10 分钟余量

let audio: HTMLAudioElement | null = null;
let state: State = { key: null, loading: [], startedAt: {} };
const listeners = new Set<(s: State) => void>();
const ready = new Map<string, { url: string; at: number }>();
const inflight = new Map<string, Promise<string>>();

function set(next: State) {
  state = next;
  for (const l of listeners) l(state);
}

function element(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.addEventListener('ended', () => set({ ...state, key: null }));
    audio.addEventListener('pause', () => set({ ...state, key: null }));
  }
  return audio;
}

export const keyOf = (t: Target) => (t.versionId ? `v:${t.versionId}` : `s:${t.scriptId}`);

/** 稿子页的试听稿播放器(AudioPreview)开始播时广播;这里开始播时也广播,两边互相让 */
export const PREVIEW_PLAY_EVENT = 'studio:preview-play';

/** 取音频链接：有新鲜的直接用；正在念的等它；否则请求接口念 */
function fetchUrl(target: Target): Promise<string> {
  const key = keyOf(target);
  const cached = ready.get(key);
  if (!target.force && cached && Date.now() - cached.at < URL_TTL) return Promise.resolve(cached.url);
  const running = inflight.get(key);
  if (running && !target.force) return running;

  set({ ...state, loading: [...state.loading.filter((k) => k !== key), key], startedAt: { ...state.startedAt, [key]: Date.now() } });
  const p = studioFetch<{ url: string }>('/api/studio/audio', send('POST', target))
    .then(({ url }) => {
      ready.set(key, { url, at: Date.now() });
      return url;
    })
    .finally(() => {
      inflight.delete(key);
      set({ ...state, loading: state.loading.filter((k) => k !== key) });
    });
  inflight.set(key, p);
  return p;
}

/** 正文换了（改稿、用了别的版本）：旧链接作废 */
export function forgetAudio(target: Target) {
  ready.delete(keyOf(target));
}

export function stopPlayback() {
  audio?.pause();
  set({ ...state, key: null });
}

/** 试听。再点一次同一个 = 停；force = 重念 */
export async function togglePlay(target: Target) {
  const key = keyOf(target);
  if (state.key === key && !target.force) return stopPlayback();
  audio?.pause();
  const url = await fetchUrl(target);
  const el = element();
  el.src = url;
  window.dispatchEvent(new CustomEvent(PREVIEW_PLAY_EVENT, { detail: 'list-player' }));
  await el.play();
  set({ ...state, key });
}

export function usePlayer(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
