'use client';

import type { ShowcaseData } from '@/lib/studio/showcase';
import { studioHeaders, studioToken } from '../api';
import { shrinkImage } from '../shrink';

/**
 * 主页预览的图片：先在浏览器里缩小再上传（手机照片动辄几 MB，Vercel 请求体上限 4.5MB）。
 * 头像裁成 400 的正方形，背景和封面缩到 1080 宽，一律存 JPEG。
 */
export type ImageKind = 'avatar' | 'bg' | 'note';

/** 上传一张，返回整份最新数据 */
export async function uploadImage(file: File, kind: ImageKind): Promise<ShowcaseData> {
  const blob = await shrinkImage(file, kind === 'avatar' ? 'square400' : 'fit1080');
  const token = await studioToken();
  if (!token) throw new Error('登录过期了，刷新一下再试');
  const form = new FormData();
  form.set('kind', kind);
  form.set('file', blob, `${kind}.jpg`);
  if (kind === 'note') form.set('title', file.name.replace(/\.[^.]+$/, ''));
  const res = await fetch('/api/studio/showcase', { method: 'POST', headers: studioHeaders(token), body: form });
  const body = (await res.json().catch(() => ({}))) as ShowcaseData & { error?: string };
  if (!res.ok) throw new Error(body.error ?? '上传失败，再试一次');
  return body;
}
