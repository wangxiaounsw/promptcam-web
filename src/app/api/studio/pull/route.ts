import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { canUseFordexa } from '@/lib/studio/scope';
import { claimFor, ideaByCode, json, orgOwner, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

/**
 * 「拉到我这里」:把选题放进正在看的这家公司的口播库。
 * Fordexa 稿没被别家占 → 原样复制并记为版本 0(同时占下这份稿子,数据库触发器写占用);
 * 已被别家占 → 只拉标题和选题,正文空着,在稿子页按自己的风格生成。
 * 和 App 里「加到口播库」写的是同一张表、同样的字段(source + code),App 里马上能录。
 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '还没加入公司，口播库没地方放' }, 400);

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const idea = await ideaByCode(String(body.code ?? '').trim());
  if (!idea) return json({ error: '这条选题没有口播稿' }, 404);

  // App 这一期只显示本人名下的稿子:管理员替别家拉,挂在那家最早注册的成员名下
  const owner = user.ownOrgId === user.orgId ? user.id : await orgOwner(user.orgId);
  if (!owner) return json({ error: '这家公司还没有人登录过，没法往它的口播库里放稿子' }, 400);

  const taken = !canUseFordexa((await claimFor(idea.code))?.org_id ?? null, user.orgId);
  const db = admin();
  const { data: script, error } = await db
    .from('scripts')
    .insert({
      user_id: owner,
      org_id: user.orgId,
      created_by: user.id,
      edited_by: user.id,
      title: idea.title,
      body: taken ? '' : idea.script,
      source: taken ? 'self' : 'fordexa',
      code: idea.code,
      status: 'ready',
      sort_order: 0,
    })
    .select('id, source')
    .single();
  if (error || !script) return json({ error: '拉取失败' }, 502);

  // 两家同时拉同一条时,触发器会把慢的那家改成空稿子:以落库的为准
  if (script.source !== 'fordexa') return json({ id: script.id, taken: true });

  const { error: vErr } = await db.from('script_versions').insert({
    script_id: script.id,
    user_id: user.id,
    kind: 'fordexa',
    n: 0,
    body: idea.script,
  });
  // 版本 0 没写进去也不要紧:打开稿子时 ensureFordexaVersion 会补
  if (vErr) console.error('pull: version 0 insert failed', vErr.message);
  return json({ id: script.id, taken: false });
}
