'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import ScriptBody from './ScriptBody';
import PullButton from './PullButton';
import ApplyForm from '@/components/ApplyForm';
import type { Ref } from '@/lib/content';
import { openLogin } from '@/components/LoginDialog';

type State = 'loading' | 'anon' | 'locked' | 'pending' | 'open' | 'taken';

/**
 * 口播稿正文(付费可见的那种)。
 *
 * 页面本身是静态生成的,正文一个字都不在 HTML 里 —— 所以不存在
 * 「查看源码就能看到」或者「被 CDN 缓存成公开页」这两种泄露。
 * 有权限的人在浏览器里带着自己的 token 去 /api/ideas 取,
 * 服务端确认权限后才把那段文字发过来。
 *
 * 五种落点:没登录 → 登录按钮;登录了没权限 → 申请表单;
 * 申请过了 → 等待开通;有权限 → 正文;
 * 这份 Fordexa 稿已被别的合作公司用了 → 说明原因(一份稿子只给一家)。
 */
export default function ScriptGate({ slug, code, refs = [] }: { slug: string; code: string; refs?: Ref[] }) {
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
        } else if (body?.idea?.taken) {
          setState('taken');
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
      <>
        <ScriptBody script={script} code={code} audioUrl={audioUrl}>
          打开「Fordexa 口播助手」，这条就在行业灵感里，点一下加到口播库就能录 ——
          不用复制粘贴。
        </ScriptBody>
        <div className="mt-4">
          <PullButton code={code} refs={refs} />
        </div>
      </>
    );
  }

  if (state === 'anon') {
    return (
      <section className="mt-10 rounded-2xl bg-[var(--accent-tint)] p-7">
        <h2 className="font-display mb-2 text-lg font-semibold">完整口播稿</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          这条写好了能直接念的口播稿，给开通的 Fordexa 客户。
          开通后整家公司的人都能看，用公司邮箱登录就行，不用一人一个账号。
        </p>
        <Link
          href="/apply"
          className="mt-5 inline-block rounded-full bg-[var(--accent)] px-5 py-2.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          申请开通
        </Link>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          已经开通了？{' '}
          <button type="button" className="text-[var(--accent)] hover:underline" onClick={openLogin}>
            登录
          </button>
          就能看。
        </p>
      </section>
    );
  }

  if (state === 'taken') {
    return (
      <>
        <TakenNote />
        <div className="mt-4">
          <PullButton code={code} refs={refs} />
        </div>
      </>
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

/** 一份 Fordexa 稿只给一家合作公司用。文章和出处照常公开,想讲这个话题可以自己写 */
export function TakenNote() {
  return (
    <section className="mt-10 rounded-2xl bg-[var(--accent-tint)] p-7">
      <h2 className="font-display mb-2 text-lg font-semibold">这份口播稿已被其他合作公司使用</h2>
      <p className="text-[15px] leading-relaxed text-[var(--muted)]">
        为了不让两家公司讲出一模一样的内容，每份 Fordexa 口播稿只给一家用。
        上面的文章和参考出处照常可以看；想讲这个话题，可以在
        <Link className="mx-1 text-[var(--accent)] hover:underline" href="/studio/ideas">
          口播工作台
        </Link>
        里按你们自己的风格生成一份。
      </p>
    </section>
  );
}
