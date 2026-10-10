import type { NextRequest } from 'next/server';

import { admin, configured, requestUser } from '@/lib/auth';
import { scriptHash } from '@/lib/tts';

/**
 * 网站灵感库的取数。
 *
 * 公开部分(标题/摘要/参考文献)对所有人可见,所以不能走 RLS ——
 * 匿名访客用 publishable key 一行都读不到,那是对的。
 * 这里用 service_role 取,**然后只挑公开字段返回**。
 *
 * 口播稿正文只有两种情况进返回值:这条标了免费样稿,或者确认有权限。
 * 它不是靠前端遮一下 —— 没权限的人拿到的 JSON 里根本没有那段文字。
 */

export type Ref = { label: string; url: string };

export type PublicIdea = {
  code: string;
  slug: string;
  title: string;
  summary: string | null;
  industry: string | null;
  industryName: string | null;
  refs: Ref[];
  publishedAt: string | null;
  /** 免费样稿:整篇公开,不登录也能看 */
  isFree: boolean;
  /** 有权限(或免费)时才有值 */
  script?: string;
  /** 朗读音频,和 script 同一套权限;稿子改过还没重念时不给 */
  audioUrl?: string;
  /** 这条有没有口播稿(没权限的人也该知道「有正文可看」) */
  hasScript: boolean;
};

type Row = {
  code: string | null;
  slug: string | null;
  title: string;
  summary: string | null;
  industry: string | null;
  refs: unknown;
  script: string | null;
  published_at: string | null;
  is_free: boolean | null;
  audio_url: string | null;
  audio_script_hash: string | null;
};

function parseRefs(raw: unknown): Ref[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => r as { label?: unknown; url?: unknown })
    .map((r) => ({ label: String(r.label ?? ''), url: String(r.url ?? '') }))
    .filter((r) => r.label);
}

function toPublic(row: Row, names: Map<string, string>, allowed: boolean): PublicIdea {
  const isFree = Boolean(row.is_free);
  return {
    code: row.code ?? '',
    slug: row.slug ?? (row.code ?? '').toLowerCase(),
    title: row.title,
    summary: row.summary,
    industry: row.industry,
    industryName: row.industry ? (names.get(row.industry) ?? row.industry) : null,
    refs: parseRefs(row.refs),
    publishedAt: row.published_at,
    isFree,
    hasScript: Boolean(row.script),
    ...((allowed || isFree) && row.script ? { script: row.script } : {}),
    ...((allowed || isFree) && row.script && row.audio_url && row.audio_script_hash === scriptHash(row.script)
      ? { audioUrl: row.audio_url }
      : {}),
  };
}

async function industryNames(): Promise<Map<string, string>> {
  if (!configured) return new Map();
  const { data } = await admin().from('industries').select('key, name_zh');
  return new Map((data ?? []).map((i) => [i.key as string, i.name_zh as string]));
}

/**
 * 当前访客的身份和权限,给页面决定显示哪一种状态:
 *   user 为空        → 没登录,显示登录入口
 *   allowed          → 有权限,给正文
 *   pending          → 已经申请过、还没批,显示「等待开通」
 *   其余             → 登录了但没权限,显示申请表单
 */
export type Access = {
  user: { id: string; email: string } | null;
  allowed: boolean;
  pending: boolean;
};

/**
 * 公司按邮箱域名自动归属。本人还没挂公司、邮箱域名在某家公司的
 * email_domains 里,就挂上去。只挂不解挂。苹果中继地址不算公司邮箱。
 * 和数据库里的 claim_org_by_domain() 是同一套规则,App 走那边,网站走这边。
 */
async function claimOrgByDomain(userId: string, email: string): Promise<string | null> {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain || domain === 'privaterelay.appleid.com') return null;
  const db = admin();
  const { data: org } = await db
    .from('organizations')
    .select('id')
    .contains('email_domains', [domain])
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!org) return null;
  const { error } = await db.from('profiles').update({ org_id: org.id }).eq('id', userId);
  return error ? null : (org.id as string);
}

export async function accessFor(request: NextRequest): Promise<Access> {
  const none: Access = { user: null, allowed: false, pending: false };
  if (!configured) return none;
  const user = await requestUser(request);
  if (!user) return none;

  const db = admin();
  const { data } = await db
    .from('profiles')
    .select('is_fordexa_client, org_id')
    .eq('id', user.id)
    .maybeSingle();
  // 口径和数据库里的 has_content_access() 一致:本人是客户,或所属公司已开通
  if (data?.is_fordexa_client) return { user, allowed: true, pending: false };

  let orgId = (data?.org_id as string | null) ?? null;
  if (!orgId && user.email) orgId = await claimOrgByDomain(user.id, user.email);

  if (orgId) {
    const { data: org } = await db
      .from('organizations')
      .select('is_active')
      .eq('id', orgId)
      .maybeSingle();
    if (org?.is_active) return { user, allowed: true, pending: false };
  }

  const { data: req } = await db
    .from('access_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  return { user, allowed: false, pending: Boolean(req) };
}

/** 当前访客能不能看正文。 */
export async function canReadScript(request: NextRequest): Promise<boolean> {
  return (await accessFor(request)).allowed;
}

const SELECT =
  'code, slug, title, summary, industry, refs, script, published_at, is_free, audio_url, audio_script_hash';

/** 已发布的全部,新的在前。列表页从不返回正文(免费的也不,列表用不着)。 */
export async function listPublished(): Promise<PublicIdea[]> {
  if (!configured) return [];
  const [{ data }, names] = await Promise.all([
    admin()
      .from('idea_bank')
      .select(SELECT)
      .eq('is_published', true)
      .eq('is_active', true)
      .order('published_at', { ascending: false }),
    industryNames(),
  ]);
  return ((data ?? []) as Row[]).map((r) => {
    const { script: _drop, audioUrl: _drop2, ...rest } = toPublic(r, names, false);
    void _drop;
    void _drop2;
    return rest;
  });
}

/** 单篇。allowed 决定正文给不给;免费样稿不看 allowed。 */
export async function getPublished(
  slug: string,
  allowed: boolean,
): Promise<PublicIdea | null> {
  if (!configured) return null;
  const names = await industryNames();
  const key = slug.toLowerCase();
  // slug 没填时用编号兜底,所以两边都查一次
  const { data } = await admin()
    .from('idea_bank')
    .select(SELECT)
    .eq('is_published', true)
    .eq('is_active', true)
    .or(`slug.eq.${key},code.eq.${key.toUpperCase()}`)
    .maybeSingle();
  return data ? toPublic(data as Row, names, allowed) : null;
}
