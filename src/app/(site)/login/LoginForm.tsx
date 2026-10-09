'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { browserSupabase, safeNext } from '@/lib/browser-supabase';

const input =
  'w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]';
const primary =
  'w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50';

/**
 * 邮箱验证码为主,密码为辅。验证码不限制注册 —— 路人也可以先有个账号,
 * 登录后看到的是申请表单,那就是一条线索。
 */
export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));

  const [mode, setMode] = useState<'code' | 'password'>('code');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 已经登录的直接送走
  useEffect(() => {
    browserSupabase().then(async (sb) => {
      const { data } = (await sb?.auth.getSession()) ?? { data: null };
      if (data?.session) router.replace(next);
    });
  }, [router, next]);

  const friendly = (m: string) =>
    /rate limit/i.test(m)
      ? '发得太频繁了，等一分钟再试。'
      : /invalid login credentials/i.test(m)
        ? '邮箱或密码不对。'
        : /expired|invalid/i.test(m)
          ? '验证码不对或已过期。'
          : m;

  const sendCode = async () => {
    const sb = await browserSupabase();
    if (!sb) return setErr('服务暂时不可用');
    if (!email.includes('@')) return setErr('邮箱格式不对');
    setBusy(true);
    setErr('');
    const { error } = await sb.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    error ? setErr(friendly(error.message)) : setSent(true);
  };

  const verify = async () => {
    const sb = await browserSupabase();
    if (!sb) return;
    setBusy(true);
    setErr('');
    const { error } = await sb.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    router.replace(next);
  };

  const signInPassword = async () => {
    const sb = await browserSupabase();
    if (!sb) return;
    setBusy(true);
    setErr('');
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    router.replace(next);
  };

  return (
    <div className="mt-8 space-y-3">
      <input
        className={input}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="邮箱"
        value={email}
        disabled={sent}
        onChange={(e) => setEmail(e.target.value)}
      />

      {mode === 'code' && !sent && (
        <button className={primary} disabled={busy} onClick={sendCode}>
          发验证码
        </button>
      )}
      {mode === 'code' && sent && (
        <>
          <input
            className={input}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="邮件里的验证码"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verify()}
          />
          <button className={primary} disabled={busy} onClick={verify}>
            登录
          </button>
          <button
            className="w-full py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={() => {
              setSent(false);
              setCode('');
            }}
          >
            换个邮箱 / 重发
          </button>
        </>
      )}

      {mode === 'password' && (
        <>
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && signInPassword()}
          />
          <button className={primary} disabled={busy} onClick={signInPassword}>
            登录
          </button>
        </>
      )}

      {err && <p className="text-sm text-[#b3261e]">{err}</p>}

      <button
        className="w-full py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        onClick={() => {
          setMode(mode === 'code' ? 'password' : 'code');
          setErr('');
          setSent(false);
        }}
      >
        {mode === 'code' ? '用密码登录' : '用验证码登录'}
      </button>
    </div>
  );
}
