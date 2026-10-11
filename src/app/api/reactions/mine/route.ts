import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requestUser } from '@/lib/auth';

export const runtime = 'nodejs';

/** 我收藏的口播 / 文章的编号列表(登录才有)。列表页「我的收藏」筛选用。 */
export async function GET(request: NextRequest) {
  if (!configured) return NextResponse.json({ codes: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const user = await requestUser(request);
  if (!user) return NextResponse.json({ codes: [], signedIn: false }, { headers: { 'Cache-Control': 'no-store' } });
  const db = admin();
  const { data } = await db.from('reactions').select('idea_id, idea_bank(code)').eq('user_id', user.id).eq('kind', 'save');
  const codes = (data ?? []).map((r) => (r.idea_bank as unknown as { code: string } | null)?.code).filter(Boolean);
  return NextResponse.json({ codes, signedIn: true }, { headers: { 'Cache-Control': 'no-store' } });
}
