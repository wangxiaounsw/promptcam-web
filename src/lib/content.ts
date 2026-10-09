import type { NextRequest } from 'next/server';

import { admin, configured, requestUser } from '@/lib/auth';

/**
 * 网站灵感库的取数。
 *
 * 公开部分(标题/摘要/参考文献)对所有人可见,所以不能走 RLS ——
 * 匿名访客用 publishable key 一行都读不到,那是对的。
 * 这里用 service_role 取,**然后只挑公开字段返回**。
 *
 * 口播稿正文只有确认有权限才放进返回值里。它不是靠前端遮一下 ——
 * 没权限的人拿到的 JSON 里根本没有那段文字,查看源码也没有。
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
  /** 有权限时才有值 */
  script?: string;
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
};

function parseRefs(raw: unknown): Ref[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => r as { label?: unknown; url?: unknown })
    .map((r) => ({ label: String(r.label ?? ''), url: String(r.url ?? '') }))
    .filter((r) => r.label);
}

function toPublic(row: Row, names: Map<string, string>, allowed: boolean): PublicIdea {
  return {
    code: row.code ?? '',
    slug: row.slug ?? (row.code ?? '').toLowerCase(),
    title: row.title,
    summary: row.summary,
    industry: row.industry,
    industryName: row.industry ? (names.get(row.industry) ?? row.industry) : null,
    refs: parseRefs(row.refs),
    publishedAt: row.published_at,
    hasScript: Boolean(row.script),
    ...(allowed && row.script ? { script: row.script } : {}),
  };
}

async function industryNames(): Promise<Map<string, string>> {
  if (!configured) return new Map();
  const { data } = await admin().from('industries').select('key, name_zh');
  return new Map((data ?? []).map((i) => [i.key as string, i.name_zh as string]));
}

/**
 * 当前访客能不能看正文。
 * 口径和数据库里的 has_content_access() 一致:本人是 Fordexa 客户,
 * 或者所属公司已开通。没有 Bearer token 的匿名访客一律 false。
 */
export async function canReadScript(request: NextRequest): Promise<boolean> {
  if (!configured) return false;
  const user = await requestUser(request);
  if (!user) return false;
  const { data } = await admin()
    .from('profiles')
    .select('is_fordexa_client, org_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!data) return false;
  if (data.is_fordexa_client) return true;
  if (!data.org_id) return false;
  const { data: org } = await admin()
    .from('organizations')
    .select('is_active')
    .eq('id', data.org_id)
    .maybeSingle();
  return Boolean(org?.is_active);
}

const SELECT = 'code, slug, title, summary, industry, refs, script, published_at';

/** 已发布的全部,新的在前。列表页从不返回正文。 */
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
  return ((data ?? []) as Row[]).map((r) => toPublic(r, names, false));
}

/** 单篇。allowed 决定正文给不给。 */
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
