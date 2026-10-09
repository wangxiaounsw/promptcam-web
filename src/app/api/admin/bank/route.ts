import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 行业选题库。客户端只读（RLS 按行业过滤），维护全在这里走 service_role。 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const { data, error } = await admin()
    .from('idea_bank')
    .select('*')
    .order('industry', { nullsFirst: true })
    .order('sort_order');
  if (error) return no({ error: 'Load failed.' }, 502);
  return no({ bank: data ?? [] }, 200);
}

/**
 * 发布选题。titles 一行一条 —— 写选题的时候是一口气列十几条，
 * 一条一条点「保存」没人受得了。industry 留空 = 所有客户都看得到的通用选题。
 * sort_order 接着这个行业现有的最大值往后排，新加的排在后面。
 */
export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  let body: { titles?: string[]; title?: string; industry?: string | null };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const industry = body.industry ? String(body.industry) : null;
  const titles = (body.titles ?? (body.title ? [body.title] : []))
    .map((t) => String(t).trim().slice(0, 200))
    .filter(Boolean);
  if (!titles.length) return no({ error: '没有可发布的选题。' }, 400);
  if (titles.length > 100) return no({ error: '一次最多 100 条。' }, 400);

  const db = admin();
  // 同一行业里接着往后排
  let base = 0;
  const { data: last } = await (industry
    ? db.from('idea_bank').select('sort_order').eq('industry', industry)
    : db.from('idea_bank').select('sort_order').is('industry', null)
  )
    .order('sort_order', { ascending: false })
    .limit(1);
  if (last?.length) base = (last[0].sort_order ?? 0) + 1;

  const { error } = await db
    .from('idea_bank')
    .insert(titles.map((title, i) => ({ title, industry, sort_order: base + i })));
  // 外键报错 = 行业 key 拼错了，说清楚比给个 502 有用
  if (error) {
    return no(
      { error: error.message.includes('foreign key') ? '行业不存在' : '保存失败' },
      502,
    );
  }
  return no({ ok: true, inserted: titles.length }, 200);
}

/** 改一条（标题/行业/排序/上下架）。 */
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
  if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 200);
  if ('industry' in body) patch.industry = body.industry ? String(body.industry) : null;
  if (typeof body.sort_order === 'number') patch.sort_order = Math.round(body.sort_order);
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
  if (!Object.keys(patch).length) return no({ error: 'Nothing to update.' }, 400);

  const { error } = await admin().from('idea_bank').update(patch).eq('id', id);
  if (error) return no({ error: 'Update failed.' }, 502);
  return no({ ok: true }, 200);
}

/** 下架用 is_active=false；这里的删除只给「刚加错了」用。 */
export async function DELETE(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return no({ error: 'Missing id.' }, 400);
  const { error } = await admin().from('idea_bank').delete().eq('id', id);
  if (error) return no({ error: 'Delete failed.' }, 502);
  return no({ ok: true }, 200);
}
