import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { ensureFordexaVersion, json, ownScript, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

/** 一条稿子的全部版本:Fordexa 原版(n=0)+ 生成的第 1、2、3… 版 */
export async function GET(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  const script = await ownScript(user.id, request.nextUrl.searchParams.get('scriptId') ?? '');
  if (!script) return json({ error: '找不到这条稿子' }, 404);

  await ensureFordexaVersion(script);
  const { data, error } = await admin()
    .from('script_versions')
    .select('id, kind, n, body, prompt, checks, appendix, created_at')
    .eq('script_id', script.id)
    .order('n');
  if (error) return json({ error: '读取失败' }, 502);
  return json({ versions: data ?? [] });
}

/** 「用这版」:把这一版设成稿子正文。App 读到的、试听念的都是正文 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let body: { versionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const db = admin();
  const { data: version } = await db
    .from('script_versions')
    .select('script_id, body, checks')
    .eq('id', String(body.versionId ?? ''))
    .eq('user_id', user.id)
    .maybeSingle();
  if (!version) return json({ error: '找不到这一版' }, 404);

  const { error } = await db
    .from('scripts')
    .update({ body: version.body, checks: version.checks ?? null })
    .eq('id', version.script_id)
    .eq('user_id', user.id);
  if (error) return json({ error: '保存失败' }, 502);
  return json({ ok: true });
}
