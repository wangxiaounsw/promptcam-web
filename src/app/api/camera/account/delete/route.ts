import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, missingEnv, requestUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * 删除账号。Apple 审核 5.1.1(v) 要求 App 内可删，
 * 而客户端删不了自己的 auth 用户（需要 service_role），所以必须有这个端点。
 * profiles / scripts / ideas 都是 on delete cascade，删 auth 用户即全清。
 */
export async function POST(request: NextRequest) {
  const reply = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

  if (!configured) return reply({ error: 'Server not configured.', missing: missingEnv() }, 503);
  const user = await requestUser(request);
  if (!user) return reply({ error: 'Please sign in again.' }, 401);

  try {
    const { error } = await admin().auth.admin.deleteUser(user.id);
    if (error) return reply({ error: 'Delete failed.' }, 502);
    return reply({ ok: true });
  } catch {
    return reply({ error: 'Delete failed.' }, 502);
  }
}
