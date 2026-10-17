'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { errorText } from './api';
import { togglePlay, usePlayer } from './player';

/** App 的小标签：上下 4、左右 10、全圆角，13/500 */
export function Pill({ tone = 'green', children }: { tone?: 'green' | 'yellow' | 'red' | 'gray'; children: ReactNode }) {
  const tones = {
    green: 'bg-[var(--accent-tint)] text-[var(--accent)]',
    yellow: 'bg-[#FFF4CC] text-[#7A5A00]',
    red: 'bg-[#FBE9E7] text-[var(--record)]',
    gray: 'bg-[var(--row-line)] text-[var(--muted)]',
  };
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium ${tones[tone]}`}>{children}</span>;
}

// ---- 轻提示：底部浮一条，几秒后消失；可带一个按钮 ----

type Toast = { id: number; text: string; action?: { label: string; run: () => void } };
let toasts: Toast[] = [];
const toastListeners = new Set<(t: Toast[]) => void>();
let nextId = 1;

export function showToast(text: string, action?: Toast['action']) {
  const t = { id: nextId++, text, action };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, action ? 6000 : 3500);
}

export function Toaster() {
  const [list, setList] = useState(toasts);
  useEffect(() => {
    toastListeners.add(setList);
    return () => {
      toastListeners.delete(setList);
    };
  }, []);
  if (!list.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex flex-col items-center gap-2 px-5 md:bottom-8">
      {list.map((t) => (
        <div key={t.id} role="status" className="pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-xl bg-[var(--ink)] px-4 text-[15px] text-white shadow-lg">
          <span className="flex-1 py-3">{t.text}</span>
          {t.action && (
            <button type="button" onClick={t.action.run} className="h-11 shrink-0 font-bold text-[#7BE3A6]">
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- 试听键 ----

/** 强制重念：换了声音、或者觉得这次念得不好时用 */
export function ReplayButton({ scriptId, versionId }: { scriptId?: string; versionId?: string }) {
  const player = usePlayer();
  const key = versionId ? `v:${versionId}` : `s:${scriptId}`;
  return (
    <button
      type="button"
      disabled={player.loading === key}
      onClick={() => togglePlay({ scriptId, versionId, force: true }).catch((err) => showToast(errorText(err)))}
      className="h-11 px-2 text-[15px] font-medium text-[var(--accent)] disabled:opacity-40"
    >
      {player.loading === key ? '重念中…' : '重念'}
    </button>
  );
}

export function PlayButton({
  scriptId,
  versionId,
  size = 'round',
}: {
  scriptId?: string;
  versionId?: string;
  size?: 'round' | 'wide';
}) {
  const player = usePlayer();
  const key = versionId ? `v:${versionId}` : `s:${scriptId}`;
  const playing = player.key === key;
  const loading = player.loading === key;
  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePlay({ scriptId, versionId }).catch((err) => showToast(errorText(err)));
  };
  const glyph = loading ? (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
  ) : playing ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
  );
  if (size === 'wide') {
    return (
      <button type="button" onClick={click} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[var(--accent)] text-[17px] font-bold text-[var(--accent)]">
        {glyph}
        {loading ? '生成中…' : playing ? '停止' : '试听'}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={click}
      aria-label={playing ? '停止试听' : '试听'}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[var(--accent)]"
    >
      {glyph}
    </button>
  );
}
