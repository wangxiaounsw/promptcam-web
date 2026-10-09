import { NextRequest, NextResponse } from 'next/server';
import { admin, configured } from '@/lib/auth';
import { mailAccessRequested } from '@/lib/mail';

export const runtime = 'nodejs';
export const maxDuration = 20;

/**
 * 有人申请成为企业用户时通知 Fordexa。
 * 落点和灵感提交一样,由 Supabase 的数据库触发器调过来(见 007_access_requests.sql)。
 */
export async function POST(request: NextRequest) {
  const secret = process.env.HOOK_SECRET ?? '';
  if (!configured || !secret) {
    return NextResponse.json({ error: 'Hook not configured.' }, { status: 503 });
  }
  if (request.headers.get('x-hook-secret') !== secret) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });
  }

  let payload: {
    type?: string;
    record?: {
      user_id?: string;
      company?: string;
      contact?: string | null;
      note?: string | null;
    };
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const r = payload.record;
  if (payload.type !== 'INSERT' || !r?.user_id || !r.company) {
    // 回 200,否则 Supabase 会一直重试
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  let from = '';
  try {
    const { data } = await admin().auth.admin.getUserById(r.user_id);
    from = data?.user?.email ?? '';
  } catch {
    /* 拿不到邮箱也照发 */
  }

  const mailed = await mailAccessRequested({
    from,
    company: r.company,
    contact: r.contact ?? null,
    note: r.note ?? null,
  });
  return NextResponse.json({ ok: true, mailed }, { status: 200 });
}
