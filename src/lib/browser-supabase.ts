'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 浏览器端的 Supabase 客户端,全站共用一个。
 * 两个公开值从 /api/admin/config 取(和 /admin 同一条路),
 * 登录态存在 localStorage,所以口播库、登录页、页头看到的是同一个人。
 */
let pending: Promise<SupabaseClient | null> | null = null;

export function browserSupabase(): Promise<SupabaseClient | null> {
  if (!pending) {
    pending = fetch('/api/admin/config')
      .then((r) => r.json())
      .then((cfg: { url?: string; key?: string }) =>
        cfg.url && cfg.key ? createClient(cfg.url, cfg.key) : null,
      )
      .catch(() => null);
  }
  return pending;
}

/** 登录后回到哪:只认站内相对路径,防止被人拿去做跳转钓鱼 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/ideas';
  return raw;
}
