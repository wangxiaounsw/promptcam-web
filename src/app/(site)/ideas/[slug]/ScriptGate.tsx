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
  const [copied, setCopied] = useState(false);

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
    return <div className="mt-10 h-32 animate-pulse rounded-2xl bg-[var(--row-line)]" />;
  }

  if (state === 'open') {
    // 口播稿按空行分段显示 —— 整块灰字读起来像合同,念的人需要换气的地方
    const paras = script.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const chars = script.replace(/\s/g, '').length;
    const secs = Math.max(10, Math.ceil(chars / 4 / 10) * 10);
    const length =
      secs < 60
        ? `约 ${secs} 秒`
        : secs % 60 === 0
          ? `约 ${Math.floor(secs / 60)} 分钟`
          : `约 ${Math.floor(secs / 60)} 分 ${secs % 60} 秒`;

    return (
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-sm font-semibold tracking-wide text-[var(--muted)]">
            口播稿 · {code}
          </h2>
          <span className="text-xs text-[var(--muted)]">
            {chars} 字 · 念完{length}
          </span>
          <div className="flex-1" />
          <button
            className="rounded-lg bg-[var(--accent-tint)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(script);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* 浏览器不给剪贴板权限时静默,用户还能自己选中复制 */
              }
            }}
          >
            {copied ? '已复制' : '复制全文'}
          </button>
        </div>
        <div className="rounded-2xl bg-[var(--bg-raised)] p-7">
          {paras.map((p, i) => (
            <p
              key={i}
              className="whitespace-pre-wrap text-[17px] leading-[1.95] text-[var(--ink)]"
              style={{ marginTop: i === 0 ? 0 : '1.25rem' }}
            >
              {p}
            </p>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          打开「Fordexa 口播助手」，这条就在行业灵感里，点一下加到口播库就能录 ——
          不用复制粘贴。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-2xl bg-[var(--accent-tint)] p-7">
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
