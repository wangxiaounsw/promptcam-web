import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 行业选题库。客户端只读（RLS 按行业过滤），维护全在这里走 service_role。 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const { data, error } = await admin()
    .from('idea_bank')
    .select('*')
    .order('industry', { nullsFirst: true })
    .order('sort_order');
  if (error) return no({ error: 'Load failed.' }, 502);
  return no({ bank: data ?? [] }, 200);
}

/** 加一条选题。industry 留空 = 所有客户都看得到的通用选题。 */
export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  let body: { title?: string; industry?: string | null; sort_order?: number };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const title = (body.title ?? '').trim().slice(0, 200);
  if (!title) return no({ error: 'Missing title.' }, 400);

  const { error } = await admin().from('idea_bank').insert({
    title,
    industry: body.industry ? String(body.industry) : null,
    sort_order: typeof body.sort_order === 'number' ? Math.round(body.sort_order) : 0,
  });
  // 外键报错 = 行业 key 拼错了，说清楚比给个 502 有用
  if (error) return no({ error: error.message.includes('foreign key') ? '行业不存在' : '保存失败' }, 502);
  return no({ ok: true }, 200);
}

/** 改一条（标题/行业/排序/上下架）。 */
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
  if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 200);
  if ('industry' in body) patch.industry = body.industry ? String(body.industry) : null;
  if (typeof body.sort_order === 'number') patch.sort_order = Math.round(body.sort_order);
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
  if (!Object.keys(patch).length) return no({ error: 'Nothing to update.' }, 400);

  const { error } = await admin().from('idea_bank').update(patch).eq('id', id);
  if (error) return no({ error: 'Update failed.' }, 502);
  return no({ ok: true }, 200);
}

/** 下架用 is_active=false；这里的删除只给「刚加错了」用。 */
export async function DELETE(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return no({ error: 'Missing id.' }, 400);
  const { error } = await admin().from('idea_bank').delete().eq('id', id);
  if (error) return no({ error: 'Delete failed.' }, 502);
  return no({ ok: true }, 200);
}
