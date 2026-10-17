import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { DEFAULT_PROMPT } from '@/lib/draft-prompt';
import { promptHistory, savePrompt, scriptPrompt } from '@/lib/prompts';
import { FACT_RULES } from '@/lib/studio/fact-rules';
import { json, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

const LIMIT = 8000;

/**
 * 我所在公司的写口播提示词：现在生效的是哪份、从哪来（公司 / 行业 / 通用 / 默认），
 * 加上这家公司的历史版本。固定事实规则只读，一起发给前端显示。
 */
export async function GET(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  const current = await scriptPrompt(user.orgId);
  return json({
    ...current,
    history: user.orgId ? await promptHistory('write_script', user.orgId) : [],
    defaultPrompt: DEFAULT_PROMPT,
    factRules: FACT_RULES,
    hasOrg: Boolean(user.orgId),
  });
}

/** 存成我所在公司的新一版（旧版自动停用）。body 为空 = 停用公司专属，回落到行业/通用 */
export async function PUT(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '还没挂公司，提示词没地方存' }, 400);

  let body: { body?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const text = String(body.body ?? '').trim().slice(0, LIMIT);
  if (!text) return json({ error: '提示词不能为空' }, 400);
  const note = String(body.note ?? '').trim().slice(0, 500) || null;

  const { data: org } = await admin()
    .from('organizations')
    .select('name, industry')
    .eq('id', user.orgId)
    .maybeSingle();
  try {
    const saved = await savePrompt({
      step: 'write_script',
      orgId: user.orgId,
      industry: (org?.industry as string | null) ?? null,
      name: `写口播 · ${org?.name ?? '本公司'}`,
      body: text,
      note,
      userId: user.id,
    });
    return json({ ok: true, version: saved });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
