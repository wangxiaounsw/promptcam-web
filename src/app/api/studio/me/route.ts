import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { json, peopleById, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

/**
 * 进工作台先问这个:我是谁、正在看哪家公司;管理员多一份公司列表给切换按钮用。
 * 403 = 工作台没对你开放。
 */
export async function GET(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  const db = admin();
  const [people, viewing] = await Promise.all([
    peopleById([user.id]),
    user.orgId
      ? db.from('organizations').select('id, name').eq('id', user.orgId).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  let orgs: { id: string; name: string; is_active: boolean; members: number }[] | undefined;
  if (user.isAdmin) {
    const [{ data: list }, { data: members }] = await Promise.all([
      db.from('organizations').select('id, name, is_active').order('created_at'),
      db.from('profiles').select('org_id').not('org_id', 'is', null),
    ]);
    const count = new Map<string, number>();
    for (const m of members ?? []) count.set(m.org_id as string, (count.get(m.org_id as string) ?? 0) + 1);
    orgs = (list ?? []).map((o) => ({
      id: o.id as string,
      name: o.name as string,
      is_active: Boolean(o.is_active),
      members: count.get(o.id as string) ?? 0,
    }));
  }

  return json({
    me: people.get(user.id) ?? { id: user.id, name: user.email.split('@')[0], avatarUrl: null, isAdmin: user.isAdmin },
    ownOrgId: user.ownOrgId,
    viewing: viewing ? { id: viewing.id as string, name: viewing.name as string } : null,
    ...(orgs ? { orgs } : {}),
  });
}
