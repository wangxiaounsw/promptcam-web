import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: '登录 · Fordexa 口播助手',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-6 pb-24 pt-16">
      <p className="mb-4 text-xs font-semibold tracking-wide text-[var(--accent)]">登录</p>
      <h1 className="font-display text-3xl font-bold leading-[1.25]">
        用 App 里的邮箱登录
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
        和「Fordexa 口播助手」是同一个账号。用苹果登录的，先在 App 的「账户」里绑定一个邮箱。
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
