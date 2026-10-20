'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import LoginForm from '@/app/(site)/login/LoginForm';

const OPEN_EVENT = 'fordexa:login-open';

/** 在当前页弹出登录框(不跳去 /login)。网站任何地方都能调,弹窗由网站外壳里的 LoginDialog 接 */
export function openLogin(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * 登录弹窗:看文章看到一半要登录,不用离开这一页。
 * 登录成功后原地刷新 —— 页面上的口播稿、侧栏按钮、点赞都按新身份重新取。
 */
export default function LoginDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.isComposing && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#121815]/50 sm:items-center" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="登录"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-[var(--bg)] px-6 pb-8 pt-5 shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-center">
          <h2 className="font-display flex-1 text-xl font-bold">登录</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[var(--muted)] hover:bg-[var(--row-line)]"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
          用「Fordexa 口播助手」App 里的邮箱登录，登录完留在这一页。
        </p>
        <Suspense>
          <LoginForm onDone={() => window.location.reload()} />
        </Suspense>
        <p className="mt-2 text-center text-sm text-[var(--muted)]">
          还不是 Fordexa 的客户？
          <Link href="/apply" className="ml-1 font-medium text-[var(--accent)] hover:underline" onClick={() => setOpen(false)}>
            申请开通 →
          </Link>
        </p>
      </div>
    </div>,
    document.body,
  );
}
