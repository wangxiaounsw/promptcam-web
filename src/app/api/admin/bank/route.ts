import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 网址片段。中文标题生成不出有意义的拉丁 slug,所以中文留空由调用方
 * 用编号兜底(/ideas/fx-0042)—— 比硬转拼音可读性更稳。
 */
function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

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
  if (typeof body.summary === 'string') patch.summary = body.summary.trim().slice(0, 400) || null;
  if (typeof body.script === 'string') patch.script = body.script.trim() || null;
  if (Array.isArray(body.refs)) {
    // 参考文献:[{label, url}]。url 只收 http(s) —— 公开页面会把它渲染成链接
    patch.refs = body.refs
      .slice(0, 20)
      .map((r) => r as { label?: unknown; url?: unknown })
      .map((r) => ({
        label: String(r.label ?? '').trim().slice(0, 200),
        url: /^https?:\/\//i.test(String(r.url ?? '')) ? String(r.url) : '',
      }))
      .filter((r) => r.label);
  }
  if (typeof body.slug === 'string') patch.slug = slugify(body.slug) || null;
  if (typeof body.is_published === 'boolean') {
    patch.is_published = body.is_published;
    // 第一次发布时记下时间,列表按它倒序
    if (body.is_published) patch.published_at = new Date().toISOString();
  }
  if (!Object.keys(patch).length) return no({ error: 'Nothing to update.' }, 400);

  const db = admin();
  // 要发布但还没有 slug:用编号兜底,/ideas/fx-0042 永远有效
  if (patch.is_published === true && !patch.slug) {
    const { data: cur } = await db
      .from('idea_bank')
      .select('slug, code')
      .eq('id', id)
      .maybeSingle();
    if (cur && !cur.slug && cur.code) patch.slug = String(cur.code).toLowerCase();
  }

  const { error } = await db.from('idea_bank').update(patch).eq('id', id);
  if (error) {
    return no(
      { error: error.message.includes('duplicate') ? '这个网址已经被占用' : 'Update failed.' },
      502,
    );
  }
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
