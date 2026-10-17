import { NextRequest, NextResponse } from 'next/server';
import { configured, requireAdmin } from '@/lib/auth';
import { DEFAULT_PROMPT } from '@/lib/draft-prompt';
import { promptHistory, savePrompt } from '@/lib/prompts';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 后台「起草稿的提示词」= 提示词库里「写口播 · 通用」那条(不限公司、不限行业)。
 * 2026-10-17 起不再存 app_settings —— 提示词只存提示词库一份,工作台也读这里。
 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  const [current] = (await promptHistory('write_script', null, 1)).filter((p) => p.status === 'active');
  return no(
    {
      draftPrompt: current?.body ?? '',
      // 前端要能显示「恢复默认」,所以把默认值也发过去
      defaultPrompt: DEFAULT_PROMPT,
    },
    200,
  );
}

export async function PUT(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  const user = await requireAdmin(request);
  if (!user) return no({ error: 'Not authorised.' }, 403);

  let body: { draftPrompt?: string };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const value = (body.draftPrompt ?? '').trim().slice(0, 8000) || DEFAULT_PROMPT;
  try {
    await savePrompt({
      step: 'write_script',
      orgId: null,
      industry: null,
      name: '写口播 · 通用',
      body: value,
      note: '后台「起草稿的提示词」修改',
      userId: user.id,
    });
  } catch {
    return no({ error: '保存失败' }, 502);
  }
  return no({ ok: true }, 200);
}
