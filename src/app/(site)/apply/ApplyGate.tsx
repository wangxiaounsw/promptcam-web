'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import ApplyForm from '@/components/ApplyForm';

type State = 'loading' | 'anon' | 'form' | 'pending' | 'client';

/** /apply 的四种落点:没登录 → 先登录;登录了 → 表单;交过了 → 等;已是客户 → 去口播库 */
export default function ApplyGate() {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = await browserSupabase();
        const { data } = (await sb?.auth.getSession()) ?? { data: null };
        const token = data?.session?.access_token;
        const r = await fetch('/api/access-requests', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const b = await r.json();
        if (cancelled) return;
        if (!b.signedIn) setState('anon');
        else if (b.allowed) setState('client');
        else if (b.pending) setState('pending');
        else setState('form');
      } catch {
        if (!cancelled) setState('anon');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const box = 'mt-10 rounded-2xl bg-[var(--accent-tint)] p-7';
  const btn = 'mt-5 inline-block rounded-xl bg-[var(--accent)] px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90';

  if (state === 'loading') return <div className="mt-10 h-32 animate-pulse rounded-2xl bg-[var(--row-line)]" />;

  if (state === 'anon') {
    return (
      <section className={box}>
        <h2 className="font-display mb-2 text-lg font-semibold">先登录，再填一张表</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          用你的工作邮箱登录（收一封验证码邮件就行，不用设密码）。登录后留下公司名，我们看过就开通，整家公司的人一起能用。
        </p>
        <Link href="/login?next=%2Fapply" className={btn}>登录</Link>
      </section>
    );
  }
  if (state === 'client') {
    return (
      <section className={box}>
        <h2 className="font-display mb-2 text-lg font-semibold">你已经是 Fordexa 客户了</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">口播库里的完整稿子和朗读都对你开放，打开 App 就能录。</p>
        <Link href="/ideas" className={btn}>去口播库</Link>
      </section>
    );
  }
  if (state === 'pending') {
    return (
      <section className={box}>
        <h2 className="font-display mb-2 text-lg font-semibold">申请已收到</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          Fordexa 正在看，开通后会发邮件通知你。急的话写信到{' '}
          <a className="text-[var(--accent)] hover:underline" href="mailto:info@fordexa.com">info@fordexa.com</a>。
        </p>
      </section>
    );
  }
  return <ApplyForm intro="留下公司名和联系方式，我们看过就开通。开通后选题、口播稿、朗读、剪辑发布都包含在服务里。" onDone={() => setState('pending')} />;
}
