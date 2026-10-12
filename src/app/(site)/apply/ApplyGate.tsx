'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import ApplyForm from '@/components/ApplyForm';

type State = 'form' | 'done' | 'client';

/** /apply:不用登录,直接填表;已是客户的人进来就送去口播库 */
export default function ApplyGate() {
  const [state, setState] = useState<State>('form');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = await browserSupabase();
        const { data } = (await sb?.auth.getSession()) ?? { data: null };
        const token = data?.session?.access_token;
        if (!token) return;
        const b = await fetch('/api/access-requests', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
        if (!cancelled && b.allowed) setState('client');
      } catch {
        /* 查不到就当路人 */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === 'client') {
    return (
      <section className="mt-10 rounded-2xl bg-[var(--accent-tint)] p-7">
        <h2 className="font-display mb-2 text-lg font-semibold">你已经是 Fordexa 客户了</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">口播库里的完整稿子和朗读都对你开放，打开 App 就能录。</p>
        <Link href="/ideas" className="mt-5 inline-block rounded-full bg-[var(--accent)] px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90">去口播库</Link>
      </section>
    );
  }
  if (state === 'done') {
    return (
      <section className="mt-10 rounded-2xl bg-[var(--accent-tint)] p-7">
        <h2 className="font-display mb-2 text-lg font-semibold">收到了</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          我们会回信到你留的邮箱，聊聊你这行适合讲什么。等不及的话直接写{' '}
          <a className="text-[var(--accent)] hover:underline" href="mailto:info@fordexa.com">info@fordexa.com</a>。
        </p>
      </section>
    );
  }
  return <ApplyForm intro="留下公司、行业和邮箱，我们会联系你。开通后选题、口播稿、朗读、剪辑发布都包含在服务里。" onDone={() => setState('done')} />;
}
