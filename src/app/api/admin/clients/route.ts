import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, missingEnv, requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 客户列表。email 不在 profiles 里（它在 auth.users），所以要用 service_role 的
 * admin.listUsers() 取回来再和 profiles 拼。顺带聚合每人的脚本数/已录数 ——
 * 「谁还剩几条没录」是这个后台存在的主要理由。
 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.', missing: missingEnv() }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  const db = admin();
  const [users, profiles, scripts] = await Promise.all([
    db.auth.admin.listUsers({ page: 1, perPage: 200 }),
    db.from('profiles').select('*'),
    db.from('scripts').select('user_id, status, source'),
  ]);
  if (users.error || profiles.error) return no({ error: 'Load failed.' }, 502);

  const emailOf = new Map(users.data.users.map((u) => [u.id, u.email ?? '']));
  const stats = new Map<string, { total: number; recorded: number }>();
  for (const s of scripts.data ?? []) {
    if (s.source !== 'fordexa') continue; // 只统计下发的，自己写的不算交付量
    const cur = stats.get(s.user_id) ?? { total: 0, recorded: 0 };
    cur.total += 1;
    if (s.status === 'recorded') cur.recorded += 1;
    stats.set(s.user_id, cur);
  }

  const clients = (profiles.data ?? [])
    .map((p) => ({
      ...p,
      email: emailOf.get(p.id) ?? '',
      scripts_total: stats.get(p.id)?.total ?? 0,
      scripts_recorded: stats.get(p.id)?.recorded ?? 0,
    }))
    // 付费客户排前面，其余按注册时间倒序（新注册的要被看见才能标记）
    .sort((a, b) =>
      a.is_fordexa_client === b.is_fordexa_client
        ? String(b.created_at).localeCompare(String(a.created_at))
        : a.is_fordexa_client
          ? -1
          : 1,
    );
  return no({ clients }, 200);
}

/** 改客户权限/配额/行业。白名单字段，别让前端想改什么就改什么。 */
export async function PATCH(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  const me = await requireAdmin(request);
  if (!me) return no({ error: 'Not authorised.' }, 403);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const id = String(body.id ?? '');
  if (!id) return no({ error: 'Missing id.' }, 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.is_fordexa_client === 'boolean') patch.is_fordexa_client = body.is_fordexa_client;
  if (typeof body.industry === 'string') patch.industry = body.industry.slice(0, 60) || null;
  if (typeof body.live_seconds_remaining === 'number') {
    patch.live_seconds_remaining = Math.max(0, Math.min(360000, Math.round(body.live_seconds_remaining)));
  }
  // is_admin 刻意不开放：要加管理员去 Supabase Dashboard 手动勾，
  // 免得后台被攻破就能自己造管理员。
  if (!Object.keys(patch).length) return no({ error: 'Nothing to update.' }, 400);

  const { error } = await admin().from('profiles').update(patch).eq('id', id);
  if (error) return no({ error: 'Update failed.' }, 502);
  return no({ ok: true }, 200);
}
