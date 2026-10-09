import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';
import { mailAccessApproved } from '@/lib/mail';

export const runtime = 'nodejs';
export const maxDuration = 30;

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 申请列表。待处理的排前面。 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  const db = admin();
  const [reqs, users] = await Promise.all([
    db.from('access_requests').select('*').order('created_at', { ascending: false }),
    db.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  if (reqs.error) return no({ error: 'Load failed.' }, 502);

  const emailOf = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? '']));
  const requests = (reqs.data ?? [])
    .map((r) => ({ ...r, email: emailOf.get(r.user_id) ?? '' }))
    .sort((a, b) =>
      a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1,
    );
  return no({ requests }, 200);
}

/**
 * 通过 / 拒绝。
 *
 * 通过做四件事,缺一不可:
 *   1. 公司不存在就建一个（同名的直接复用，不重复建）
 *   2. 把申请人挂到这家公司下面
 *   3. 公司标成已开通 —— 以后同事进来只要挂上去就行，不用再审一次
 *   4. 申请人本人标成 Fordexa 客户 —— 语音配额是按人算的，
 *      只开通公司的话他能看内容但用不了语音跟随
 */
export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  let body: { id?: string; approve?: boolean; reply?: string; orgId?: string };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const id = String(body.id ?? '');
  if (!id) return no({ error: 'Missing id.' }, 400);

  const db = admin();
  const { data: req } = await db
    .from('access_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!req) return no({ error: 'Request not found.' }, 404);
  if (req.status !== 'pending') return no({ error: '这条已经处理过了。' }, 409);

  if (!body.approve) {
    const { error } = await db
      .from('access_requests')
      .update({
        status: 'declined',
        reply: (body.reply ?? '').trim().slice(0, 500) || null,
        handled_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) return no({ error: 'Update failed.' }, 502);
    return no({ ok: true }, 200);
  }

  // 1 + 2 + 3：公司
  let orgId = body.orgId ?? '';
  if (!orgId) {
    const { data: existing } = await db
      .from('organizations')
      .select('id')
      .eq('name', req.company)
      .maybeSingle();
    if (existing) {
      orgId = existing.id as string;
    } else {
      const { data: created, error } = await db
        .from('organizations')
        .insert({ name: req.company, is_active: true })
        .select('id')
        .single();
      if (error || !created) return no({ error: '建公司失败' }, 502);
      orgId = created.id as string;
    }
  }
  await db.from('organizations').update({ is_active: true }).eq('id', orgId);

  // 4：申请人本人
  const { error: pErr } = await db
    .from('profiles')
    .update({ org_id: orgId, is_fordexa_client: true })
    .eq('id', req.user_id);
  if (pErr) return no({ error: '开通失败' }, 502);

  const { error: rErr } = await db
    .from('access_requests')
    .update({ status: 'approved', handled_at: new Date().toISOString() })
    .eq('id', id);
  if (rErr) return no({ error: 'Update failed.' }, 502);

  // 通知申请人。发不出去不影响开通 —— 他重进 App 就能看到。
  let mailed = false;
  try {
    const { data: u } = await db.auth.admin.getUserById(req.user_id);
    const to = u?.user?.email ?? '';
    if (to) mailed = await mailAccessApproved({ to, company: req.company });
  } catch {
    /* 同上 */
  }
  return no({ ok: true, orgId, mailed }, 200);
}
