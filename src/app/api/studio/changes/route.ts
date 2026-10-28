import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { describeChange, type ChangeInput } from '@/lib/studio/changes';
import { json, peopleById, requireStudioUser, scriptInScope } from '@/lib/studio/server';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = 'id, script_id, at, action, field, old_value, new_value, actor_id';

type ChangeRow = {
  id: string; script_id: string; at: string; action: string; field: string | null;
  old_value: string | null; new_value: string | null; actor_id: string | null;
};

function toInput(r: ChangeRow): ChangeInput {
  return { action: r.action as ChangeInput['action'], field: r.field, old: r.old_value, new: r.new_value };
}

/** 修改记录,新的在前。App 里的修改也在(数据库触发器记的)。?scriptId= 一条稿子的;?scope=org&limit= 这家公司最近的 */
export async function GET(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  const params = request.nextUrl.searchParams;
  if (params.get('scope') === 'org') return orgChanges(user.orgId, params.get('limit'));

  const script = await scriptInScope(user.orgId, params.get('scriptId') ?? '');
  if (!script) return json({ error: '找不到这条稿子' }, 404);

  const { data, error } = await admin()
    .from('script_changes')
    .select(COLUMNS)
    .eq('script_id', script.id)
    .order('at', { ascending: false })
    .limit(100);
  if (error) return json({ error: '读取失败' }, 502);
  const rows = (data as ChangeRow[]) ?? [];
  const people = await peopleById(rows.map((r) => r.actor_id));
  return json({
    changes: rows.map((r) => ({
      id: r.id,
      at: r.at,
      ...toInput(r),
      text: describeChange(toInput(r)),
      actor: (r.actor_id && people.get(r.actor_id)) || null,
    })),
  });
}

async function orgChanges(orgId: string | null, rawLimit: string | null): Promise<Response> {
  if (!orgId) return json({ error: '先选一家公司' }, 400);
  const asked = Number(rawLimit);
  const limit = Number.isInteger(asked) && asked >= 1 ? Math.min(asked, 200) : 100;
  const db = admin();
  const { data, error } = await db
    .from('script_changes')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .order('at', { ascending: false })
    .limit(limit);
  if (error) return json({ error: '读取失败' }, 502);
  const rows = (data as ChangeRow[]) ?? [];
  const ids = [...new Set(rows.map((r) => r.script_id))];
  const [people, titles] = await Promise.all([
    peopleById(rows.map((r) => r.actor_id)),
    ids.length
      ? db.from('scripts').select('id, title').eq('org_id', orgId).in('id', ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (titles.error) return json({ error: '读取失败' }, 502);
  const titleById = new Map(((titles.data as { id: string; title: string }[]) ?? []).map((t) => [t.id, t.title]));
  return json({
    changes: rows.map((r) => ({
      id: r.id,
      at: r.at,
      scriptId: r.script_id,
      // 稿子删了就拿不到标题：删除记录的 old_value 是「标题 + 正文」，取第一行
      scriptTitle: titleById.get(r.script_id) ?? (r.old_value?.split('\n')[0] || '已删除的稿子'),
      ...toInput(r),
      text: describeChange(toInput(r)),
      actor: (r.actor_id && people.get(r.actor_id)) || null,
    })),
  });
}

/** 删一条修改记录：只有管理员，按 org_id 核对 */
export async function DELETE(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.isAdmin) return json({ error: '只有 Fordexa 能删记录' }, 403);
  if (!user.orgId) return json({ error: '先选一家公司' }, 400);
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!UUID.test(id)) return json({ error: '找不到这条记录' }, 404);
  const { data, error } = await admin()
    .from('script_changes')
    .delete()
    .eq('id', id)
    .eq('org_id', user.orgId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('changes DELETE', error);
    return json({ error: '删除失败' }, 502);
  }
  if (!data) return json({ error: '找不到这条记录' }, 404);
  return json({ ok: true });
}
