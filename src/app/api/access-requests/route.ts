import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requestUser } from '@/lib/auth';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 网站上的「申请开通」。和 App 里那张表单落到同一张 access_requests,
 * 数据库触发器会给 Fordexa 发邮件,你在后台「申请」页批。
 * 一个人同时只能有一条待处理(表上有唯一索引兜底)。
 */
export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  const user = await requestUser(request);
  if (!user) return no({ error: 'Not signed in.' }, 401);

  let body: { company?: string; contact?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const company = (body.company ?? '').trim().slice(0, 120);
  if (!company) return no({ error: '公司名不能为空。' }, 400);
  const contact = (body.contact ?? '').trim().slice(0, 80) || null;
  const note = (body.note ?? '').trim().slice(0, 500) || null;

  const { error } = await admin()
    .from('access_requests')
    .insert({ user_id: user.id, company, contact, note });
  if (error) {
    if (error.message.includes('access_requests_one_pending')) {
      return no({ ok: true, pending: true }, 200);
    }
    return no({ error: '提交失败,稍后再试。' }, 502);
  }
  return no({ ok: true, pending: true }, 200);
}
