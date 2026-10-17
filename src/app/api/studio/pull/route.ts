import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { ideaByCode, json, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

/**
 * 「拉到我这里」:把选题的 Fordexa 原版复制进我的口播库,同时记为版本 0。
 * 和 App 里「加到口播库」写的是同一张表、同样的字段(source fordexa + code),
 * 所以拉过来的稿子 App 里马上能录。
 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const idea = await ideaByCode(String(body.code ?? '').trim());
  if (!idea) return json({ error: '这条选题没有口播稿' }, 404);

  const db = admin();
  const { data: script, error } = await db
    .from('scripts')
    .insert({
      user_id: user.id,
      title: idea.title,
      body: idea.script,
      source: 'fordexa',
      code: idea.code,
      status: 'ready',
      sort_order: 0,
    })
    .select('id')
    .single();
  if (error || !script) return json({ error: '拉取失败' }, 502);

  const { error: vErr } = await db.from('script_versions').insert({
    script_id: script.id,
    user_id: user.id,
    kind: 'fordexa',
    n: 0,
    body: idea.script,
  });
  // 版本 0 没写进去也不要紧:打开稿子时 ensureFordexaVersion 会补
  if (vErr) console.error('pull: version 0 insert failed', vErr.message);
  return json({ id: script.id });
}
