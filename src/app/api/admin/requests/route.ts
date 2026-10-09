import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 待处理队列。客户提交的灵感,按提交时间从旧到新 —— 先提交的先写。
 * email 在 auth.users 不在 profiles,所以要拼一次。
 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  const open = request.nextUrl.searchParams.get('open') === '1';
  const db = admin();
  let q = db.from('idea_requests').select('*').order('created_at');
  if (open) q = q.in('status', ['submitted', 'in_progress']);

  const [reqs, users] = await Promise.all([
    q,
    db.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  if (reqs.error) return no({ error: 'Load failed.' }, 502);

  const emailOf = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? '']));
  const requests = (reqs.data ?? []).map((r) => ({
    ...r,
    email: emailOf.get(r.user_id) ?? '',
  }));
  return no({ requests }, 200);
}

/** 改状态 / 写回复。状态只能由这里推,客户端改不了。 */
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
  if (
    body.status === 'submitted' ||
    body.status === 'in_progress' ||
    body.status === 'declined'
  ) {
    patch.status = body.status;
  }
  // delivered 不走这里:它必须和写稿一起做,见下面的 POST
  if (typeof body.reply === 'string') patch.reply = body.reply.trim().slice(0, 500) || null;
  if (!Object.keys(patch).length) return no({ error: 'Nothing to update.' }, 400);

  const { error } = await admin().from('idea_requests').update(patch).eq('id', id);
  if (error) return no({ error: 'Update failed.' }, 502);
  return no({ ok: true }, 200);
}

/**
 * 交付:写好的稿子下发给提交人,同时把这条提交标成 delivered 并挂上 script_id。
 * 两件事必须一起做 —— 只插稿子客户看不到进度,只改状态客户点进去是空的。
 * 没有事务可用,所以插稿子成功、改状态失败时把稿子删掉回滚。
 */
export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  let body: { id?: string; title?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const id = String(body.id ?? '');
  const title = (body.title ?? '').trim().slice(0, 200);
  const text = (body.body ?? '').trim();
  if (!id || !title || !text) return no({ error: 'Missing id, title or body.' }, 400);

  const db = admin();
  const { data: req, error: readErr } = await db
    .from('idea_requests')
    .select('id, user_id, status')
    .eq('id', id)
    .maybeSingle();
  if (readErr || !req) return no({ error: 'Request not found.' }, 404);
  if (req.status === 'delivered') return no({ error: '这条已经交付过了。' }, 409);

  const { data: script, error: insErr } = await db
    .from('scripts')
    .insert({ user_id: req.user_id, title, body: text, source: 'fordexa', sort_order: 0 })
    .select('id')
    .single();
  if (insErr || !script) return no({ error: 'Insert failed.' }, 502);

  const { error: updErr } = await db
    .from('idea_requests')
    .update({ status: 'delivered', script_id: script.id })
    .eq('id', id);
  if (updErr) {
    await db.from('scripts').delete().eq('id', script.id);
    return no({ error: 'Update failed.' }, 502);
  }
  return no({ ok: true, scriptId: script.id }, 200);
}
