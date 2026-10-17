import { NextResponse, type NextRequest } from 'next/server';
import { admin, configured, requestUser } from '@/lib/auth';
import { buildSourceText, type SourceRef } from '@/lib/studio/fact-rules';

/**
 * 工作台服务端的公共件。所有 /api/studio/* 都走 service key,
 * 所以「是不是本人的稿子」必须在这里每次查 —— 没有 RLS 兜底。
 */

export const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export type StudioUser = { id: string; email: string; orgId: string | null };

/** 第一期 = 管理员才能进。数据仍按 user_id 归属,第二期放开这里就行 */
export async function requireStudioUser(request: NextRequest): Promise<StudioUser | null> {
  if (!configured) return null;
  const user = await requestUser(request);
  if (!user) return null;
  const { data } = await admin()
    .from('profiles')
    .select('is_admin, org_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!data?.is_admin) return null;
  return { id: user.id, email: user.email, orgId: (data.org_id as string | null) ?? null };
}

export type ScriptRow = {
  id: string;
  user_id: string;
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
  'id, user_id, title, body, source, status, code, record_by, audio_path, audio_hash, checks, created_at';

export async function ownScript(userId: string, id: string): Promise<ScriptRow | null> {
  if (!id) return null;
  const { data } = await admin()
    .from('scripts')
    .select(SCRIPT_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as ScriptRow | null) ?? null;
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

/** App 里加的稿子没有版本记录:补一条「Fordexa 原版」。并发补两次靠 unique(script_id, n) 挡住 */
export async function ensureFordexaVersion(script: ScriptRow): Promise<void> {
  if (!script.code) return;
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

/** 稿子的依据材料:靠 code 找回选题和文章。自己写的稿子(没有 code)返回 null */
export async function sourceForScript(script: ScriptRow): Promise<ScriptSource | null> {
  if (!script.code) return null;
  const idea = await ideaByCode(script.code);
  if (!idea) return null;
  const { text, truncated } = buildSourceText({
    title: idea.title,
    original: idea.script,
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

