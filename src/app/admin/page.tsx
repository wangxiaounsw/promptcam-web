'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState, useRef } from 'react';

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
  org_id: string | null;
  live_seconds_remaining: number;
  created_at: string;
  scripts_total: number;
  scripts_recorded: number;
};

type Industry = { key: string; name_zh: string; name_en: string };

type Ref = { label: string; url: string };

type BankIdea = {
  id: string;
  code: string | null;
  industry: string | null;
  title: string;
  slug: string | null;
  summary: string | null;
  refs: Ref[];
  script: string | null;
  sort_order: number;
  is_active: boolean;
  is_published: boolean;
  is_free: boolean;
  audio_url: string | null;
  audio_script_hash: string | null;
  audio_at: string | null;
  audio_stale: boolean;
  tags: string[];
  source_url: string | null;
  source_kind: string | null;
};

type AccessRequest = {
  id: string;
  user_id: string;
  email: string;
  company: string;
  contact: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'declined';
  reply: string | null;
  created_at: string;
};

type Org = {
  id: string;
  name: string;
  industry: string | null;
  is_active: boolean;
  note: string | null;
  style_prompt: string | null;
  style_samples: string | null;
  email_domains: string[];
  members: number;
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
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [newOrg, setNewOrg] = useState('');
  const [applies, setApplies] = useState<AccessRequest[]>([]);
  /** 正在展开编辑的那条选题 */
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [note, setNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 底部一条绿色提示,两秒半自己消失;连着点会刷新计时而不是叠加
  const toast = (text: string) => {
    setNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 2500);
  };

  // ── 视图 / 选题库 / 队列 ──
  const [view, setView] =
    useState<'clients' | 'bank' | 'queue' | 'orgs' | 'applies' | 'prompt'>(
      'clients',
    );
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
  const [drafting, setDrafting] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');

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

  const loadSettings = useCallback(async () => {
    try {
      const d = await api('settings');
      setPromptText((d.draftPrompt as string) || (d.defaultPrompt as string) || '');
      setDefaultPrompt((d.defaultPrompt as string) ?? '');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api]);

  const savePrompt = async () => {
    try {
      await api('settings', {
        method: 'PUT',
        body: JSON.stringify({ draftPrompt: promptText }),
      });
      setNote('提示词已保存，下次起草稿就用新的');
      setTimeout(() => setNote(''), 3000);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const loadApplies = useCallback(async () => {
    try {
      const d = await api('access-requests');
      setApplies(d.requests ?? []);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api]);

  /** 通过 = 建/复用公司 + 挂人 + 开通公司 + 本人标成客户,四件事一起做 */
  const handleApply = async (r: AccessRequest, approve: boolean) => {
    const reply = approve
      ? undefined
      : prompt('给他一句说明（可留空）：', r.reply ?? '');
    if (!approve && reply === null) return;
    try {
      const d = await api('access-requests', {
        method: 'POST',
        body: JSON.stringify({ id: r.id, approve, reply }),
      });
      setNote(
        approve
          ? d.mailed
            ? '已开通，通知邮件已发出'
            : '已开通（通知邮件没发出）'
          : '已拒绝',
      );
      setTimeout(() => setNote(''), 4000);
      await Promise.all([loadApplies(), loadClients(), loadOrgs()]);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const loadOrgs = useCallback(async () => {
    try {
      const d = await api('orgs');
      setOrgs(d.orgs ?? []);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api]);

  const addOrg = async () => {
    if (!newOrg.trim()) return;
    try {
      await api('orgs', { method: 'POST', body: JSON.stringify({ name: newOrg }) });
      setNewOrg('');
      await loadOrgs();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const patchOrg = async (id: string, patch: Partial<Org>) => {
    try {
      await api('orgs', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
      await Promise.all([loadOrgs(), loadClients()]);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

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
    loadOrgs();
    loadApplies();
    loadSettings();
  }, [
    token,
    loadClients,
    loadIndustries,
    loadRequests,
    loadBank,
    loadOrgs,
    loadApplies,
    loadSettings,
  ]);

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

  /**
   * 先改界面再发请求。数据库在孟买,一个来回几百毫秒,
   * 点了没反应会让人再点一次。失败了再把列表拉回来、报错。
   */
  const patchBank = async (
    id: string,
    patch: Partial<BankIdea> & { refs?: Ref[] },
  ): Promise<boolean> => {
    setBank((cur) => cur.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    try {
      const d = await api('bank', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
      if (d.idea) setBank((cur) => cur.map((b) => (b.id === id ? { ...b, ...d.idea } : b)));
      toast(
        patch.is_published === true
          ? '已发布到网站'
          : patch.is_published === false
            ? '已从网站撤下'
            : patch.is_free === true
              ? '已设为免费样稿，网站上不登录就能看'
              : patch.is_free === false
                ? '已取消免费样稿'
                : '已保存',
      );
      return true;
    } catch (e) {
      setErr((e as Error).message);
      await loadBank();
      return false;
    }
  };

  const [voicing, setVoicing] = useState<string | null>(null);
  const makeAudio = async (id: string, force = false) => {
    setVoicing(id);
    setErr('');
    try {
      const d = await api('bank/audio', { method: 'POST', body: JSON.stringify({ id, force }) });
      await loadBank();
      toast(d.reused ? '稿子没改，用的还是上次那条' : '念好了，网站上已经能听');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setVoicing(null);
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

  /** 起草稿。失败时把服务端的话原样显示 —— 「生成失败」四个字帮不上忙。 */
  const makeDraft = async (
    title: string,
    orgId: string,
    industry: string | null,
    note: string,
  ): Promise<string | null> => {
    try {
      const d = await api('draft', {
        method: 'POST',
        body: JSON.stringify({ title, orgId: orgId || undefined, industry, note }),
      });
      setErr('');
      return (d.draft as string) ?? null;
    } catch (e) {
      setErr((e as Error).message);
      return null;
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
                placeholder="邮件里的验证码"
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
              收到的邮件里只有链接、没有验证码？那是 Supabase 默认的
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
  const pendingApplies = applies.filter((a) => a.status === 'pending').length;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Fordexa 后台</h1>
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
          ['orgs', `公司 ${orgs.length || ''}`],
          ['applies', `申请 ${pendingApplies || ''}`],
          ['prompt', '提示词'],
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
                  <div key={b.id} className={`${card} py-3`}>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 shrink-0 font-mono text-[11px] text-[var(--muted)]">
                        {b.code ?? '—'}
                      </span>
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
                      {b.source_kind === 'pipeline' && (
                        <span
                          className="shrink-0 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-300"
                          title="选题管线自动起草的，发布前看一遍数字和出处"
                        >
                          管线
                        </span>
                      )}
                      {b.is_published && (
                        <a
                          href={`/ideas/${b.slug ?? (b.code ?? '').toLowerCase()}`}
                          target="_blank"
                          rel="noopener"
                          className="shrink-0 rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] text-[var(--accent)]"
                        >
                          已发布 ↗
                        </a>
                      )}
                      <div className="flex shrink-0 items-center gap-1">
                        <button className={btnGhost} onClick={() => moveBank(b, -1)}>↑</button>
                        <button className={btnGhost} onClick={() => moveBank(b, 1)}>↓</button>
                        <button
                          className={btnGhost}
                          onClick={() => setEditing(editing === b.id ? null : b.id)}
                        >
                          {editing === b.id ? '收起' : '编辑正文'}
                        </button>
                      </div>
                    </div>

                    {editing === b.id && (
                      <BankEditor
                        idea={b}
                        orgs={orgs}
                        draft={makeDraft}
                        onSave={(patch) => patchBank(b.id, patch)}
                        onAudio={(force) => makeAudio(b.id, force)}
                        voicing={voicing === b.id}
                        onDelete={() => delBank(b.id)}
                        onToggleActive={() =>
                          patchBank(b.id, { is_active: !b.is_active })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {view === 'prompt' && (
        <section className="space-y-3">
          <div className={`${card} space-y-3`}>
            <div>
              <h2 className="font-display text-lg font-semibold">起草稿的提示词</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                所有「起草稿」都先读这一段，再接上那家公司自己的风格。
                改完立刻生效，不用重新部署 —— 写稿风格是要反复调才会变好的东西。
              </p>
            </div>
            <textarea
              className={`${input} min-h-[420px] font-mono text-[13px] leading-relaxed`}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button className={btn} onClick={savePrompt}>保存</button>
              <button
                className={btnGhost}
                onClick={() => {
                  if (confirm('恢复成默认那一版？你现在改的会被覆盖。')) {
                    setPromptText(defaultPrompt);
                  }
                }}
              >
                恢复默认
              </button>
              <span className="text-xs text-[var(--muted)]">{promptText.length} 字</span>
            </div>
          </div>
          <div className={`${card} text-sm leading-relaxed text-[var(--muted)]`}>
            <strong className="text-[var(--ink)]">有一条别删：</strong>
            「不要写死金额、比例、年份、门槛数字」。这类规定每年都在变，
            写死了过几个月就是错的 —— 而且那是客户本人对着镜头说出去的，
            是他的执业责任，不是你的。
          </div>
        </section>
      )}

      {view === 'applies' && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)]">
            申请开通。通过一下就同时建好公司、挂上人、开通权限。
          </h2>
          {!applies.length && (
            <div className={`${card} text-[var(--muted)]`}>还没有人申请。</div>
          )}
          {applies.map((a) => (
            <div key={a.id} className={card}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.company}</span>
                <div className="flex-1" />
                <span className="text-xs text-[var(--muted)]">
                  {new Date(a.created_at).toLocaleDateString('zh-CN')}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    a.status === 'approved'
                      ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                      : 'bg-white/10'
                  }`}
                >
                  {a.status === 'pending'
                    ? '待处理'
                    : a.status === 'approved'
                      ? '已开通'
                      : '已拒绝'}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {a.contact ? `${a.contact} · ` : ''}
                {a.email}
              </p>
              {a.note && (
                <p className="mt-3 border-l-2 border-white/15 pl-3 text-sm text-[var(--muted)]">
                  {a.note}
                </p>
              )}
              {a.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button className={btn} onClick={() => handleApply(a, true)}>
                    通过并开通
                  </button>
                  <button className={btnGhost} onClick={() => handleApply(a, false)}>
                    拒绝
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {view === 'orgs' && (
        <section className="space-y-4">
          <div className={`${card} space-y-3`}>
            <div>
              <h2 className="font-display text-lg font-semibold">合作公司</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                公司「开通」后，挂在它下面的所有人都能看正文、能提交灵感 ——
                不用一人一个账号去标。收费仍然线下开发票。
              </p>
            </div>
            <div className="flex gap-2">
              <input
                className={input}
                placeholder="公司名，比如 桂冠会计"
                value={newOrg}
                onChange={(e) => setNewOrg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addOrg()}
              />
              <button className={btn} disabled={!newOrg.trim()} onClick={addOrg}>
                新建
              </button>
            </div>
          </div>

          {!orgs.length && (
            <div className={`${card} text-[var(--muted)]`}>
              还没有公司。个人客户继续用「客户」页的 Fordexa 客户勾选框就行。
            </div>
          )}
          {orgs.map((o) => (
            <div key={o.id} className={card}>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  className="min-w-0 flex-1 bg-transparent font-medium outline-none"
                  defaultValue={o.name}
                  onBlur={(e) =>
                    e.target.value.trim() !== o.name &&
                    patchOrg(o.id, { name: e.target.value.trim() })
                  }
                />
                <span className="text-xs text-[var(--muted)]">{o.members} 人</span>
                <select
                  className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
                  value={o.industry ?? ''}
                  onChange={(e) => patchOrg(o.id, { industry: e.target.value || null })}
                >
                  <option value="">行业未设</option>
                  {industries.map((i) => (
                    <option key={i.key} value={i.key}>{i.name_zh}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={o.is_active}
                    onChange={(e) => patchOrg(o.id, { is_active: e.target.checked })}
                  />
                  <span className={o.is_active ? 'text-[var(--accent)]' : ''}>已开通</span>
                </label>
              </div>
              <input
                className="mt-3 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm"
                placeholder="公司邮箱域名，逗号隔开：guiguan.com.au, guiguan.com —— 用这些邮箱登录的人自动挂到这家"
                defaultValue={(o.email_domains ?? []).join(', ')}
                onBlur={(e) => {
                  const next = e.target.value
                    .split(/[,，\s]+/)
                    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
                    .filter(Boolean);
                  if (next.join(',') !== (o.email_domains ?? []).join(','))
                    patchOrg(o.id, { email_domains: next });
                }}
              />
              <input
                className="mt-3 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm"
                placeholder="备注：合同期、联系人、价格……只有你看得到"
                defaultValue={o.note ?? ''}
                onBlur={(e) =>
                  e.target.value !== (o.note ?? '') &&
                  patchOrg(o.id, { note: e.target.value })
                }
              />

              <div className="mt-4 border-t border-white/8 pt-4">
                <label className="mb-1.5 block text-xs font-semibold text-[var(--accent)]">
                  口播风格 —— 起草稿时 AI 照这个写
                </label>
                <textarea
                  className={`${input} min-h-[70px] text-sm leading-relaxed`}
                  placeholder="语速偏慢，爱举真实案例，不用网络热词，开头喜欢先讲一个客户故事……"
                  defaultValue={o.style_prompt ?? ''}
                  onBlur={(e) =>
                    e.target.value !== (o.style_prompt ?? '') &&
                    patchOrg(o.id, { style_prompt: e.target.value })
                  }
                />
                <label className="mb-1.5 mt-3 block text-xs font-semibold text-[var(--muted)]">
                  以前口播的文字稿 —— 比形容词准得多，有几段贴几段
                </label>
                <textarea
                  className={`${input} min-h-[90px] text-sm leading-relaxed`}
                  placeholder="把他们以前视频的口播文字贴进来。「专业但不端着」各人理解不同，一段真实的口播没有歧义。"
                  defaultValue={o.style_samples ?? ''}
                  onBlur={(e) =>
                    e.target.value !== (o.style_samples ?? '') &&
                    patchOrg(o.id, { style_samples: e.target.value })
                  }
                />
              </div>
            </div>
          ))}
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
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 这条提交来自哪个客户,就用他公司的风格 */}
                    <button
                      className={btnGhost}
                      disabled={drafting}
                      onClick={async () => {
                        if (draftBody.trim() && !confirm('上面已经写了，生成会覆盖掉。继续？')) return;
                        setDrafting(true);
                        const org = clients.find((c) => c.id === r.user_id)?.org_id ?? '';
                        const t = await makeDraft(
                          draftTitle || r.body,
                          org,
                          clients.find((c) => c.id === r.user_id)?.industry ?? null,
                          r.note ?? '',
                        );
                        setDrafting(false);
                        if (t) setDraftBody(t);
                      }}
                    >
                      {drafting ? '写着…' : '用 DeepSeek 起草稿'}
                    </button>
                    <span className="text-xs text-[var(--muted)]">
                      按这位客户所属公司的风格写
                    </span>
                  </div>
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
                <select
                  className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
                  value={c.org_id ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => patchClient(c.id, { org_id: e.target.value || null })}
                >
                  <option value="">无公司</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}{o.is_active ? '' : '（未开通）'}
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
      {note && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <div className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-black shadow-lg">
            {note}
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * 一条内容的完整编辑器。
 *
 * 摘要和参考文献是**公开**的（网站上路人就能看到），口播稿正文是付费可见的。
 * 所以这两块在界面上分开标清楚 —— 写的时候就该知道哪些会被公开。
 */
function BankEditor({
  idea,
  orgs,
  draft,
  onSave,
  onAudio,
  voicing,
  onDelete,
  onToggleActive,
}: {
  idea: BankIdea;
  orgs: Org[];
  draft: (title: string, orgId: string, industry: string | null, note: string) => Promise<string | null>;
  onSave: (patch: Partial<BankIdea> & { refs?: Ref[] }) => Promise<boolean>;
  onAudio: (force: boolean) => void;
  voicing: boolean;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const [summary, setSummary] = useState(idea.summary ?? '');
  const [script, setScript] = useState(idea.script ?? '');
  const [slug, setSlug] = useState(idea.slug ?? '');
  const [tagsText, setTagsText] = useState((idea.tags ?? []).join(', '));
  const [sourceUrl, setSourceUrl] = useState(idea.source_url ?? '');
  const parsedTags = tagsText.split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean);
  // 参考文献用「名称|网址」一行一条写，比做一堆增删按钮快得多
  const [refsText, setRefsText] = useState(
    (idea.refs ?? []).map((r) => (r.url ? `${r.label}|${r.url}` : r.label)).join('\n'),
  );
  // 起草稿：挑一家公司就带上他们的风格，不挑就用通用骨架
  const [styleOrg, setStyleOrg] = useState('');
  // 哪个按钮正在等服务器:按钮上显示「发布中…」,期间不让重复点
  const [saving, setSaving] = useState<'save' | 'publish' | 'free' | null>(null);
  const run = async (kind: 'save' | 'publish' | 'free', patch: Partial<BankIdea> & { refs?: Ref[] }) => {
    setSaving(kind);
    try {
      await onSave(patch);
    } finally {
      setSaving(null);
    }
  };
  const [brief, setBrief] = useState('');
  const [drafting, setDrafting] = useState(false);

  const parsedRefs: Ref[] = refsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, url = ''] = line.split('|');
      return { label: label.trim(), url: url.trim() };
    })
    .filter((r) => r.label);

  return (
    <div className="mt-4 space-y-4 border-t border-white/8 pt-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[var(--accent)]">
          摘要 · 公开
        </label>
        <textarea
          className={`${input} min-h-[70px] leading-relaxed`}
          placeholder="两句话说清这条讲什么。Google 和路人看到的就是这段。"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--accent)]">
            标签 · 公开 —— 逗号隔开，网站上按它筛选
          </label>
          <input
            className={input}
            placeholder="BAS, GST, 小生意"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
            来源网址 —— 这条选题从哪看来的，可不填
          </label>
          <input
            className={input}
            placeholder="https://www.ato.gov.au/…"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
          {idea.source_url && (
            <a
              href={idea.source_url}
              target="_blank"
              rel="noopener"
              className="mt-1 inline-block text-xs text-[var(--accent)] hover:underline"
            >
              打开来源 ↗
            </a>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[var(--accent)]">
          参考出处 · 公开 —— 一行一条，「名称|网址」，网址可省
        </label>
        <textarea
          className={`${input} min-h-[70px] font-mono text-[13px] leading-relaxed`}
          placeholder={'ATO — Keeping records|https://ato.gov.au/...\nTR 97/24'}
          value={refsText}
          onChange={(e) => setRefsText(e.target.value)}
        />
      </div>

      {/* 起草稿。生成的是草稿不是成品 —— 填进下面的框，你改完再发。 */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted)]">
            用 DeepSeek 起个草稿
          </span>
          <div className="flex-1" />
          <select
            className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
            value={styleOrg}
            onChange={(e) => setStyleOrg(e.target.value)}
          >
            <option value="">通用风格</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.style_prompt || o.style_samples ? '' : '（没设风格）'}
              </option>
            ))}
          </select>
          <button
            className={btnGhost}
            disabled={drafting}
            onClick={async () => {
              if (script.trim() && !confirm('下面已经有正文了，生成会覆盖掉。继续？')) return;
              setDrafting(true);
              const t = await draft(idea.title, styleOrg, idea.industry, brief);
              setDrafting(false);
              if (t) setScript(t);
            }}
          >
            {drafting ? '写着…' : '起草稿'}
          </button>
        </div>
        <input
          className="w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm"
          placeholder="这一条有什么特别要求？可不填。比如：重点讲第二种情况、别提具体金额"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
          口播稿正文 · 付费可见 —— 客户照着念的就是这段
        </label>
        <textarea
          className={`${input} min-h-[220px] leading-[1.9]`}
          placeholder="一句一行。客户举起手机照着念这段。"
          value={script}
          onChange={(e) => setScript(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          {script.replace(/\s/g, '').length} 字 · 约{' '}
          {Math.max(10, Math.ceil(script.replace(/\s/g, '').length / 4 / 10) * 10)} 秒
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-64 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm disabled:opacity-50"
          placeholder="网址：留空发布时自动起英文关键词"
          title={
            idea.is_published
              ? '已发布的网址锁定了，改了外面的链接会断'
              : '留空的话发布时 AI 起 3–6 个英文词，再自动带上编号'
          }
          value={slug}
          disabled={idea.is_published}
          onChange={(e) => setSlug(e.target.value)}
        />
        <button
          className={btn}
          disabled={saving !== null}
          onClick={() =>
            run('save', { summary, script, slug, refs: parsedRefs, tags: parsedTags, source_url: sourceUrl })
          }
        >
          {saving === 'save' ? '保存中…' : '保存'}
        </button>
        <button
          className={btnGhost}
          disabled={saving !== null}
          onClick={() =>
            run('publish', {
              summary,
              script,
              slug,
              refs: parsedRefs,
              tags: parsedTags,
              source_url: sourceUrl,
              is_published: !idea.is_published,
            })
          }
        >
          {saving === 'publish'
            ? idea.is_published
              ? '撤下中…'
              : '发布中…'
            : idea.is_published
              ? '从网站撤下'
              : '保存并发布到网站'}
        </button>
        <button
          className={btnGhost}
          disabled={voicing || !idea.script}
          title="Fish Audio「女大学生」念一遍，存起来放在网站上。先保存正文再点。"
          onClick={() => onAudio(Boolean(idea.audio_url))}
        >
          {voicing ? '念着呢…' : idea.audio_url ? '重新念一遍' : '生成朗读'}
        </button>
        {idea.audio_url && (
          <span className="text-xs text-[var(--muted)]">
            {idea.audio_stale ? '⚠ 稿子改过了，朗读是旧的' : '已有朗读'}
          </span>
        )}
        <label className="flex items-center gap-1.5 text-sm" title="整篇公开，不登录也能看。用来让路人看出稿子的质量，一两条就够。">
          <input
            type="checkbox"
            checked={idea.is_free}
            disabled={saving !== null}
            onChange={(e) => run('free', { is_free: e.target.checked })}
          />
          <span className={idea.is_free ? 'text-[var(--accent)]' : ''}>免费样稿</span>
        </label>
        <div className="flex-1" />
        <button className={btnGhost} onClick={onToggleActive}>
          {idea.is_active ? '在 App 里下架' : '在 App 里上架'}
        </button>
        <button className={btnGhost} onClick={onDelete}>
          删除
        </button>
      </div>
    </div>
  );
}
