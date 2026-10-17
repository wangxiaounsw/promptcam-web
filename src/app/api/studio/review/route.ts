import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { chatDeepSeek } from '@/lib/deepseek';
import type { Checks } from '@/lib/studio/checks';
import { CLAIM_REVIEW_PROMPT, parseClaimReview, type Claim } from '@/lib/studio/claims';
import { unsupportedFigures } from '@/lib/studio/figures';
import { json, ownScript, requireStudioUser, sourceForScript } from '@/lib/studio/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 核对:数字(程序)+ 逐句(AI)。传 versionId 核对某一版,传 scriptId 核对当前正文。
 * AI 那一步失败不算请求失败 —— 返回 claimsFailed,界面给「重试」,稿子照样能用。
 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let body: { versionId?: unknown; scriptId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  const db = admin();
  let target: { table: 'script_versions' | 'scripts'; id: string; text: string; scriptId: string };
  if (body.versionId) {
    const { data: v } = await db
      .from('script_versions')
      .select('id, script_id, kind, body')
      .eq('id', String(body.versionId))
      .eq('user_id', user.id)
      .maybeSingle();
    if (!v) return json({ error: '找不到这一版' }, 404);
    if (v.kind === 'fordexa') return json({ error: 'Fordexa 原版不用核对' }, 400);
    target = { table: 'script_versions', id: v.id, text: v.body, scriptId: v.script_id };
  } else {
    const s = await ownScript(user.id, String(body.scriptId ?? ''));
    if (!s) return json({ error: '找不到这条稿子' }, 404);
    target = { table: 'scripts', id: s.id, text: s.body, scriptId: s.id };
  }

  const script = await ownScript(user.id, target.scriptId);
  const source = script ? await sourceForScript(script) : null;
  if (!source) return json({ error: '这条没有文章可依据，没法核对' }, 400);

  let claims: Claim[] | null = null;
  try {
    const raw = await chatDeepSeek({
      system: CLAIM_REVIEW_PROMPT,
      user: `【口播稿】\n${target.text}\n\n【依据材料】\n${source.text}`,
      temperature: 0,
      maxTokens: 1500,
    });
    claims = parseClaimReview(raw);
    if (!claims) console.error('review: unparseable', raw.slice(0, 300));
  } catch (e) {
    console.error('review: model failed', (e as Error).message);
  }

  const checks: Checks = {
    figures: unsupportedFigures(target.text, source.text),
    claims,
    claimsFailed: claims === null,
    truncated: source.truncated,
  };
  // 只写回核对时的那份正文:核对期间正文被改了,结果就作废(不然旧结果会贴到新正文上)
  const { error } = await db
    .from(target.table)
    .update({ checks })
    .eq('id', target.id)
    .eq('user_id', user.id)
    .eq('body', target.text);
  if (error) return json({ error: '保存核对结果失败' }, 502);
  return json({ checks });
}
