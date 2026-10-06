import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 某个客户的全部稿子（含他自己写的，便于看全貌）。 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return no({ error: 'Missing userId.' }, 400);

  const { data, error } = await admin()
    .from('scripts')
    .select('*')
    .eq('user_id', userId)
    .order('source')
    .order('sort_order')
    .order('created_at', { ascending: false });
  if (error) return no({ error: 'Load failed.' }, 502);
  return no({ scripts: data ?? [] }, 200);
}

/** 下发一条或多条稿子。source 固定 fordexa —— 这个端点就是用来下发的。 */
export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  let body: { userId?: string; items?: { title?: string; body?: string }[] };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const userId = String(body.userId ?? '');
  const items = (body.items ?? [])
    .map((x) => ({ title: (x.title ?? '').trim(), body: (x.body ?? '').trim() }))
    .filter((x) => x.title && x.body);
  if (!userId || !items.length) return no({ error: 'Missing userId or items.' }, 400);
  if (items.length > 50) return no({ error: 'Too many items.' }, 400);

  const { error } = await admin()
    .from('scripts')
    .insert(items.map((x, i) => ({ ...x, user_id: userId, source: 'fordexa', sort_order: i })));
  if (error) return no({ error: 'Insert failed.' }, 502);
  return no({ ok: true, inserted: items.length }, 200);
}

/** 改一条（标题/正文/状态/排序）。 */
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
  if (typeof body.body === 'string') patch.body = body.body.trim();
  if (typeof body.sort_order === 'number') patch.sort_order = Math.round(body.sort_order);
  if (body.status === 'ready' || body.status === 'recorded' || body.status === 'archived') {
    patch.status = body.status;
  }
  if (!Object.keys(patch).length) return no({ error: 'Nothing to update.' }, 400);

  const { error } = await admin().from('scripts').update(patch).eq('id', id);
  if (error) return no({ error: 'Update failed.' }, 502);
  return no({ ok: true }, 200);
}

export async function DELETE(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return no({ error: 'Missing id.' }, 400);
  const { error } = await admin().from('scripts').delete().eq('id', id);
  if (error) return no({ error: 'Delete failed.' }, 502);
  return no({ ok: true }, 200);
}
