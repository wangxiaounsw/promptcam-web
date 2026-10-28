'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** 页内对话框：遮罩 + Esc / 点遮罩关闭；保存中不让关，免得丢了结果 */
export default function Modal({ title, onClose, busy = false, wide = false, children }: { title: string; onClose: () => void; busy?: boolean; wide?: boolean; children: ReactNode }) {
  // 用 ref 存最新的 onClose / busy，监听只在挂载和卸载时登记
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !latest.current.busy && latest.current.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-[var(--bg-raised)] p-5 sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-bold">{title}</h2>
          <button type="button" aria-label="关闭" disabled={busy} onClick={onClose} className="h-11 w-11 text-xl text-[var(--muted)]">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const fieldClass = 'h-11 w-full rounded-xl border border-[var(--row-line)] bg-transparent px-3 text-[15px]';
export const primaryBtn = 'h-11 rounded-xl bg-[var(--accent)] px-5 text-[15px] font-bold text-white disabled:opacity-50';
