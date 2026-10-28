import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { resolveStudioVoice } from '@/lib/voice';
import { previewHash, previewPathAllowed } from '@/lib/studio/preview';
import { researchMarks } from '@/lib/studio/markers';
import { melbourneDay } from '@/lib/studio/week';
import { SCRIPT_COLUMNS, json, peopleById, requireStudioUser, scriptInScope, type ScriptRow } from '@/lib/studio/server';

export const runtime = 'nodejs';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 正在看的这家公司的稿子(不含归档),带口播库要用的几个派生字段和「谁放的」 */
export async function GET(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ today: melbourneDay(new Date()), industry: null, scripts: [] });

  const db = admin();
  const { data, error } = await db
    .from('scripts')
    .select(`${SCRIPT_COLUMNS}, publish_on, stage, kind`)
    .eq('org_id', user.orgId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) return json({ error: '读取失败' }, 502);
  // publish_on/stage/kind 是 v3 迁移加的新列，SCRIPT_COLUMNS 不含，这里单独带上
  const rows = (data ?? []) as unknown as (ScriptRow & { publish_on: string | null; stage: string; kind: string })[];

  const [{ voiceId }, versions, people, org] = await Promise.all([
    resolveStudioVoice(user),
    rows.length
      ? db.from('script_versions').select('script_id').in('script_id', rows.map((r) => r.id)).then((r) => r.data ?? [])
      : Promise.resolve([] as { script_id: string }[]),
    peopleById(rows.map((r) => r.created_by)),
    db.from('organizations').select('industry').eq('id', user.orgId).maybeSingle().then((r) => (r.data as { industry: string | null } | null)?.industry ?? null),
  ]);
  const count = new Map<string, number>();
  for (const v of versions) count.set(v.script_id, (count.get(v.script_id) ?? 0) + 1);

  return json({
    today: melbourneDay(new Date()),
    // 行业整家公司一个，已录的叫法（data 行业叫「已配音」）按它变
    industry: org,
    scripts: rows.map((r) => ({
      ...r,
      research: researchMarks(r.body).length,
      hasAudio:
        previewPathAllowed(r.audio_path, { orgId: r.org_id, ownerId: r.user_id }) &&
        r.audio_hash === previewHash(r.body, voiceId),
      versions: count.get(r.id) ?? 0,
      createdBy: (r.created_by && people.get(r.created_by)) || null,
    })),
  });
}

/** 改标题/正文/状态/录完日期。正文改了,旧的核对结果作废 */
export async function PATCH(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const script = await scriptInScope(user.orgId, String(body.id ?? ''));
  if (!script) return json({ error: '找不到这条稿子' }, 404);

  const patch: Record<string, unknown> = {};
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 200);
  if (typeof body.body === 'string' && body.body.trim() && body.body.trim() !== script.body) {
    patch.body = body.body.trim();
    patch.checks = null;
  }
  if (body.status === 'ready' || body.status === 'recorded' || body.status === 'archived') {
    patch.status = body.status;
  }
  if ('record_by' in body) {
    if (body.record_by === null) patch.record_by = null;
    else if (typeof body.record_by === 'string' && DAY.test(body.record_by)) patch.record_by = body.record_by;
    else return json({ error: '日期格式不对' }, 400);
  }
  if (!Object.keys(patch).length) return json({ ok: true });

  const { error } = await admin()
    .from('scripts')
    .update({ ...patch, edited_by: user.id })
    .eq('id', script.id)
    .eq('org_id', script.org_id);
  if (error) return json({ error: '保存失败' }, 502);
  return json({ ok: true });
}
