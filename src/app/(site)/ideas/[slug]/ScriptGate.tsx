'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import ScriptBody from './ScriptBody';

type State = 'loading' | 'anon' | 'locked' | 'pending' | 'open';

/**
 * 口播稿正文(付费可见的那种)。
 *
 * 页面本身是静态生成的,正文一个字都不在 HTML 里 —— 所以不存在
 * 「查看源码就能看到」或者「被 CDN 缓存成公开页」这两种泄露。
 * 有权限的人在浏览器里带着自己的 token 去 /api/ideas 取,
 * 服务端确认权限后才把那段文字发过来。
 *
 * 四种落点:没登录 → 登录按钮;登录了没权限 → 申请表单;
 * 申请过了 → 等待开通;有权限 → 正文。
 */
export default function ScriptGate({ slug, code }: { slug: string; code: string }) {
  const [state, setState] = useState<State>('loading');
  const [script, setScript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = await browserSupabase();
        const { data } = (await sb?.auth.getSession()) ?? { data: null };
        const token = data?.session?.access_token;
        const res = await fetch(`/api/ideas?slug=${encodeURIComponent(slug)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = await res.json();
        if (cancelled) return;
        if (body?.idea?.script) {
          setScript(body.idea.script as string);
          setAudioUrl(body.idea.audioUrl as string | undefined);
          setState('open');
        } else if (!body?.signedIn) {
          setState('anon');
        } else if (body?.pending) {
          setState('pending');
        } else {
          setState('locked');
        }
      } catch {
        if (!cancelled) setState('anon');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state === 'loading') {
    return <div className="mt-10 h-32 animate-pulse rounded-2xl bg-[var(--row-line)]" />;
  }

  if (state === 'open') {
    return (
      <ScriptBody script={script} code={code} audioUrl={audioUrl}>
        打开「Fordexa 口播助手」，这条就在行业灵感里，点一下加到口播库就能录 ——
        不用复制粘贴。
      </ScriptBody>
    );
  }

  if (state === 'anon') {
    return (
      <section className="mt-10 rounded-2xl bg-[var(--accent-tint)] p-7">
        <h2 className="font-display mb-2 text-lg font-semibold">完整口播稿</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          这条写好了能直接念的口播稿，给 Fordexa 的客户。
          合作公司下的同事都能看 —— 用公司邮箱登录就行，不用一人一个账号。
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/ideas/${slug}`)}`}
          className="mt-5 inline-block rounded-xl bg-[var(--accent)] px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          登录后查看
        </Link>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          还不是客户？登录后可以直接申请开通。
        </p>
      </section>
    );
  }

  if (state === 'pending') {
    return (
      <section className="mt-10 rounded-2xl bg-[var(--accent-tint)] p-7">
        <h2 className="font-display mb-2 text-lg font-semibold">申请已收到</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          Fordexa 正在看。开通后会发邮件通知你，到时刷新这一页就能看到正文。
          急的话写信到{' '}
          <a className="text-[var(--accent)] hover:underline" href="mailto:info@fordexa.com">
            info@fordexa.com
          </a>
          。
        </p>
      </section>
    );
  }

  return <ApplyForm onDone={() => setState('pending')} />;
}

/** 登录了但没权限:就地申请,不用跳走。 */
function ApplyForm({ onDone }: { onDone: () => void }) {
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const input =
    'w-full rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]';

  const submit = async () => {
    if (!company.trim()) return setErr('公司名得填');
    setBusy(true);
    setErr('');
    try {
      const sb = await browserSupabase();
      const { data } = (await sb?.auth.getSession()) ?? { data: null };
      const token = data?.session?.access_token;
      if (!token) throw new Error('登录态过期了，刷新一下');
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ company, contact, note }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? '提交失败');
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl bg-[var(--accent-tint)] p-7">
      <h2 className="font-display mb-2 text-lg font-semibold">申请开通</h2>
      <p className="text-[15px] leading-relaxed text-[var(--muted)]">
        完整口播稿给 Fordexa 的客户。留下公司名，我们看过就开通，整家公司的人一起能看。
      </p>
      <div className="mt-5 space-y-3">
        <input
          className={input}
          placeholder="公司名"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <input
          className={input}
          placeholder="怎么联系你（微信 / 电话，可不填）"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <textarea
          className={`${input} min-h-[80px]`}
          placeholder="备注：做什么行业、想拍什么内容……（可不填）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {err && <p className="text-sm text-[#b3261e]">{err}</p>}
        <button
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={busy}
          onClick={submit}
        >
          提交申请
        </button>
      </div>
    </section>
  );
}
