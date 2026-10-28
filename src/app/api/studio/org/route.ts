import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { recordByFor } from '@/lib/studio/calendar';
import { pageAll } from '@/lib/studio/posts-db';
import { cleanWeekdays, validateLeadDays } from '@/lib/studio/posts-map';
import { json, requireStudioUser } from '@/lib/studio/server';
import { melbourneDay } from '@/lib/studio/week';

export const runtime = 'nodejs';

/** 还没录的进度：改「提前几天」时这些视频要重算录制截止日 */
const BEFORE_RECORDED = ['draft', 'refining', 'final'];
const BATCH = 20;

/** 改了「提前几天录完」：今天以后发布、还没到已录的视频，逐条重算 record_by（带 edited_by，触发器记在改的人名下） */
async function recomputeRecordBy(orgId: string, leadDays: number, editorId: string): Promise<void> {
  const db = admin();
  const today = melbourneDay(new Date());
  // 超过 1000 行也要取全（PostgREST 单次上限），所以分页
  const found = await pageAll<{ id: string; publish_on: string; record_by: string | null }>((from, to) =>
    db.from('scripts').select('id, publish_on, record_by')
      .eq('org_id', orgId).eq('kind', 'video').gte('publish_on', today)
      .in('stage', BEFORE_RECORDED).neq('status', 'archived')
      .order('id').range(from, to),
  );
  const rows = found
    .map((r) => ({ id: r.id, next: recordByFor(r.publish_on, leadDays, 'video'), was: r.record_by }))
    .filter((r) => r.next !== r.was);
  for (let i = 0; i < rows.length; i += BATCH) {
    const results = await Promise.all(
      rows.slice(i, i + BATCH).map((r) =>
        db.from('scripts').update({ record_by: r.next, edited_by: editorId }).eq('id', r.id).eq('org_id', orgId),
      ),
    );
    const bad = results.find((x) => x.error);
    if (bad?.error) throw bad.error;
  }
}

/** 改这家公司的固定发布日、提前几天录完（管理员和本公司成员）：{ weekdays?, leadDays? } */
export async function PATCH(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '先选一家公司' }, 400);
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'Bad request.' }, 400);
    body = raw as Record<string, unknown>;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const hasWeekdays = body.weekdays !== undefined;
  const hasLead = body.leadDays !== undefined;
  if (!hasWeekdays && !hasLead) return json({ error: 'Bad request.' }, 400);
  if (hasWeekdays && !Array.isArray(body.weekdays)) return json({ error: 'Bad request.' }, 400);

  const update: { post_weekdays?: number[]; record_lead_days?: number } = {};
  if (hasWeekdays) update.post_weekdays = cleanWeekdays(body.weekdays);
  if (hasLead) {
    const v = validateLeadDays(body.leadDays);
    if (v.error !== null) return json({ error: v.error }, 400);
    update.record_lead_days = v.value;
  }

  const { data, error } = await admin()
    .from('organizations')
    .update(update)
    .eq('id', user.orgId)
    .select('post_weekdays, record_lead_days')
    .maybeSingle();
  if (error) {
    console.error('org PATCH', error);
    return json({ error: '保存失败' }, 502);
  }
  if (!data) return json({ error: '找不到这家公司' }, 404);

  if (update.record_lead_days !== undefined) {
    try {
      await recomputeRecordBy(user.orgId, update.record_lead_days, user.id);
    } catch (e) {
      console.error('org PATCH recompute record_by', e);
      return json({ error: '天数存上了，但有几条的录制日期没更新成功，再保存一次试试' }, 502);
    }
  }
  const row = data as { post_weekdays: number[] | null; record_lead_days: number | null };
  return json({ weekdays: row.post_weekdays ?? [], leadDays: row.record_lead_days ?? 5 });
}
