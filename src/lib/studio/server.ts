import { NextResponse, type NextRequest } from 'next/server';
import { admin, configured, requestUser } from '@/lib/auth';
import { avatarUrl } from '@/lib/avatar';
import { buildSourceText, type SourceRef } from '@/lib/studio/fact-rules';
import { canEnterStudio, pickViewingOrg, scriptMayUseFordexa } from '@/lib/studio/scope';

/**
 * 工作台服务端的公共件。所有 /api/studio/* 都走 service key,
 * 所以「这条稿子是不是这家公司的」必须在这里每次查 —— 没有 RLS 兜底。
 */

export const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** orgId = 正在看的公司(管理员可切换);ownOrgId = 自己所在的公司 */
export type StudioUser = { id: string; email: string; isAdmin: boolean; ownOrgId: string | null; orgId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ORG_HEADER = 'x-studio-org';

function joinedActive(org: unknown): boolean {
  const o = org as { is_active: boolean } | { is_active: boolean }[] | null;
  return Array.isArray(o) ? Boolean(o[0]?.is_active) : Boolean(o?.is_active);
}

/** 管理员 + 已开通公司的成员能进。管理员带 x-studio-org 就看那家公司 */
export async function requireStudioUser(request: NextRequest): Promise<StudioUser | null> {
  if (!configured) return null;
  const user = await requestUser(request);
  if (!user) return null;
  const db = admin();
  const { data } = await db
    .from('profiles')
    .select('is_admin, org_id, organizations(is_active)')
    .eq('id', user.id)
    .maybeSingle();
  if (!data) return null;
  const isAdmin = Boolean(data.is_admin);
  const ownOrgId = (data.org_id as string | null) ?? null;
  if (!canEnterStudio({ isAdmin, ownOrgActive: joinedActive(data.organizations) })) return null;

  const raw = request.headers.get(ORG_HEADER)?.trim() ?? '';
  const requested = UUID.test(raw) ? raw : null;
  let requestedExists = false;
  if (isAdmin && requested && requested !== ownOrgId) {
    const { data: org } = await db.from('organizations').select('id').eq('id', requested).maybeSingle();
    requestedExists = Boolean(org);
  }
  const orgId = pickViewingOrg({ isAdmin, ownOrgId, requested, requestedExists: requestedExists || requested === ownOrgId });
  return { id: user.id, email: user.email, isAdmin, ownOrgId, orgId };
}

export type ScriptRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  created_by: string | null;
  title: string;
  body: string;
  source: string;
  status: 'ready' | 'recorded' | 'archived';
  code: string | null;
  record_by: string | null;
  audio_path: string | null;
  audio_hash: string | null;
  checks: unknown;
  created_at: string;
};

export const SCRIPT_COLUMNS =
  'id, user_id, org_id, created_by, title, body, source, status, code, record_by, audio_path, audio_hash, checks, created_at';

/** 这条稿子属于正在看的公司才给 */
export async function scriptInScope(orgId: string | null, id: string): Promise<ScriptRow | null> {
  if (!id || !orgId || !UUID.test(id)) return null;
  const { data } = await admin()
    .from('scripts')
    .select(SCRIPT_COLUMNS)
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();
  return (data as ScriptRow | null) ?? null;
}

export type VersionRow = { id: string; script_id: string; kind: string; body: string; checks: unknown };

/** 版本按「它的稿子在不在这家公司」核对 —— 管理员在客户那生成的版本,客户也要能听、能用 */
export async function versionInScope(
  orgId: string | null,
  versionId: string,
): Promise<{ version: VersionRow; script: ScriptRow } | null> {
  if (!versionId || !UUID.test(versionId)) return null;
  const { data } = await admin()
    .from('script_versions')
    .select('id, script_id, kind, body, checks')
    .eq('id', versionId)
    .maybeSingle();
  if (!data) return null;
  const script = await scriptInScope(orgId, data.script_id as string);
  return script ? { version: data as VersionRow, script } : null;
}

/** 管理员往别家放稿子时挂在谁名下:最早注册的成员(App 这一期只显示本人名下的稿子) */
export async function orgOwner(orgId: string): Promise<string | null> {
  const { data } = await admin()
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function claimFor(code: string): Promise<{ org_id: string } | null> {
  if (!code) return null;
  const { data } = await admin().from('fordexa_claims').select('org_id').eq('code', code).maybeSingle();
  return (data as { org_id: string } | null) ?? null;
}

async function mayUseFordexa(script: ScriptRow): Promise<boolean> {
  if (!script.code) return false;
  const claimOrgId = (await claimFor(script.code))?.org_id ?? null;
  return scriptMayUseFordexa({ claimOrgId, orgId: script.org_id, source: script.source });
}

export type Person = { id: string; name: string; avatarUrl: string | null; isAdmin: boolean };

/** 「谁放的」「谁改的」:名字 → 邮箱 @ 前面 → 未命名 */
export async function peopleById(ids: (string | null | undefined)[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, Person>();
  if (!unique.length) return out;
  const db = admin();
  const { data } = await db.from('profiles').select('id, display_name, avatar_path, is_admin').in('id', unique);
  await Promise.all(
    (data ?? []).map(async (p) => {
      let name = ((p.display_name as string | null) ?? '').trim();
      if (!name) {
        const { data: u } = await db.auth.admin.getUserById(p.id as string);
        name = u.user?.email?.split('@')[0] ?? '未命名';
      }
      out.set(p.id as string, {
        id: p.id as string,
        name,
        avatarUrl: avatarUrl((p.avatar_path as string | null) ?? null),
        isAdmin: Boolean(p.is_admin),
      });
    }),
  );
  return out;
}

export type IdeaSource = {
  code: string;
  title: string;
  script: string;
  article: string | null;
  refs: SourceRef[];
};

function parseRefs(raw: unknown): SourceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => r as { label?: unknown; url?: unknown })
    .map((r) => ({ label: String(r.label ?? ''), url: String(r.url ?? '') }))
    .filter((r) => r.label || r.url);
}

/** 按选题编号取选题 + 它所属文章。自身没有文章/出处就用父行的 */
export async function ideaByCode(code: string): Promise<IdeaSource | null> {
  if (!code) return null;
  const db = admin();
  const { data: row } = await db
    .from('idea_bank')
    .select('code, title, script, article, refs, parent_id, is_published')
    .eq('code', code)
    .maybeSingle();
  if (!row || !row.is_published || !(row.script ?? '').trim()) return null;
  let article = (row.article as string | null) ?? null;
  let refs = parseRefs(row.refs);
  if (row.parent_id) {
    const { data: parent } = await db
      .from('idea_bank')
      .select('article, refs')
      .eq('id', row.parent_id)
      .maybeSingle();
    if (!article) article = (parent?.article as string | null) ?? null;
    // 子选题和文章的出处合在一起(按网址去重):文章是照这些出处写的,都算依据
    const seen = new Set(refs.map((r) => r.url || r.label));
    refs = [...refs, ...parseRefs(parent?.refs).filter((r) => !seen.has(r.url || r.label))];
  }
  return { code: row.code as string, title: row.title as string, script: (row.script as string).trim(), article, refs };
}

/**
 * App 里加的稿子没有版本记录:补一条「Fordexa 原版」。并发补两次靠 unique(script_id, n) 挡住。
 * Fordexa 稿被别家占了就不补 —— 这家看不到那份稿子。
 */
export async function ensureFordexaVersion(script: ScriptRow): Promise<void> {
  if (!script.code || !(await mayUseFordexa(script))) return;
  const db = admin();
  const { data: existing } = await db
    .from('script_versions')
    .select('id')
    .eq('script_id', script.id)
    .eq('n', 0)
    .maybeSingle();
  if (existing) return;
  const idea = await ideaByCode(script.code);
  await db.from('script_versions').insert({
    script_id: script.id,
    user_id: script.user_id,
    kind: 'fordexa',
    n: 0,
    body: idea?.script ?? script.body,
  });
}

export type ScriptSource = { idea: IdeaSource; text: string; truncated: boolean };

/** 稿子的依据材料:靠 code 找回选题和文章。自己写的稿子(没有 code)返回 null;Fordexa 稿被别家占了就不给原稿 */
export async function sourceForScript(script: ScriptRow): Promise<ScriptSource | null> {
  if (!script.code) return null;
  const [idea, allowed] = await Promise.all([ideaByCode(script.code), mayUseFordexa(script)]);
  if (!idea) return null;
  const { text, truncated } = buildSourceText({
    title: idea.title,
    original: allowed ? idea.script : null,
    article: idea.article,
    refs: idea.refs,
  });
  return { idea, text, truncated };
}

export async function nextVersionNumber(scriptId: string): Promise<number> {
  const { data } = await admin()
    .from('script_versions')
    .select('n')
    .eq('script_id', scriptId)
    .order('n', { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.n as number | undefined) ?? 0) + 1;
}

