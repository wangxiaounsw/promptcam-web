'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Ref } from '@/lib/content';
import ScriptPanel from '@/app/studio/s/[id]/ScriptPanel';
import { Toaster } from '@/app/studio/ui';

/** 电脑上侧栏的宽度(和下面 md:w-[...] 一致);打开时给页面右边留出同样的空,文章自己往左让,不被盖住 */
const WIDTH = 'min(36rem, 45vw)';
const DESKTOP = '(min-width: 768px)';

/**
 * 公开文章页的侧栏:看着文章改这家的稿子、看提示词、试听、对出处,不用跳去工作台。
 * 电脑上从右边滑出、文章留在左边;手机上从底部拉起,盖住大半屏。
 * 排期、标已录不放这里,还是在工作台做。
 */
export default function ScriptDrawer({
  scriptId,
  autoGenerate,
  refs,
  onClose,
}: {
  scriptId: string;
  autoGenerate: boolean;
  refs: Ref[];
  onClose: () => void;
}) {
  useEffect(() => {
    // 在输入框里按 Esc(比如输入法取消候选)不关侧栏,免得没保存的改稿丢掉
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    const desktop = window.matchMedia(DESKTOP).matches;
    const prev = { padding: document.body.style.paddingRight, overflow: document.body.style.overflow };
    // 电脑上给文章让出右边;手机上锁住背后的文章,免得滑抽屉时它跟着滚
    if (desktop) document.body.style.paddingRight = WIDTH;
    else document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.paddingRight = prev.padding;
      document.body.style.overflow = prev.overflow;
    };
  }, [onClose]);

  // 挂到 body 上:祖先元素将来加了 transform / backdrop-filter 也不会把 fixed 圈住(同 MobileMenu)
  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-[#121815]/40 md:hidden" onClick={onClose} />
      <aside
        aria-label="我的口播稿"
        className="fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] flex-col rounded-t-3xl bg-[var(--bg)] shadow-[0_-6px_24px_rgba(0,0,0,0.12)] md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[min(36rem,45vw)] md:rounded-none md:border-l md:border-[var(--line)] md:shadow-none"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--line)] px-5 py-3">
          <h2 className="flex-1 text-[15px] font-bold">我的口播稿</h2>
          <Link href={`/studio/s/${scriptId}`} className="text-sm font-medium text-[var(--accent)] hover:underline">
            去工作台排期 →
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[var(--muted)] hover:bg-[var(--row-line)]"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-3">
          <ScriptPanel id={scriptId} drawer autoGenerate={autoGenerate} />
          {refs.length > 0 && (
            <details className="mt-4 rounded-2xl bg-[var(--bg-raised)] p-4">
              <summary className="cursor-pointer text-[16px] font-bold">文章出处（{refs.length} 条）</summary>
              <ul className="mt-3 space-y-2 text-[14px] leading-relaxed">
                {refs.map((r) => (
                  <li key={r.url || r.label}>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline underline-offset-2">
                        {r.label}
                      </a>
                    ) : (
                      r.label
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <Toaster />
      </aside>
    </>,
    document.body,
  );
}
