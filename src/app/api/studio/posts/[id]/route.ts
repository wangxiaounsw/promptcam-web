import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { removePrivate } from '@/lib/studio/audio';
import { POST_COLUMNS, SignError, postInScope, toCalendarPosts, type PostRow } from '@/lib/studio/posts-db';
import { validateEdit } from '@/lib/studio/posts';
import { publishPatch, unpublishPatch } from '@/lib/studio/posts-publish';
import { json, requireStudioUser, type StudioUser } from '@/lib/studio/server';
import { melbourneDay } from '@/lib/studio/week';

export const runtime = 'nodejs';

/** 改一条 / 删一条（管理员和本公司成员）。一切按 user.orgId 查。 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = '找不到这一条';

type Ctx = { params: Promise<{ id: string }> };

async function gate(request: NextRequest): Promise<{ user: StudioUser; orgId: string } | Response> {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '先选一家公司' }, 400);
  return { user, orgId: user.orgId };
}

async function respondPost(row: PostRow, orgId: string, isAdmin: boolean): Promise<Response> {
  try {
    const [post] = await toCalendarPosts([row], orgId, isAdmin);
    return json({ post });
  } catch (e) {
    console.error('posts/[id] sign cover', e instanceof SignError ? 'sign failed' : e);
    return json({ error: '图片暂时取不到，刷新一下再试' }, 502);
  }
}

/** 读一条（管理员和本公司成员）：深链接打开别的月份的那一条时用 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '先选一家公司' }, 400);
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: NOT_FOUND }, 404);
  const row = await postInScope(user.orgId, id);
  if (!row) return json({ error: NOT_FOUND }, 404);
  return respondPost(row, user.orgId, user.isAdmin);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const g = await gate(request);
  if (g instanceof Response) return g;
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: NOT_FOUND }, 404);
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'Bad request.' }, 400);
    body = raw as Record<string, unknown>;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const current = await postInScope(g.orgId, id);
  if (!current) return json({ error: NOT_FOUND }, 404);

  const now = new Date().toISOString();
  const db = admin();
  let patch: Record<string, unknown>;

  if (body.action === 'publish') {
    const v = publishPatch(
      body.url,
      { stage: current.stage, publishOn: current.publish_on, kind: current.kind, body: current.body, mediaUrl: current.media_url },
      now, melbourneDay(new Date()),
    );
    if (v.error !== null) return json({ error: v.error }, 400);
    patch = v.value;
  } else if (body.action === 'unpublish') {
    const v = unpublishPatch({ stage: current.stage, publishedUrl: current.published_url });
    if (v.error !== null) return json({ error: v.error }, 400);
    patch = v.value;
  } else if (body.edit && typeof body.edit === 'object' && !Array.isArray(body.edit)) {
    const v = validateEdit(body.edit as Record<string, unknown>, {
      stage: current.stage, kind: current.kind, body: current.body, mediaUrl: current.media_url,
      xhsTitle: current.xhs_title, xhsBody: current.xhs_body,
    });
    if (v.error !== null) return json({ error: v.error }, 400);
    patch = v.value;
  } else {
    return json({ error: 'Bad request.' }, 400);
  }

  // edited_by 让触发器知道是谁改的；update 后 select 回来的 record_by 是触发器算好的
  const { data, error } = await db
    .from('scripts')
    .update({ ...patch, edited_by: g.user.id, updated_at: now })
    .eq('id', id)
    .eq('org_id', g.orgId)
    .select(POST_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error('posts/[id] PATCH update', error);
    return json({ error: '保存失败' }, 502);
  }
  if (!data) return json({ error: NOT_FOUND }, 404);

  return respondPost(data as PostRow, g.orgId, g.user.isAdmin);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const g = await gate(request);
  if (g instanceof Response) return g;
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: NOT_FOUND }, 404);
  const current = await postInScope(g.orgId, id);
  if (!current) return json({ error: NOT_FOUND }, 404);
  if (current.stage === 'published') return json({ error: '已发布的不能删' }, 400);

  // 删整条口播稿；触发器记「删除」时用 edited_by 当操作人，所以先写上是谁
  const db = admin();
  const mark = await db
    .from('scripts').update({ edited_by: g.user.id }).eq('id', id).eq('org_id', g.orgId).neq('stage', 'published');
  if (mark.error) {
    console.error('posts/[id] DELETE mark editor', mark.error);
    return json({ error: '删除失败，再试一次' }, 502);
  }
  const { data, error } = await db
    .from('scripts')
    .delete()
    .eq('id', id)
    .eq('org_id', g.orgId)
    .neq('stage', 'published')
    .select('cover_path')
    .maybeSingle();
  if (error) {
    console.error('posts/[id] DELETE', error);
    return json({ error: '删除失败' }, 502);
  }
  if (!data) return json({ error: NOT_FOUND }, 404);
  const path = (data as { cover_path: string | null }).cover_path;
  if (path && path.startsWith(`posts/${g.orgId}/`)) {
    try {
      await removePrivate([path]);
    } catch (e) {
      console.error('posts/[id] DELETE remove cover', e);
    }
  }
  return json({ ok: true });
}
