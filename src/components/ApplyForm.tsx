'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';

/**
 * 「申请开通」表单,不用登录:公司名 + 行业 + 邮箱,发到 /api/apply 变成一封给 Fordexa 的邮件。
 * 登录着的人提交时服务端会顺手记一条申请,后台能一键开通。口播稿详情页和 /apply 页共用。
 */
export default function ApplyForm({ onDone, intro }: { onDone: () => void; intro?: string }) {
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [industries, setIndustries] = useState<{ key: string; name: string }[]>([]);
  useEffect(() => {
    browserSupabase().then(async (sb) => {
      const { data } = (await sb?.auth.getSession()) ?? { data: null };
      if (data?.session?.user.email) setEmail((e) => e || data.session!.user.email!);
    }).catch(() => {});
    fetch('/api/industries').then((r) => r.json()).then((b) => setIndustries(b.industries ?? [])).catch(() => {});
  }, []);
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState(''); // 蜜罐
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const input =
    'w-full rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]';

  const submit = async () => {
    if (!company.trim()) return setErr('公司名得填');
    if (!industry) return setErr('选一下行业，我们按行业写选题');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('留个能收到回信的邮箱');
    setBusy(true);
    setErr('');
    try {
      const sb = await browserSupabase();
      const { data } = (await sb?.auth.getSession()) ?? { data: null };
      const token = data?.session?.access_token;
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ company, industry, email: email.trim(), contact, note, website }),
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
        {intro ?? '完整口播稿给 Fordexa 的客户。留下公司、行业和邮箱，我们会联系你，开通后整家公司的人一起能看。'}
      </p>
      <div className="mt-5 space-y-3">
        <input
          className={input}
          placeholder="公司名"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <select className={input} value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="">你做哪一行</option>
          {industries.map((i) => (
            <option key={i.key} value={i.key}>{i.name}</option>
          ))}
        </select>
        <input
          className={input}
          type="email"
          placeholder="邮箱（我们回信到这里）"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <input
          className={input}
          placeholder="微信 / 电话（可不填）"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <textarea
          className={`${input} min-h-[80px]`}
          placeholder="备注：想拍什么内容、现在是怎么做视频的……（可不填）"
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
