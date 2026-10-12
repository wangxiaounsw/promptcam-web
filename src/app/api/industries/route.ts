import { NextResponse } from 'next/server';
import { admin, configured } from '@/lib/auth';

export const runtime = 'nodejs';

/** 行业字典，公开。申请开通的下拉框用；表本身只对登录用户开放，所以这里用服务端 key 读 */
export async function GET() {
  if (!configured) return NextResponse.json({ industries: [] }, { status: 503 });
  const { data } = await admin()
    .from('industries')
    .select('key, name_zh')
    .eq('is_active', true)
    .order('sort_order');
  return NextResponse.json(
    { industries: (data ?? []).map((i) => ({ key: i.key as string, name: i.name_zh as string })) },
    { headers: { 'Cache-Control': 'public, max-age=600' } },
  );
}
