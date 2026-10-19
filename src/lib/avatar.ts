/**
 * 头像：公开桶 avatars，路径 <uid>/<随机>.<ext>。
 * 不 import auth —— 这个文件前后端和测试都要用。
 */
export const AVATAR_BUCKET = 'avatars';

export function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.SUPABASE_URL ?? ''}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

export const AVATAR = { px: 256, maxBytes: 1024 * 1024, mime: ['image/jpeg', 'image/png', 'image/webp'] };

/** 居中取最大的正方形（上传前在浏览器里裁） */
export function squareCrop(w: number, h: number): { sx: number; sy: number; size: number } {
  const size = Math.min(w, h);
  return { sx: Math.floor((w - size) / 2), sy: Math.floor((h - size) / 2), size };
}
