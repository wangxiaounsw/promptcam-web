import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 公司列表,带每家的人数 —— 「桂冠下面挂了几个人」是你唯一会问的数字。 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  const db = admin();
  const [orgs, members] = await Promise.all([
    db.from('organizations').select('*').order('created_at'),
    db.from('profiles').select('org_id'),
  ]);
  if (orgs.error) return no({ error: 'Load failed.' }, 502);

  const count = new Map<string, number>();
  for (const m of members.data ?? []) {
    if (m.org_id) count.set(m.org_id, (count.get(m.org_id) ?? 0) + 1);
  }
  return no(
    {
      orgs: (orgs.data ?? []).map((o) => ({ ...o, members: count.get(o.id) ?? 0 })),
    },
    200,
  );
}

export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  let body: { name?: string; industry?: string | null };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const name = (body.name ?? '').trim().slice(0, 120);
  if (!name) return no({ error: '公司名不能为空。' }, 400);

  const { error } = await admin().from('organizations').insert({
    name,
    industry: body.industry ? String(body.industry) : null,
  });
  if (error) {
    return no(
      { error: error.message.includes('foreign key') ? '行业不存在' : '保存失败' },
      502,
    );
  }
  return no({ ok: true }, 200);
}

/** 开通/停用、改名、改行业。开通 = 这家公司下面所有人都能看正文。 */
export async function PATCH(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const id = String(body.id ?? '');
  if (!id) return no({ error: 'Missing id.' }, 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 120);
  if ('industry' in body) patch.industry = body.industry ? String(body.industry) : null;
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
  if (typeof body.note === 'string') patch.note = body.note.trim().slice(0, 500) || null;
  if (!Object.keys(patch).length) return no({ error: 'Nothing to update.' }, 400);

  const { error } = await admin().from('organizations').update(patch).eq('id', id);
  if (error) return no({ error: 'Update failed.' }, 502);
  return no({ ok: true }, 200);
}
