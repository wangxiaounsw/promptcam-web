'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

/** 浏览器端只拿 publishable key 做登录；所有数据操作都走 /api/admin/*，
 *  由服务端用 service_role 执行并校验 is_admin。
 *  这两个公开值从 /api/admin/config 取，免得在 Vercel 把同一组值配两遍。 */

type Client = {
  id: string;
  email: string;
  display_name: string | null;
  industry: string | null;
  is_fordexa_client: boolean;
  is_admin: boolean;
  live_seconds_remaining: number;
  created_at: string;
  scripts_total: number;
  scripts_recorded: number;
};

type Script = {
  id: string;
  title: string;
  body: string;
  source: 'fordexa' | 'self';
  status: 'ready' | 'recorded' | 'archived';
  created_at: string;
};

const card =
  'rounded-xl border border-white/10 bg-[var(--bg-raised)] p-4';
const input =
  'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--accent)]';
const btn =
  'rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-40';
const btnGhost =
  'rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-40';

export default function AdminPage() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [configMissing, setConfigMissing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  // 登录表单
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 数据
  const [clients, setClients] = useState<Client[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then(async (d: { url?: string; key?: string }) => {
        if (cancelled) return;
        if (!d.url || !d.key) {
          setConfigMissing(true);
          setBooting(false);
          return;
        }
        const client = createClient(d.url, d.key);
        setSupabase(client);
        const { data } = await client.auth.getSession();
        if (cancelled) return;
        setToken(data.session?.access_token ?? null);
        setBooting(false);
      })
      .catch(() => {
        if (cancelled) return;
        setConfigMissing(true);
        setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`/api/admin/${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${token}`,
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body;
    },
    [token],
  );

  const loadClients = useCallback(async () => {
    try {
      const d = await api('clients');
      setClients(d.clients ?? []);
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    if (token) loadClients();
  }, [token, loadClients]);

  const loadScripts = useCallback(
    async (userId: string) => {
      try {
        const d = await api(`scripts?userId=${userId}`);
        setScripts(d.scripts ?? []);
      } catch (e) {
        setErr((e as Error).message);
      }
    },
    [api],
  );

  // ── 登录 ──
  const sendCode = async () => {
    if (!supabase || !email.includes('@')) return setErr('邮箱格式不对');
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false }, // 后台不开放注册
    });
    setBusy(false);
    error ? setErr(error.message) : setSent(true);
  };

  const verify = async () => {
    if (!supabase) return;
    setBusy(true);
    setErr('');
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setToken(data.session?.access_token ?? null);
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setToken(null);
    setClients([]);
    setPicked(null);
  };

  // ── 客户操作 ──
  const patchClient = async (id: string, patch: Partial<Client>) => {
    try {
      await api('clients', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
      await loadClients();
      setNote('已保存');
      setTimeout(() => setNote(''), 1500);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const addScript = async () => {
    if (!picked || !newTitle.trim() || !newBody.trim()) return;
    try {
      await api('scripts', {
        method: 'POST',
        body: JSON.stringify({
          userId: picked,
          items: [{ title: newTitle, body: newBody }],
        }),
      });
      setNewTitle('');
      setNewBody('');
      await Promise.all([loadScripts(picked), loadClients()]);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const delScript = async (id: string) => {
    if (!picked || !confirm('删除这条稿子？')) return;
    try {
      await api(`scripts?id=${id}`, { method: 'DELETE' });
      await Promise.all([loadScripts(picked), loadClients()]);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const toggleRecorded = async (s: Script) => {
    if (!picked) return;
    try {
      await api('scripts', {
        method: 'PATCH',
        body: JSON.stringify({
          id: s.id,
          status: s.status === 'recorded' ? 'ready' : 'recorded',
        }),
      });
      await Promise.all([loadScripts(picked), loadClients()]);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  // ── 渲染 ──
  if (booting) return <main className="p-10 text-[var(--muted)]">…</main>;

  if (configMissing || !supabase) {
    return (
      <main className="mx-auto max-w-lg p-10">
        <div className={card}>
          读不到 Supabase 配置。检查 Vercel 的 SUPABASE_URL /
          SUPABASE_PUBLISHABLE_KEY 是否已配，以及改完有没有 Redeploy。
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-sm p-8">
        <h1 className="font-display mb-1 text-2xl font-bold">Fordexa 后台</h1>
        <p className="mb-6 text-sm leading-relaxed text-[var(--muted)]">
          用你在 App 里登录的那个邮箱收验证码。只有被标为管理员的账号能进 ——
          后台不开放注册。
        </p>
        <div className="space-y-3">
          <input
            className={input}
            placeholder="you@example.com"
            value={email}
            disabled={sent}
            onChange={(e) => setEmail(e.target.value)}
          />
          {sent && (
            <input
              className={input}
              placeholder="邮件里的 6 位验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
            />
          )}
          <button
            className={btn}
            disabled={busy}
            onClick={sent ? verify : sendCode}
          >
            {busy ? '…' : sent ? '登录' : '发送验证码'}
          </button>
          {sent && (
            <button className={btnGhost} onClick={() => setSent(false)}>
              换个邮箱
            </button>
          )}
          {err && <p className="text-sm text-[var(--record)]">{err}</p>}
          {sent && (
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              收到的邮件里只有链接、没有 6 位验证码？那是 Supabase 默认的
              Magic Link 模板 —— 去 Dashboard → Authentication → Emails
              在模板里加一行 {"{{ .Token }}"} 就会带验证码。
            </p>
          )}
        </div>
      </main>
    );
  }

  const cur = clients.find((c) => c.id === picked);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Fordexa 后台</h1>
        <span className="text-sm text-[var(--accent)]">{note}</span>
        <div className="flex-1" />
        <button className={btnGhost} onClick={loadClients}>刷新</button>
        <button className={btnGhost} onClick={signOut}>退出</button>
      </header>
      {err && (
        <p className="mb-4 rounded-lg border border-[var(--record)]/40 p-3 text-sm text-[var(--record)]">
          {err}
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* 客户列表 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)]">
            账号 {clients.length} 个（新注册的在这里标成客户）
          </h2>
          {clients.map((c) => (
            <div
              key={c.id}
              className={`${card} cursor-pointer ${
                picked === c.id ? 'border-[var(--accent)]' : ''
              }`}
              onClick={() => {
                setPicked(c.id);
                loadScripts(c.id);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{c.email || c.id.slice(0, 8)}</span>
                {c.is_admin && (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">ADMIN</span>
                )}
                <div className="flex-1" />
                <span className="text-xs text-[var(--muted)]">
                  {c.scripts_recorded}/{c.scripts_total} 已录
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <label
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={c.is_fordexa_client}
                    onChange={(e) =>
                      patchClient(c.id, { is_fordexa_client: e.target.checked })
                    }
                  />
                  <span className={c.is_fordexa_client ? 'text-[var(--accent)]' : ''}>
                    Fordexa 客户
                  </span>
                </label>
                <input
                  className="w-28 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
                  placeholder="行业"
                  defaultValue={c.industry ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) =>
                    e.target.value !== (c.industry ?? '') &&
                    patchClient(c.id, { industry: e.target.value })
                  }
                />
                <span className="text-xs text-[var(--muted)]">
                  配额 {Math.round(c.live_seconds_remaining / 60)} 分
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* 脚本面板 */}
        <section className="space-y-3">
          {!cur ? (
            <div className={`${card} text-[var(--muted)]`}>
              左边选一个客户，给他下发选题。
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)]">
                {cur.email} 的稿子
                {!cur.is_fordexa_client && (
                  <span className="ml-2 text-[var(--record)]">
                    ⚠️ 还没标成客户，他没有语音权限
                  </span>
                )}
              </h2>

              <div className={`${card} space-y-2`}>
                <input
                  className={input}
                  placeholder="标题（客户在列表上看到的）"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <textarea
                  className={`${input} min-h-[160px] leading-relaxed`}
                  placeholder="口播正文。客户举起手机照着念这段。"
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                />
                <button
                  className={btn}
                  disabled={!newTitle.trim() || !newBody.trim()}
                  onClick={addScript}
                >
                  下发给 {cur.email}
                </button>
              </div>

              {scripts.map((s) => (
                <div key={s.id} className={card}>
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.title}</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                      {s.source === 'fordexa' ? '下发' : '自写'}
                    </span>
                    {s.status === 'recorded' && (
                      <span className="rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] text-[var(--accent)]">
                        已录
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-[var(--muted)]">
                    {s.body}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button className={btnGhost} onClick={() => toggleRecorded(s)}>
                      {s.status === 'recorded' ? '标为待录' : '标为已录'}
                    </button>
                    <button className={btnGhost} onClick={() => delScript(s.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
