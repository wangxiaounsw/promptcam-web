import { NextRequest, NextResponse } from 'next/server';
import { admin, configured } from '@/lib/auth';
import { mailIdeaSubmitted } from '@/lib/mail';

export const runtime = 'nodejs';
export const maxDuration = 20;

/**
 * 客户提交灵感时通知 Fordexa。
 *
 * 提交是 App 直接写 Supabase 的(RLS 把关),不经过我们的服务端,
 * 所以这里没有天然的 hook 点。改成「提交走我们的 API」会把 RLS 那层保障
 * 挪到应用层,不值得。用 Supabase 的 Database Webhook 反过来调我们:
 *
 *   Supabase Dashboard → Database → Webhooks → Create
 *     table   public.idea_requests
 *     events  INSERT
 *     URL     https://app.fordexa.com/api/hooks/idea-submitted
 *     header  x-hook-secret: <和 Vercel 的 HOOK_SECRET 一致>
 *
 * 没配 HOOK_SECRET 时直接 503 —— 不验证就收任何人的 POST,
 * 等于把「谁提交了什么」的邮件通道开给外面。
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
    record?: { user_id?: string; body?: string; note?: string | null; source?: string };
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const r = payload.record;
  if (payload.type !== 'INSERT' || !r?.user_id || !r.body) {
    // 不是我们关心的事件,回 200 —— 回错误码 Supabase 会一直重试
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  let from = '';
  try {
    const { data } = await admin().auth.admin.getUserById(r.user_id);
    from = data?.user?.email ?? '';
  } catch {
    /* 拿不到邮箱也照发,正文里写「未知账号」 */
  }

  const mailed = await mailIdeaSubmitted({
    from,
    body: r.body,
    note: r.note ?? null,
    fromBank: r.source === 'bank',
  });
  return NextResponse.json({ ok: true, mailed }, { status: 200 });
}
