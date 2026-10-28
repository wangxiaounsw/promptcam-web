import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { putPrivate, removePrivate } from '@/lib/studio/audio';
import { POST_LIMITS } from '@/lib/studio/posts';
import { POST_COLUMNS, SignError, postInScope, toCalendarPosts, type PostRow } from '@/lib/studio/posts-db';
import { imageExt, sniffImage } from '@/lib/studio/showcase';
import { json, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

/** 上传封面（管理员和本公司成员）：multipart 的 file 字段 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = '找不到这一条';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!user.orgId) return json({ error: '先选一家公司' }, 400);
  const orgId = user.orgId;
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: NOT_FOUND }, 404);
  const current = await postInScope(orgId, id);
  if (!current) return json({ error: NOT_FOUND }, 404);

  let file: File | null = null;
  try {
    const f = (await request.formData()).get('file');
    file = f instanceof File ? f : null;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!file) return json({ error: '没收到图片' }, 400);
  if (file.size > POST_LIMITS.coverBytes) return json({ error: '图片太大了（最多 3MB）' }, 400);
  // 类型按文件头认，不信浏览器报的 type
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buf);
  const ext = mime ? imageExt(mime) : null;
  if (!mime || !ext) return json({ error: '图片只支持 jpg / png / webp' }, 400);

  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
  const path = `posts/${orgId}/${id}/cover-${rand}.${ext}`;
  try {
    await putPrivate(path, buf, mime, '31536000'); // 文件名随机、从不覆盖，可以长缓存
  } catch (e) {
    console.error('posts/[id]/cover upload', e);
    return json({ error: '上传失败，再试一次' }, 502);
  }

  const { data, error } = await admin()
    .from('scripts')
    .update({ cover_path: path, edited_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select(POST_COLUMNS)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('posts/[id]/cover update', error);
    await removePrivate([path]).catch((e) => console.error('posts/[id]/cover cleanup', e));
    return error ? json({ error: '保存失败' }, 502) : json({ error: NOT_FOUND }, 404);
  }

  const old = current.cover_path;
  if (old && old !== path && old.startsWith(`posts/${orgId}/`)) {
    await removePrivate([old]).catch((e) => console.error('posts/[id]/cover remove old', e));
  }
  try {
    const [post] = await toCalendarPosts([data as PostRow], orgId, user.isAdmin);
    return json({ post });
  } catch (e) {
    console.error('posts/[id]/cover sign', e instanceof SignError ? 'sign failed' : e);
    return json({ error: '图片暂时取不到，刷新一下再试' }, 502);
  }
}
