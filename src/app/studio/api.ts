'use client';

import { browserSupabase } from '@/lib/browser-supabase';
import type { Checks } from '@/lib/studio/checks';

/** 工作台的接口都带登录 token；非 2xx 抛 Error，消息就是接口给的中文 */
export class StudioError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function studioToken(): Promise<string | null> {
  const sb = await browserSupabase();
  const { data } = (await sb?.auth.getSession()) ?? { data: null };
  return data?.session?.access_token ?? null;
}

export async function studioFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await studioToken();
  if (!token) throw new StudioError('请先登录', 401);
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new StudioError(body.error ?? '出错了，稍后再试', res.status);
  return body;
}

export const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export type ScriptStatus = 'ready' | 'recorded' | 'archived';

export type StudioScript = {
  id: string;
  title: string;
  body: string;
  source: string;
  status: ScriptStatus;
  code: string | null;
  record_by: string | null;
  checks: Checks | null;
  created_at: string;
  research: number;
  hasAudio: boolean;
  versions: number;
};

export type Version = {
  id: string;
  kind: 'fordexa' | 'generated';
  n: number;
  body: string;
  prompt: string | null;
  checks: Checks | null;
  appendix: string | null;
  created_at: string;
};

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : '出错了，稍后再试';
}
