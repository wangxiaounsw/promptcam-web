import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { seenColumn, toNoteViews, validateNoteBody, type NoteRow } from '@/lib/studio/notes';
import { postInScope, type PostNote } from '@/lib/studio/posts-db';
import { json, peopleById, requireStudioUser, type StudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

/** 一条的备注：本公司成员和管理员都能看、能写；一切按 user.orgId 查。 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = '找不到这一条';

type Ctx = { params: Promise<{ id: string }> };

async function gate(
  request: NextRequest,
  { params }: Ctx,
): Promise<{ user: StudioUser; orgId: string; postId: string } | Response> {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '先选一家公司' }, 400);
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: NOT_FOUND }, 404);
  if (!(await postInScope(user.orgId, id))) return json({ error: NOT_FOUND }, 404);
  return { user, orgId: user.orgId, postId: id };
}

async function loadNotes(orgId: string, postId: string, userId: string): Promise<PostNote[] | null> {
  const { data, error } = await admin()
    .from('script_notes')
    .select('id, kind, body, created_at, author_id')
    .eq('script_id', postId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('posts/[id]/notes load', error);
    return null;
  }
  const rows = (data as NoteRow[]) ?? [];
  const people = await peopleById(rows.map((r) => r.author_id));
  return toNoteViews(rows, people, userId);
}

/** 备注增删也记一条修改记录：只留前 40 字（备注全文在 script_notes） */
async function logNote(g: { user: StudioUser; orgId: string; postId: string }, side: 'new_value' | 'old_value', body: string) {
  const { error } = await admin().from('script_changes').insert({
    script_id: g.postId, org_id: g.orgId, actor_id: g.user.id, action: 'update', field: 'note',
    [side]: [...body].slice(0, 40).join(''),
  });
  if (error) console.error('posts/[id]/notes log change', error);
}

async function respondNotes(g: { user: StudioUser; orgId: string; postId: string }): Promise<Response> {
  const notes = await loadNotes(g.orgId, g.postId, g.user.id);
  if (!notes) return json({ error: '备注暂时取不到，刷新一下再试' }, 502);
  return json({ notes });
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const g = await gate(request, ctx);
  if (g instanceof Response) return g;
  // 看过了：管理员记 admin_seen_at，公司成员记 client_seen_at
  const { error } = await admin()
    .from('scripts')
    .update({ [seenColumn(g.user.isAdmin)]: new Date().toISOString() })
    .eq('id', g.postId)
    .eq('org_id', g.orgId);
  if (error) console.error('posts/[id]/notes GET mark seen', error);
  return respondNotes(g);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const g = await gate(request, ctx);
  if (g instanceof Response) return g;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'Bad request.' }, 400);
  const v = validateNoteBody((raw as Record<string, unknown>).body);
  if (v.error !== null) return json({ error: v.error }, 400);

  const db = admin();
  const now = new Date().toISOString();
  const ins = await db
    .from('script_notes')
    .insert({ script_id: g.postId, org_id: g.orgId, author_id: g.user.id, kind: 'note', body: v.value });
  if (ins.error) {
    console.error('posts/[id]/notes POST insert', ins.error);
    return json({ error: '保存失败' }, 502);
  }
  await logNote(g, 'new_value', v.value);
  const upd = await db
    .from('scripts')
    .update({ last_note_at: now, last_note_by_admin: g.user.isAdmin, [seenColumn(g.user.isAdmin)]: now })
    .eq('id', g.postId)
    .eq('org_id', g.orgId);
  if (upd.error) console.error('posts/[id]/notes POST update marks', upd.error);
  return respondNotes(g);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const g = await gate(request, ctx);
  if (g instanceof Response) return g;
  const noteId = request.nextUrl.searchParams.get('note') ?? '';
  if (!UUID.test(noteId)) return json({ error: NOT_FOUND }, 404);
  // 只能删自己写的 note；system 不能删。last_note_at 不回退，红点最多多亮一次
  const { data, error } = await admin()
    .from('script_notes')
    .delete()
    .eq('id', noteId)
    .eq('script_id', g.postId)
    .eq('org_id', g.orgId)
    .eq('author_id', g.user.id)
    .eq('kind', 'note')
    .select('id, body')
    .maybeSingle();
  if (error) {
    console.error('posts/[id]/notes DELETE', error);
    return json({ error: '删除失败' }, 502);
  }
  if (!data) return json({ error: NOT_FOUND }, 404);
  await logNote(g, 'old_value', (data as { body: string }).body);
  return respondNotes(g);
}
