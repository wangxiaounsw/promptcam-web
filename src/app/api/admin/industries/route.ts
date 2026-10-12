import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 行业字典 + 每个行业的主题。给客户卡片的下拉框和选题库用。 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const db = admin();
  const [{ data, error }, { data: topics }] = await Promise.all([
    db.from('industries').select('key, name_zh, name_en').eq('is_active', true).order('sort_order'),
    db.from('topics').select('industry, key, name_zh').eq('is_active', true).order('sort_order'),
  ]);
  if (error) return no({ error: 'Load failed.' }, 502);
  return no({ industries: data ?? [], topics: topics ?? [] }, 200);
}
