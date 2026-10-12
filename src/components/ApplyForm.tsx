'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';

/**
 * 「申请开通」表单。登录了但还不是客户的人填,落到 access_requests,
 * Fordexa 在后台批。口播稿详情页和 /apply 页共用。
 */
export default function ApplyForm({ onDone, intro }: { onDone: () => void; intro?: string }) {
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [industries, setIndustries] = useState<{ key: string; name: string }[]>([]);
  useEffect(() => {
    fetch('/api/industries').then((r) => r.json()).then((b) => setIndustries(b.industries ?? [])).catch(() => {});
  }, []);
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const input =
    'w-full rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]';

  const submit = async () => {
    if (!company.trim()) return setErr('公司名得填');
    if (!industry) return setErr('选一下行业，我们按行业写选题');
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
        body: JSON.stringify({ company, industry, contact, note }),
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
        {intro ?? '完整口播稿给 Fordexa 的客户。留下公司名，我们看过就开通，整家公司的人一起能看。'}
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
