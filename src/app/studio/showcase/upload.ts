'use client';

import type { ShowcaseData } from '@/lib/studio/showcase';
import { studioHeaders, studioToken } from '../api';

/**
 * 主页预览的图片：先在浏览器里缩小再上传（手机照片动辄几 MB，Vercel 请求体上限 4.5MB）。
 * 头像裁成 400 的正方形，背景和封面缩到 1080 宽，一律存 JPEG。
 */
export type ImageKind = 'avatar' | 'bg' | 'note';

async function shrink(file: File, kind: ImageKind): Promise<Blob> {
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  if (kind === 'avatar') {
    const size = Math.min(img.width, img.height);
    canvas.width = canvas.height = 400;
    ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400);
  } else {
    const k = Math.min(1, 1080 / img.width, 2400 / img.height); // 太长的长图也压住，免得超过 3MB
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  img.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  if (!blob) throw new Error('这张图读不了，换一张试试（iPhone 照片请先截个屏）');
  return blob;
}

/** 上传一张，返回整份最新数据 */
export async function uploadImage(file: File, kind: ImageKind): Promise<ShowcaseData> {
  const blob = await shrink(file, kind);
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
