import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { AVATAR, AVATAR_BUCKET, avatarUrl } from '@/lib/avatar';
import { json, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** 换头像(multipart avatar)。只改登录的这个人自己,和正在看哪家公司无关 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  let file: File | null = null;
  try {
    const f = (await request.formData()).get('avatar');
    file = f instanceof File ? f : null;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!file || !AVATAR.mime.includes(file.type)) return json({ error: '头像只支持 jpg / png / webp' }, 400);
  if (file.size > AVATAR.maxBytes) return json({ error: '头像太大了（最多 1MB）' }, 400);

  const db = admin();
  const path = `${user.id}/${randomBytes(6).toString('hex')}.${EXT[file.type]}`;
  const { error: upErr } = await db.storage
    .from(AVATAR_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upErr) return json({ error: '上传失败，再试一次' }, 502);

  const { data: before } = await db.from('profiles').select('avatar_path').eq('id', user.id).maybeSingle();
  const { error } = await db.from('profiles').update({ avatar_path: path }).eq('id', user.id);
  if (error) return json({ error: '保存失败' }, 502);
  const old = (before?.avatar_path as string | null) ?? null;
  // 旧的只删自己目录下的:avatar_path 只由这里写,多一道保险
  if (old && old.startsWith(`${user.id}/`)) await db.storage.from(AVATAR_BUCKET).remove([old]).catch(() => {});
  return json({ avatarUrl: avatarUrl(path) });
}

/** 改名字:「谁放的」「谁改的」显示这个 */
export async function PATCH(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const name = String(body.name ?? '').trim();
  if (!name || [...name].length > 40) return json({ error: '名字 1 到 40 个字' }, 400);
  const { error } = await admin().from('profiles').update({ display_name: name }).eq('id', user.id);
  if (error) return json({ error: '保存失败' }, 502);
  return json({ ok: true, name });
}
