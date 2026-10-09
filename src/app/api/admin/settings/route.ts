import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';
import { DEFAULT_PROMPT } from '@/lib/draft-prompt';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 可在后台直接改的设置。现在只有起草稿的提示词骨架。 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  const { data } = await admin()
    .from('app_settings')
    .select('value')
    .eq('key', 'draft_prompt')
    .maybeSingle();
  return no(
    {
      draftPrompt: data?.value ?? '',
      // 前端要能显示「恢复默认」,所以把默认值也发过去
      defaultPrompt: DEFAULT_PROMPT,
    },
    200,
  );
}

export async function PUT(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  let body: { draftPrompt?: string };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const value = (body.draftPrompt ?? '').trim().slice(0, 8000);
  const { error } = await admin()
    .from('app_settings')
    .upsert({ key: 'draft_prompt', value }, { onConflict: 'key' });
  if (error) return no({ error: '保存失败' }, 502);
  return no({ ok: true }, 200);
}
