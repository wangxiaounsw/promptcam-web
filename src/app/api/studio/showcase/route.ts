import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { PRIVATE_BUCKET, putPrivate, removePrivate } from '@/lib/studio/audio';
import { json, requireStudioUser, type StudioUser } from '@/lib/studio/server';
import {
  FRAMES,
  SHOWCASE_LIMITS,
  emptyProfile,
  imageExt,
  notePatch,
  showcasePath,
  sniffImage,
  validateNote,
  validateProfile,
  type ShowcaseData,
  type ShowcaseNote,
  type ShowcaseProfile,
} from '@/lib/studio/showcase';

export const runtime = 'nodejs';

/**
 * 主页预览：正在看的那家公司的小红书主页样子 + 笔记封面。
 * 成员和切到这家公司的管理员都能改；一切按 user.orgId 查，别家的行碰不到。
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  name: string; red_id: string; ip: string; follows: string; fans: string; likes: string; bio: string;
  tags: string[]; collections: string[]; frame: string; avatar_path: string | null; bg_path: string | null;
};
type NoteRow = { id: string; image_path: string; title: string; likes: string; date_label: string; is_video: boolean };

const toProfile = (r: Row | null): ShowcaseProfile =>
  r
    ? { name: r.name, redId: r.red_id, ip: r.ip, follows: r.follows, fans: r.fans, likes: r.likes, bio: r.bio, tags: r.tags, collections: r.collections, frame: (FRAMES as readonly string[]).includes(r.frame) ? (r.frame as ShowcaseProfile['frame']) : 'orange' }
    : emptyProfile();

const toRow = (p: ShowcaseProfile) => ({
  name: p.name, red_id: p.redId, ip: p.ip, follows: p.follows, fans: p.fans, likes: p.likes, bio: p.bio,
  tags: p.tags, collections: p.collections, frame: p.frame,
});

async function gate(request: NextRequest): Promise<{ user: StudioUser; orgId: string } | Response> {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '先选一家公司' }, 400);
  return { user, orgId: user.orgId };
}

async function load(orgId: string): Promise<ShowcaseData> {
  const db = admin();
  const [{ data: row }, { data: notes }] = await Promise.all([
    db.from('xhs_showcases').select('name, red_id, ip, follows, fans, likes, bio, tags, collections, frame, avatar_path, bg_path').eq('org_id', orgId).maybeSingle(),
    db.from('xhs_showcase_notes').select('id, image_path, title, likes, date_label, is_video').eq('org_id', orgId).order('position').order('created_at'),
  ]);
  const r = (row as Row | null) ?? null;
  const list = (notes as NoteRow[] | null) ?? [];
  const paths = [r?.avatar_path, r?.bg_path, ...list.map((n) => n.image_path)].filter((p): p is string => Boolean(p));
  let signed: { path: string | null; signedUrl: string | null }[] = [];
  if (paths.length) {
    const res = await db.storage.from(PRIVATE_BUCKET).createSignedUrls(paths, 3600);
    // 签不出来就报错，别让笔记悄悄从页面上消失
    if (res.error || !res.data) throw new Error('sign failed');
    signed = res.data;
  }
  const url = (p: string | null | undefined) => (p ? signed.find((s) => s.path === p)?.signedUrl ?? null : null);
  return {
    profile: toProfile(r),
    avatarUrl: url(r?.avatar_path),
    bgUrl: url(r?.bg_path),
    notes: list
      .map((n): ShowcaseNote | null => {
        const u = url(n.image_path);
        return u ? { id: n.id, url: u, title: n.title, likes: n.likes, date: n.date_label, isVideo: n.is_video } : null;
      })
      .filter((n): n is ShowcaseNote => n !== null),
  };
}

async function respond(orgId: string): Promise<Response> {
  try {
    return json(await load(orgId));
  } catch {
    return json({ error: '图片暂时取不到，刷新一下再试' }, 502);
  }
}

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (g instanceof Response) return g;
  return respond(g.orgId);
}

/** 改主页文字 / 笔记标题点赞 / 笔记顺序：{ profile?, notes?: [{ id, title?, likes?, date?, isVideo? }], order?: [id] }。
 *  只回 { ok }：页面自己改显示，不用每次重签几十张图（慢了会在刷新时被取消） */
export async function PATCH(request: NextRequest) {
  const g = await gate(request);
  if (g instanceof Response) return g;
  let body: { profile?: Partial<ShowcaseProfile>; notes?: unknown; order?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const db = admin();
  if (body.profile) {
    const v = validateProfile(body.profile);
    if (v.error !== null) return json({ error: v.error }, 400);
    const { error } = await db
      .from('xhs_showcases')
      .upsert({ org_id: g.orgId, ...toRow(v.value), updated_at: new Date().toISOString(), updated_by: g.user.id }, { onConflict: 'org_id' });
    if (error) return json({ error: '保存失败' }, 502);
  }
  if (Array.isArray(body.notes)) {
    for (const raw of body.notes.slice(0, SHOWCASE_LIMITS.notes) as { id?: unknown }[]) {
      const id = String(raw?.id ?? '');
      if (!UUID.test(id)) continue;
      const v = notePatch(raw as never);
      if (v.error !== null) return json({ error: v.error }, 400);
      if (!Object.keys(v.value).length) continue;
      const { error } = await db.from('xhs_showcase_notes').update(v.value).eq('id', id).eq('org_id', g.orgId);
      if (error) return json({ error: '保存失败' }, 502);
    }
  }
  if (Array.isArray(body.order)) {
    const ids = (body.order as unknown[]).map(String).filter((id) => UUID.test(id)).slice(0, SHOWCASE_LIMITS.notes);
    const results = await Promise.all(ids.map((id, i) => db.from('xhs_showcase_notes').update({ position: i }).eq('id', id).eq('org_id', g.orgId)));
    if (results.some((r) => r.error)) return json({ error: '顺序没存上，再试一次' }, 502);
  }
  return json({ ok: true });
}

/** 上传一张图：multipart kind=avatar|bg|note, file, title? */
export async function POST(request: NextRequest) {
  const g = await gate(request);
  if (g instanceof Response) return g;
  let kind = '';
  let file: File | null = null;
  let title = '';
  try {
    const form = await request.formData();
    kind = String(form.get('kind') ?? '');
    const f = form.get('file');
    file = f instanceof File ? f : null;
    title = String(form.get('title') ?? '');
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (kind !== 'avatar' && kind !== 'bg' && kind !== 'note') return json({ error: 'Bad request.' }, 400);
  if (!file) return json({ error: '没收到图片' }, 400);
  if (file.size > SHOWCASE_LIMITS.imageBytes) return json({ error: '图片太大了（最多 3MB）' }, 400);
  // 类型按文件头认，不信浏览器报的 type
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buf);
  const ext = mime ? imageExt(mime) : null;
  if (!mime || !ext) return json({ error: '图片只支持 jpg / png / webp' }, 400);

  const db = admin();
  if (kind === 'note') {
    const { count } = await db.from('xhs_showcase_notes').select('id', { count: 'exact', head: true }).eq('org_id', g.orgId);
    if ((count ?? 0) >= SHOWCASE_LIMITS.notes) return json({ error: `最多 ${SHOWCASE_LIMITS.notes} 篇笔记，先删掉几篇` }, 400);
  }
  const v = validateNote({ title: [...title].slice(0, SHOWCASE_LIMITS.noteTitle).join(''), isVideo: true });
  const path = showcasePath(g.orgId, kind, ext);
  try {
    await putPrivate(path, buf, mime, '31536000'); // 文件名随机、从不覆盖，可以长缓存
  } catch {
    return json({ error: '上传失败，再试一次' }, 502);
  }

  if (kind === 'note') {
    // 新传的排在最前面，和刚发的笔记在主页上的位置一样
    const { data: first } = await db.from('xhs_showcase_notes').select('position').eq('org_id', g.orgId).order('position').limit(1).maybeSingle();
    const { error } = await db.from('xhs_showcase_notes').insert({
      org_id: g.orgId, image_path: path, title: v.value?.title ?? '', likes: '', date_label: '刚刚', is_video: true,
      position: ((first?.position as number | undefined) ?? 1) - 1, created_by: g.user.id,
    });
    if (error) {
      await removePrivate([path]);
      return json({ error: '保存失败' }, 502);
    }
  } else {
    const column = kind === 'avatar' ? 'avatar_path' : 'bg_path';
    const { data: before } = await db.from('xhs_showcases').select(column).eq('org_id', g.orgId).maybeSingle();
    const { error } = before
      ? await db.from('xhs_showcases').update({ [column]: path, updated_at: new Date().toISOString(), updated_by: g.user.id }).eq('org_id', g.orgId)
      : await db.from('xhs_showcases').insert({ org_id: g.orgId, ...toRow(emptyProfile()), [column]: path, updated_by: g.user.id });
    if (error) {
      await removePrivate([path]);
      return json({ error: '保存失败' }, 502);
    }
    const old = (before as Record<string, string | null> | null)?.[column] ?? null;
    if (old && old.startsWith(`showcase/${g.orgId}/`)) await removePrivate([old]);
  }
  return respond(g.orgId);
}

/** 删一篇笔记：?note=<id> */
export async function DELETE(request: NextRequest) {
  const g = await gate(request);
  if (g instanceof Response) return g;
  const id = request.nextUrl.searchParams.get('note') ?? '';
  if (!UUID.test(id)) return json({ error: 'Bad request.' }, 400);
  const db = admin();
  const { data } = await db.from('xhs_showcase_notes').delete().eq('id', id).eq('org_id', g.orgId).select('image_path').maybeSingle();
  const path = (data?.image_path as string | undefined) ?? null;
  if (path && path.startsWith(`showcase/${g.orgId}/`)) await removePrivate([path]);
  return respond(g.orgId);
}
