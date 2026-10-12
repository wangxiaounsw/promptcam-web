import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requestUser } from '@/lib/auth';
import { mailAccessRequested } from '@/lib/mail';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 网站上的「申请开通」,不用登录:公司名 + 行业 + 邮箱,直接发邮件给 Fordexa(MAIL_ADMIN),
 * 回复地址就是申请人邮箱,Shawn 直接回信就能聊。
 * 如果他恰好登录着,顺手也记一条 access_requests,后台「通过」就能直接开通。
 */
export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  let body: { company?: string; industry?: string; email?: string; contact?: string; note?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  // 蜜罐:真人看不到这个字段,机器人会填
  if (body.website) return no({ ok: true }, 200);

  const company = (body.company ?? '').trim().slice(0, 120);
  const email = (body.email ?? '').trim().slice(0, 120);
  const contact = (body.contact ?? '').trim().slice(0, 80) || null;
  const note = (body.note ?? '').trim().slice(0, 500) || null;
  if (!company) return no({ error: '公司名得填。' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return no({ error: '邮箱格式不对。' }, 400);

  const db = admin();
  const wanted = (body.industry ?? '').trim();
  const { data: ind } = wanted
    ? await db.from('industries').select('key, name_zh').eq('key', wanted).eq('is_active', true).maybeSingle()
    : { data: null };
  if (!ind) return no({ error: '选一下行业。' }, 400);

  const mailed = await mailAccessRequested({
    from: email,
    company,
    industry: ind.name_zh as string,
    contact,
    note,
  });

  // 登录着的人:也落一条申请,后台一键开通;没登录的只靠邮件
  const user = await requestUser(request);
  if (user) {
    await db.from('access_requests').insert({ user_id: user.id, company, industry: ind.key, contact, note });
    await db.from('profiles').update({ industry: ind.key }).eq('id', user.id);
  }
  if (!mailed && !user) return no({ error: '发送失败，直接写信到 info@fordexa.com 吧。' }, 502);
  return no({ ok: true }, 200);
}
