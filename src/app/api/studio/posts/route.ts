import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { monthOf } from '@/lib/studio/calendar';
import { POST_COLUMNS, SignError, loadMonth, toCalendarPosts, type PostRow } from '@/lib/studio/posts-db';
import { validateNewPost } from '@/lib/studio/posts-map';
import { json, orgOwner, requireStudioUser, type StudioUser } from '@/lib/studio/server';
import { melbourneDay } from '@/lib/studio/week';

export const runtime = 'nodejs';

/** 发布日历：读一个月、加一条（管理员和本公司成员都行）。一切按 user.orgId 查。 */

async function gate(request: NextRequest): Promise<{ user: StudioUser; orgId: string } | Response> {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '先选一家公司' }, 400);
  return { user, orgId: user.orgId };
}

const failed = (e: unknown) =>
  e instanceof SignError ? json({ error: '图片暂时取不到，刷新一下再试' }, 502) : json({ error: '读取失败，刷新一下再试' }, 502);

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (g instanceof Response) return g;
  const asked = request.nextUrl.searchParams.get('month') ?? '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : monthOf(melbourneDay(new Date()));
  try {
    return json(await loadMonth(g.orgId, month, g.user.isAdmin));
  } catch (e) {
    return failed(e);
  }
}

export async function POST(request: NextRequest) {
  const g = await gate(request);
  if (g instanceof Response) return g;
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'Bad request.' }, 400);
    body = raw as Record<string, unknown>;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const v = validateNewPost(body);
  if (v.error !== null) return json({ error: v.error }, 400);
  // 口播稿挂在谁名下：本公司的人用自己，管理员往别家放就挂在那家最早的成员名下（照 pull）
  const owner = g.user.ownOrgId === g.orgId ? g.user.id : await orgOwner(g.orgId);
  if (!owner) return json({ error: '这家公司还没有人登录过，没法往它的口播库里放稿子' }, 400);
  const { data, error } = await admin()
    .from('scripts')
    .insert({
      ...v.value, user_id: owner, org_id: g.orgId, created_by: g.user.id, edited_by: g.user.id,
      source: 'self', status: 'ready', body: '', stage: 'draft', sort_order: 0,
    })
    .select(POST_COLUMNS)
    .single();
  if (error || !data) {
    console.error('posts POST insert', error);
    return json({ error: '保存失败' }, 502);
  }
  try {
    const [post] = await toCalendarPosts([data as PostRow], g.orgId, g.user.isAdmin);
    return json({ post });
  } catch (e) {
    return failed(e);
  }
}
