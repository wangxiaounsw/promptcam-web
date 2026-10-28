'use client';

import { browserSupabase } from '@/lib/browser-supabase';
import type { Checks } from '@/lib/studio/checks';
import type { PostKind, Stage } from '@/lib/studio/posts';
import { readViewing } from './viewing';

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

/** 登录令牌 + 正在看的公司(管理员切换用;服务端只对管理员认这个头) */
export function studioHeaders(token: string): Record<string, string> {
  const org = readViewing();
  return { Authorization: `Bearer ${token}`, ...(org ? { 'x-studio-org': org } : {}) };
}

export async function studioFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await studioToken();
  if (!token) throw new StudioError('请先登录', 401);
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...studioHeaders(token), ...init.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new StudioError(body.error ?? '出错了，稍后再试', res.status);
  return body;
}

export const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export type ScriptStatus = 'ready' | 'recorded' | 'archived';

/** 「谁放的」「谁改的」，和服务端 Person 同形 */
export type Person = { id: string; name: string; avatarUrl: string | null; isAdmin: boolean };

export type StudioScript = {
  id: string;
  title: string;
  body: string;
  source: string;
  status: ScriptStatus;
  code: string | null;
  record_by: string | null;
  /** 日历上的发布日期('YYYY-MM-DD')，没排期是 null */
  publish_on: string | null;
  stage: Stage;
  kind: PostKind;
  checks: Checks | null;
  created_at: string;
  research: number;
  hasAudio: boolean;
  versions: number;
  createdBy: Person | null;
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

export type OrgOption = { id: string; name: string; is_active: boolean; members: number };

export type StudioMe = {
  me: Person;
  ownOrgId: string | null;
  viewing: { id: string; name: string } | null;
  orgs?: OrgOption[];
};

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : '出错了，稍后再试';
}
