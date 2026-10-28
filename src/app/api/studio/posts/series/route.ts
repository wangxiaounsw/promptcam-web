import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { spreadDays } from '@/lib/studio/calendar';
import { parseSeriesLines } from '@/lib/studio/posts';
import { takenDays } from '@/lib/studio/posts-db';
import { validateSeriesBody } from '@/lib/studio/posts-map';
import { json, orgOwner, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

/** 排一个系列（管理员和本公司成员）：解析标题 → 集数接着现有最大号 → 按固定日往后铺，跳过已有非热点安排的日子 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '先选一家公司' }, 400);
  const orgId = user.orgId;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'Bad request.' }, 400);
  const v = validateSeriesBody(raw as Record<string, unknown>);
  if (v.error !== null) return json({ error: v.error }, 400);
  const parsed = parseSeriesLines(v.value.lines);
  if (parsed.error !== null) return json({ error: parsed.error }, 400);
  const { series, start, weekdays, dryRun } = v.value;
  const items = parsed.value;

  const db = admin();
  const [last, taken] = await Promise.all([
    db.from('scripts').select('episode').eq('org_id', orgId).eq('series', series).neq('status', 'archived')
      .not('episode', 'is', null)
      .order('episode', { ascending: false }).limit(1).maybeSingle(),
    takenDays(orgId, start).catch(() => null),
  ]);
  if (last.error || !taken) return json({ error: '读取失败，刷新一下再试' }, 502);
  const firstEpisode = ((last.data?.episode as number | undefined) ?? 0) + 1;

  const days = spreadDays({ start, weekdays, count: items.length, taken });
  if (days.length < items.length) return json({ error: '往后排不下这么多集，换个开始日期或多选几天' }, 400);
  const plan = items.map((it, i) => ({ day: days[i], title: it.title, kind: it.kind, episode: firstEpisode + i }));
  if (dryRun) return json({ plan });

  // 每集一条新口播稿（草稿、只有标题），挂在本公司的人（或那家最早的成员）名下
  const owner = user.ownOrgId === orgId ? user.id : await orgOwner(orgId);
  if (!owner) return json({ error: '这家公司还没有人登录过，没法往它的口播库里放稿子' }, 400);
  const { error } = await db.from('scripts').insert(
    plan.map((p) => ({
      user_id: owner, org_id: orgId, created_by: user.id, edited_by: user.id,
      source: 'self', status: 'ready', body: '', stage: 'draft', sort_order: 0,
      publish_on: p.day, kind: p.kind, is_extra: false, title: p.title, series, episode: p.episode,
    })),
  );
  if (error) {
    console.error('posts/series insert', error);
    return json({ error: '保存失败' }, 502);
  }
  return json({ created: plan.length });
}
