import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requestUser } from '@/lib/auth';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 点赞 / 收藏。
 *   GET  /api/reactions?codes=FX-0001,FX-0002   → 每条的计数 + 我有没有点过
 *   POST /api/reactions {code, kind, on}        → 加 / 取消
 *
 * 点赞不用登录:浏览器生成一个 device id(x-device 头)按设备去重。
 * 收藏必须登录:用 Bearer token 里的用户。收藏是注册钩子 —— 想收藏就得先有账号。
 */
function deviceOf(request: NextRequest): string | null {
  const d = (request.headers.get('x-device') ?? '').trim();
  return /^[a-zA-Z0-9_-]{8,64}$/.test(d) ? d : null;
}

export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  const codes = (request.nextUrl.searchParams.get('codes') ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean).slice(0, 1000);
  const db = admin();
  const all = request.nextUrl.searchParams.get('all') === '1';
  if (!codes.length && !all) return no({ counts: {} }, 200);
  const [user, device] = [await requestUser(request), deviceOf(request)];
  const base = db.from('idea_bank').select('id, code, like_count, save_count').eq('is_published', true);
  const { data: ideas } = all ? await base : await base.in('code', codes);
  const byId = new Map((ideas ?? []).map((i) => [i.id as string, i]));
  const mine: Record<string, { liked: boolean; saved: boolean }> = {};
  for (const i of ideas ?? []) mine[i.code as string] = { liked: false, saved: false };
  if (ideas?.length && (user || device)) {
    let q = db.from('reactions').select('idea_id, kind').in('idea_id', ideas.map((i) => i.id));
    q = user ? q.or(`user_id.eq.${user.id}${device ? `,device_id.eq.${device}` : ''}`) : q.eq('device_id', device!);
    const { data: rs } = await q;
    for (const r of rs ?? []) {
      const code = byId.get(r.idea_id as string)?.code as string | undefined;
      if (!code) continue;
      if (r.kind === 'like') mine[code].liked = true;
      if (r.kind === 'save' && user) mine[code].saved = true;
    }
  }
  const counts: Record<string, { likes: number; saves: number }> = {};
  for (const i of ideas ?? []) counts[i.code as string] = { likes: (i.like_count as number) ?? 0, saves: (i.save_count as number) ?? 0 };
  return no({ counts, mine, signedIn: Boolean(user) }, 200);
}

export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  let body: { code?: string; kind?: string; on?: boolean };
  try { body = await request.json(); } catch { return no({ error: 'Bad request.' }, 400); }
  const code = String(body.code ?? '').toUpperCase();
  const kind = body.kind === 'save' ? 'save' : body.kind === 'like' ? 'like' : null;
  if (!code || !kind) return no({ error: 'Bad request.' }, 400);
  const user = await requestUser(request);
  const device = deviceOf(request);
  if (kind === 'save' && !user) return no({ error: 'sign_in', message: '收藏需要登录' }, 401);
  if (kind === 'like' && !user && !device) return no({ error: 'no_device' }, 400);

  const db = admin();
  const { data: idea } = await db.from('idea_bank').select('id').eq('code', code).eq('is_published', true).maybeSingle();
  if (!idea) return no({ error: 'Not found.' }, 404);

  const who = user ? { user_id: user.id } : { device_id: device! };
  if (body.on === false) {
    let q = db.from('reactions').delete().eq('idea_id', idea.id).eq('kind', kind);
    q = user ? q.eq('user_id', user.id) : q.eq('device_id', device!);
    await q;
  } else {
    // 已经点过就忽略(唯一索引兜底)
    await db.from('reactions').insert({ idea_id: idea.id, kind, ...who }).then(() => {}, () => {});
  }
  const { data: fresh } = await db.from('idea_bank').select('like_count, save_count').eq('id', idea.id).maybeSingle();
  return no({ ok: true, likes: fresh?.like_count ?? 0, saves: fresh?.save_count ?? 0 }, 200);
}
