'use client';

import { useEffect, useState } from 'react';
import { send, studioFetch } from './api';

/**
 * 全页只有一个在播：点另一条的试听，前一条自动停。
 * 播放器放模块里，各个按钮订阅「现在在播哪个 key」。
 */
type State = { key: string | null; loading: string | null };

let audio: HTMLAudioElement | null = null;
let state: State = { key: null, loading: null };
const listeners = new Set<(s: State) => void>();

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

export function stopPlayback() {
  audio?.pause();
  set({ key: null, loading: null });
}

/** 试听稿子正文（scriptId）或某一版（versionId）。再点一次同一个 = 停 */
export async function togglePlay(target: { scriptId?: string; versionId?: string; force?: boolean }) {
  const key = target.versionId ? `v:${target.versionId}` : `s:${target.scriptId}`;
  if (state.key === key && !target.force) return stopPlayback();
  audio?.pause();
  set({ key: null, loading: key });
  try {
    const { url } = await studioFetch<{ url: string }>('/api/studio/audio', send('POST', target));
    const el = element();
    el.src = url;
    await el.play();
    set({ key, loading: null });
  } catch (e) {
    set({ key: null, loading: null });
    throw e;
  }
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
