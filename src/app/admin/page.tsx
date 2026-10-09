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

type Industry = { key: string; name_zh: string; name_en: string };

type BankIdea = {
  id: string;
  industry: string | null;
  title: string;
  sort_order: number;
  is_active: boolean;
};

type IdeaRequest = {
  id: string;
  user_id: string;
  email: string;
  source: 'bank' | 'own';
  body: string;
  note: string | null;
  status: 'submitted' | 'in_progress' | 'delivered' | 'declined';
  reply: string | null;
  script_id: string | null;
  created_at: string;
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
  /** 发信/webhook 配好了没。没配好要在后台说出来,否则你以为客户收到了 */
  const [mailReady, setMailReady] = useState(true);
  const [hookReady, setHookReady] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  // 登录表单
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  /** 默认走密码：Supabase 默认的邮件模板里没有 {{ .Token }}，
   *  收到的邮件只有链接、没有能填进来的 6 位码，所以验证码那条路
   *  在模板改好之前是走不通的。 */
  const [usePassword, setUsePassword] = useState(true);
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

  // ── 视图 / 选题库 / 队列 ──
  const [view, setView] = useState<'clients' | 'bank' | 'queue'>('clients');
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [bank, setBank] = useState<BankIdea[]>([]);
  /** 一行一条 —— 写选题是一口气列十几条，不该一条一条点保存 */
  const [bankText, setBankText] = useState('');
  const [bankIndustry, setBankIndustry] = useState('');
  /** 选题库的行业筛选：'' = 全部，'__none__' = 通用 */
  const [bankFilter, setBankFilter] = useState('');
  const [requests, setRequests] = useState<IdeaRequest[]>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [writing, setWriting] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then(async (d: { url?: string; key?: string; mail?: boolean; hook?: boolean }) => {
        if (cancelled) return;
        setMailReady(d.mail !== false);
        setHookReady(d.hook !== false);
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

  const loadIndustries = useCallback(async () => {
    try {
      const d = await api('industries');
      setIndustries(d.industries ?? []);
    } catch {
      /* 下拉框读不到就退回只读显示，不挡住别的操作 */
    }
  }, [api]);

  const loadBank = useCallback(async () => {
    try {
      const d = await api('bank');
      setBank(d.bank ?? []);
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api]);

  const loadRequests = useCallback(async () => {
    try {
      const d = await api(`requests${openOnly ? '?open=1' : ''}`);
      setRequests(d.requests ?? []);
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api, openOnly]);

  useEffect(() => {
    if (!token) return;
    loadClients();
    loadIndustries();
    // 两个数字要直接显示在标签上,所以一进来就各读一次
    loadRequests();
    loadBank();
  }, [token, loadClients, loadIndustries, loadRequests, loadBank]);

  useEffect(() => {
    if (!token) return;
    if (view === 'queue') loadRequests();
  }, [token, view, loadRequests]);

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

  const signInPassword = async () => {
    if (!supabase) return;
    setBusy(true);
    setErr('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setToken(data.session?.access_token ?? null);
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

  // ── 选题库 ──
  const bankLines = bankText
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  const publishBank = async () => {
    if (!bankLines.length) return;
    try {
      const d = await api('bank', {
        method: 'POST',
        body: JSON.stringify({ titles: bankLines, industry: bankIndustry || null }),
      });
      setBankText('');
      setNote(`已发布 ${d.inserted} 条`);
      setTimeout(() => setNote(''), 2500);
      await loadBank();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  /** 上下移动:和相邻那条换 sort_order。同一行业内才有意义。 */
  const moveBank = async (b: BankIdea, dir: -1 | 1) => {
    const peers = bank.filter((x) => (x.industry ?? '') === (b.industry ?? ''));
    const i = peers.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= peers.length) return;
    const other = peers[j];
    try {
      await Promise.all([
        api('bank', {
          method: 'PATCH',
          body: JSON.stringify({ id: b.id, sort_order: other.sort_order }),
        }),
        api('bank', {
          method: 'PATCH',
          body: JSON.stringify({ id: other.id, sort_order: b.sort_order }),
        }),
      ]);
      await loadBank();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const patchBank = async (id: string, patch: Partial<BankIdea>) => {
    try {
      await api('bank', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
      await loadBank();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const delBank = async (id: string) => {
    if (!confirm('删除这条选题？已经提交过它的记录会保留（正文当时抄了一份）。')) return;
    try {
      await api(`bank?id=${id}`, { method: 'DELETE' });
      await loadBank();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  // ── 待处理队列 ──
  const patchRequest = async (id: string, patch: Partial<IdeaRequest>) => {
    try {
      await api('requests', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
      await loadRequests();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const deliver = async (id: string) => {
    if (!draftTitle.trim() || !draftBody.trim()) return;
    try {
      const d = await api('requests', {
        method: 'POST',
        body: JSON.stringify({ id, title: draftTitle, body: draftBody }),
      });
      setWriting(null);
      setDraftTitle('');
      setDraftBody('');
      // 发信成败要说清楚:稿子一定进去了,但邮件不一定发出去
      setNote(d.mailed ? '已送达，提醒邮件已发出' : '已送达（提醒邮件没发出）');
      setTimeout(() => setNote(''), 4000);
      await Promise.all([loadRequests(), loadClients()]);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const industryName = (key: string | null) =>
    key ? (industries.find((i) => i.key === key)?.name_zh ?? key) : '通用';

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
          {usePassword ? (
            <input
              className={input}
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signInPassword()}
            />
          ) : (
            sent && (
              <input
                className={input}
                placeholder="邮件里的 6 位验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
              />
            )
          )}
          <button
            className={btn}
            disabled={busy}
            onClick={
              usePassword ? signInPassword : sent ? verify : sendCode
            }
          >
            {busy ? '…' : usePassword ? '登录' : sent ? '登录' : '发送验证码'}
          </button>
          <button
            className={btnGhost}
            onClick={() => {
              setUsePassword(!usePassword);
              setErr('');
              setSent(false);
            }}
          >
            {usePassword ? '改用邮箱验证码' : '改用密码'}
          </button>
          {!usePassword && sent && (
            <button className={btnGhost} onClick={() => setSent(false)}>
              换个邮箱
            </button>
          )}
          {err && <p className="text-sm text-[var(--record)]">{err}</p>}
          {!usePassword && sent && (
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
  const openQueue = requests.filter(
    (r) => r.status === 'submitted' || r.status === 'in_progress',
  ).length;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Fordexa 后台</h1>
        <span className="text-sm text-[var(--accent)]">{note}</span>
        <div className="flex-1" />
        <button
          className={btnGhost}
          onClick={
            view === 'bank' ? loadBank : view === 'queue' ? loadRequests : loadClients
          }
        >
          刷新
        </button>
        <button className={btnGhost} onClick={signOut}>退出</button>
      </header>

      <nav className="mb-5 flex gap-2">
        {([
          ['clients', `客户 ${clients.length}`],
          ['bank', `选题库 ${bank.length || ''}`],
          ['queue', `待处理 ${openQueue || ''}`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              view === k
                ? 'bg-[var(--accent)] font-medium text-black'
                : 'border border-white/15 text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => setView(k)}
          >
            {label}
          </button>
        ))}
      </nav>
      {err && (
        <p className="mb-4 rounded-lg border border-[var(--record)]/40 p-3 text-sm text-[var(--record)]">
          {err}
        </p>
      )}
      {(!mailReady || !hookReady) && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm leading-relaxed text-amber-200/90">
          {!mailReady && (
            <>
              <strong>发信没配好</strong>：下发稿子时客户收不到提醒邮件。
              去 Vercel 配 MAIL_FROM 和 RESEND_API_KEY，然后 Redeploy。
            </>
          )}
          {!mailReady && !hookReady && <br />}
          {!hookReady && (
            <>
              <strong>提交通知没配好</strong>：客户提交灵感时你不会收到邮件，
              得自己来这页看。配 HOOK_SECRET + Supabase Database Webhook。
            </>
          )}
        </p>
      )}

      {view === 'bank' && (
        <section className="space-y-5">
          <div className={`${card} space-y-3`}>
            <div>
              <h2 className="font-display text-lg font-semibold">发布选题</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                一行一条。客户在 App 的「行业灵感」里看到这些，点一下就变成一条提交，
                进到你的待处理队列。行业留空 = 所有客户都看得到。
              </p>
            </div>
            <textarea
              className={`${input} min-h-[140px] leading-relaxed`}
              placeholder={'父母团聚签证到底要等多久\n收据到底要留多久\n请会计之前，先问自己三个问题'}
              value={bankText}
              onChange={(e) => setBankText(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                value={bankIndustry}
                onChange={(e) => setBankIndustry(e.target.value)}
              >
                <option value="">通用（所有客户）</option>
                {industries.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.name_zh}
                  </option>
                ))}
              </select>
              <button className={btn} disabled={!bankLines.length} onClick={publishBank}>
                发布 {bankLines.length || ''} 条
              </button>
              {!industries.length && (
                <span className="text-xs text-[var(--record)]">
                  行业字典读不到 —— 003_industries.sql 跑了吗？
                </span>
              )}
            </div>
          </div>

          {/* 行业筛选 */}
          <div className="flex flex-wrap gap-2">
            {[
              ['', `全部 ${bank.length}`],
              ['__none__', `通用 ${bank.filter((b) => !b.industry).length}`],
              ...industries.map(
                (i) =>
                  [i.key, `${i.name_zh} ${bank.filter((b) => b.industry === i.key).length}`] as const,
              ),
            ].map(([k, label]) => (
              <button
                key={k || 'all'}
                className={`rounded-full px-3 py-1 text-xs ${
                  bankFilter === k
                    ? 'bg-[var(--accent)] font-medium text-black'
                    : 'border border-white/15 text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                onClick={() => setBankFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>

          {(() => {
            const shown = bank.filter((b) =>
              bankFilter === ''
                ? true
                : bankFilter === '__none__'
                  ? !b.industry
                  : b.industry === bankFilter,
            );
            if (!shown.length) {
              return (
                <div className={`${card} text-[var(--muted)]`}>
                  这里还没有选题。客户打开「行业灵感」会看到
                  「这个行业的选题还在准备中」。
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {shown.map((b) => (
                  <div key={b.id} className={`${card} flex items-start gap-3 py-3`}>
                    <span className="mt-0.5 shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                      {industryName(b.industry)}
                    </span>
                    {/* 点标题就能改，失焦保存 */}
                    <input
                      className={`flex-1 bg-transparent outline-none ${
                        b.is_active ? '' : 'text-[var(--muted)] line-through'
                      }`}
                      defaultValue={b.title}
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        e.target.value !== b.title &&
                        patchBank(b.id, { title: e.target.value.trim() })
                      }
                    />
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        className={btnGhost}
                        title="上移"
                        onClick={() => moveBank(b, -1)}
                      >
                        ↑
                      </button>
                      <button
                        className={btnGhost}
                        title="下移"
                        onClick={() => moveBank(b, 1)}
                      >
                        ↓
                      </button>
                      <button
                        className={btnGhost}
                        onClick={() => patchBank(b.id, { is_active: !b.is_active })}
                      >
                        {b.is_active ? '下架' : '上架'}
                      </button>
                      <button className={btnGhost} onClick={() => delBank(b.id)}>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {view === 'queue' && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)]">
              客户提交的灵感，先提交的排前面
            </h2>
            <label className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
              />
              只看没写完的
            </label>
          </div>

          {!requests.length && (
            <div className={`${card} text-[var(--muted)]`}>
              没有待处理的提交。
            </div>
          )}
          {requests.map((r) => (
            <div key={r.id} className={card}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                  {r.source === 'bank' ? '选题库' : '自己记的'}
                </span>
                <span className="text-sm text-[var(--muted)]">{r.email}</span>
                <div className="flex-1" />
                <span className="text-xs text-[var(--muted)]">
                  {new Date(r.created_at).toLocaleDateString('zh-CN')}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    r.status === 'delivered'
                      ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                      : 'bg-white/10'
                  }`}
                >
                  {r.status === 'submitted'
                    ? '等接收'
                    : r.status === 'in_progress'
                      ? '写稿中'
                      : r.status === 'delivered'
                        ? '已送达'
                        : '不做'}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{r.body}</p>
              {r.note && (
                <p className="mt-2 border-l-2 border-white/15 pl-3 text-sm text-[var(--muted)]">
                  补充：{r.note}
                </p>
              )}

              {writing === r.id ? (
                <div className="mt-3 space-y-2">
                  <input
                    className={input}
                    placeholder="稿子标题"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                  />
                  <textarea
                    className={`${input} min-h-[200px] leading-relaxed`}
                    placeholder="口播正文。客户举起手机照着念这段。"
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className={btn}
                      disabled={!draftTitle.trim() || !draftBody.trim()}
                      onClick={() => deliver(r.id)}
                    >
                      下发并标成已完成
                    </button>
                    <button className={btnGhost} onClick={() => setWriting(null)}>
                      收起
                    </button>
                  </div>
                </div>
              ) : (
                r.status !== 'delivered' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={btnGhost}
                      onClick={() => {
                        setWriting(r.id);
                        setDraftTitle(r.body.slice(0, 30));
                        setDraftBody('');
                      }}
                    >
                      写稿
                    </button>
                    {r.status === 'submitted' && (
                      <button
                        className={btnGhost}
                        onClick={() => patchRequest(r.id, { status: 'in_progress' })}
                      >
                        标成写稿中
                      </button>
                    )}
                    <button
                      className={btnGhost}
                      onClick={() => {
                        const reply = prompt('给客户一句说明（可留空）：', r.reply ?? '');
                        if (reply === null) return;
                        patchRequest(r.id, { status: 'declined', reply });
                      }}
                    >
                      这条不做
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </section>
      )}

      <div
        className={`grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] ${
          view === 'clients' ? '' : 'hidden'
        }`}
      >
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
                {/* 行业是外键，手打会被数据库拒；下拉框从 industries 表来 */}
                <select
                  className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
                  value={c.industry ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => patchClient(c.id, { industry: e.target.value })}
                >
                  <option value="">行业未设</option>
                  {industries.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.name_zh}
                    </option>
                  ))}
                </select>
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
