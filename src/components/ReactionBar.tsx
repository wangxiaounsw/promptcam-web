'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';

/** 浏览器的设备 id:点赞按它去重。没有 localStorage 时每次都是新设备,无妨。 */
export function deviceId(): string {
  try {
    const k = 'fx_device';
    let v = localStorage.getItem(k);
    if (!v) { v = crypto.randomUUID().replace(/-/g, '').slice(0, 24); localStorage.setItem(k, v); }
    return v;
  } catch { return ''; }
}

async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const d = deviceId(); if (d) h['x-device'] = d;
  try {
    const sb = await browserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: null };
    if (data?.session?.access_token) h.Authorization = `Bearer ${data.session.access_token}`;
  } catch { /* 未登录 */ }
  return h;
}

/**
 * ♡ 点赞 · ☆ 收藏。点赞谁都能点;收藏要登录,没登录点了就去登录页。
 * 初始计数由服务端传进来(列表/详情页都有),所以首屏不闪。
 */
export type Mine = { liked: boolean; saved: boolean };

export default function ReactionBar({ code, likes, saves, size = 'md', plain = false, next, mine, onChange }: {
  code: string; likes: number; saves: number; size?: 'sm' | 'md'; next?: string;
  /** 列表行用：不画边框，只有图标和数字 */
  plain?: boolean;
  /** 列表页一次拉好全部状态传进来,就不每行各自请求一次 */
  mine?: Mine;
  onChange?: (code: string, m: Mine, likes: number, saves: number) => void;
}) {
  const [l, setL] = useState(likes); const [s, setS] = useState(saves);
  const [liked, setLiked] = useState(mine?.liked ?? false); const [saved, setSaved] = useState(mine?.saved ?? false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (mine) { setLiked(mine.liked); setSaved(mine.saved); } }, [mine]);
  useEffect(() => { setL(likes); setS(saves); }, [likes, saves]);

  useEffect(() => {
    if (mine) return;
    let cancelled = false;
    (async () => {
      const h = await authHeaders();
      const r = await fetch(`/api/reactions?codes=${encodeURIComponent(code)}`, { headers: h }).then((x) => x.json()).catch(() => null);
      if (cancelled || !r) return;
      const m = r.mine?.[code]; if (m) { setLiked(m.liked); setSaved(m.saved); }
      const c = r.counts?.[code]; if (c) { setL(c.likes); setS(c.saves); }
    })();
    return () => { cancelled = true; };
  }, [code, mine]);

  const toggle = async (kind: 'like' | 'save') => {
    if (busy) return; setBusy(true);
    const on = kind === 'like' ? !liked : !saved;
    // 先改界面再发请求
    if (kind === 'like') { setLiked(on); setL((v) => v + (on ? 1 : -1)); } else { setSaved(on); setS((v) => v + (on ? 1 : -1)); }
    try {
      const h = await authHeaders();
      const r = await fetch('/api/reactions', { method: 'POST', headers: h, body: JSON.stringify({ code, kind, on }) });
      if (r.status === 401) {
        setSaved(!on); setS((v) => v - (on ? 1 : -1));
        window.location.href = `/login?next=${encodeURIComponent(next ?? window.location.pathname)}`;
        return;
      }
      const j = await r.json();
      if (r.ok) { setL(j.likes); setS(j.saves); onChange?.(code, { liked: kind === 'like' ? on : liked, saved: kind === 'save' ? on : saved }, j.likes, j.saves); }
      else { if (kind === 'like') { setLiked(!on); setL((v) => v - (on ? 1 : -1)); } else { setSaved(!on); setS((v) => v - (on ? 1 : -1)); } }
    } finally { setBusy(false); }
  };

  const base = size === 'sm' ? 'gap-1 px-2 py-1 text-xs' : 'gap-1.5 px-3 py-1.5 text-sm';
  const btn = (active: boolean) =>
    plain
      ? `inline-flex items-center gap-1 text-xs transition-colors ${active ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`
      : `inline-flex items-center rounded-full border transition-colors ${base} ${active ? 'border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'}`;
  return (
    <span className={`inline-flex items-center ${plain ? 'gap-3' : 'gap-2'}`} onClick={(e) => e.stopPropagation()}>
      <button className={btn(liked)} aria-pressed={liked} onClick={(e) => { e.preventDefault(); toggle('like'); }} title="点赞">
        <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
        {l}
      </button>
      <button className={btn(saved)} aria-pressed={saved} onClick={(e) => { e.preventDefault(); toggle('save'); }} title={saved ? '取消收藏' : '收藏（需登录）'}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
        {s}
      </button>
    </span>
  );
}
