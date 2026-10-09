'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

/**
 * 口播稿正文。
 *
 * 页面本身是静态生成的,正文一个字都不在 HTML 里 —— 所以不存在
 * 「查看源码就能看到」或者「被 CDN 缓存成公开页」这两种泄露。
 * 有权限的人在浏览器里带着自己的 token 去 /api/ideas 取,
 * 服务端确认权限后才把那段文字发过来。
 */
export default function ScriptGate({ slug, code }: { slug: string; code: string }) {
  const [state, setState] = useState<'loading' | 'locked' | 'open'>('loading');
  const [script, setScript] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetch('/api/admin/config').then((r) => r.json());
        if (!cfg.url || !cfg.key) throw new Error('no config');
        const sb = createClient(cfg.url, cfg.key);
        const { data } = await sb.auth.getSession();
        const token = data.session?.access_token;
        const res = await fetch(`/api/ideas?slug=${encodeURIComponent(slug)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = await res.json();
        if (cancelled) return;
        if (body?.idea?.script) {
          setScript(body.idea.script as string);
          setState('open');
        } else {
          setState('locked');
        }
      } catch {
        if (!cancelled) setState('locked');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state === 'loading') {
    return <div className="mt-10 h-32 animate-pulse rounded-xl bg-white/5" />;
  }

  if (state === 'open') {
    return (
      <section className="mt-10">
        <h2 className="font-display mb-4 text-sm font-semibold tracking-wide text-[var(--muted)]">
          口播稿 · {code}
        </h2>
        <div className="whitespace-pre-wrap rounded-xl border border-white/8 bg-[var(--bg-raised)] p-6 text-[17px] leading-[1.9]">
          {script}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          打开「Fordexa 口播助手」，这条就在行业灵感里，点一下加到口播库就能录。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.04] p-6">
      <h2 className="font-display mb-2 text-lg font-semibold">完整口播稿</h2>
      <p className="text-[15px] leading-relaxed text-[var(--muted)]">
        这条写好了能直接念的口播稿，给 Fordexa 的客户。
        合作公司下的同事都能看 —— 不用一人一个账号。
      </p>
      <p className="mt-5 text-[15px] leading-relaxed text-[var(--muted)]">
        想拿到的话写信到{' '}
        <a className="text-[var(--accent)] hover:underline" href="mailto:info@fordexa.com">
          info@fordexa.com
        </a>
        。已经是客户的话，在 App 里登录同一个邮箱就能看到。
      </p>
    </section>
  );
}
