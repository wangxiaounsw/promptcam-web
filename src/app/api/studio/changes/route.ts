import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { describeChange, type ChangeInput } from '@/lib/studio/changes';
import { json, peopleById, requireStudioUser, scriptInScope } from '@/lib/studio/server';

export const runtime = 'nodejs';

/** 一条稿子的修改记录,新的在前。App 里的修改也在(数据库触发器记的) */
export async function GET(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  const script = await scriptInScope(user.orgId, request.nextUrl.searchParams.get('scriptId') ?? '');
  if (!script) return json({ error: '找不到这条稿子' }, 404);

  const { data, error } = await admin()
    .from('script_changes')
    .select('id, at, action, field, old_value, new_value, actor_id')
    .eq('script_id', script.id)
    .order('at', { ascending: false })
    .limit(100);
  if (error) return json({ error: '读取失败' }, 502);
  const rows = data ?? [];
  const people = await peopleById(rows.map((r) => r.actor_id as string | null));
  return json({
    changes: rows.map((r) => {
      const c: ChangeInput = {
        action: r.action as ChangeInput['action'],
        field: (r.field as string | null) ?? null,
        old: (r.old_value as string | null) ?? null,
        new: (r.new_value as string | null) ?? null,
      };
      return {
        id: r.id as string,
        at: r.at as string,
        ...c,
        text: describeChange(c),
        actor: (r.actor_id && people.get(r.actor_id as string)) || null,
      };
    }),
  });
}
