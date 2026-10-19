'use client';

import { useRef, useState } from 'react';
import { AVATAR, squareCrop } from '@/lib/avatar';
import { errorText, send, studioFetch, studioHeaders, studioToken } from '../api';
import Avatar from '../Avatar';
import { useStudioMe } from '../studio-me';
import { showToast } from '../ui';

/**
 * 我的头像和名字。头像在浏览器里先裁成居中正方形、缩到 256，再上传 ——
 * 手机拍的照片动辄几 MB，没必要整张传。名字点了就能改，失焦保存。
 */
async function toAvatarBlob(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const { sx, sy, size } = squareCrop(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR.px;
  canvas.height = AVATAR.px;
  canvas.getContext('2d')!.drawImage(img, sx, sy, size, size, 0, 0, AVATAR.px, AVATAR.px);
  img.close();
  const as = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.85));
  // 不支持 webp 的浏览器会退回 png：那就改用 jpeg
  const webp = await as('image/webp');
  const blob = webp?.type === 'image/webp' ? webp : await as('image/jpeg');
  if (!blob) throw new Error('这张图读不了，换一张试试');
  return blob;
}

export default function ProfileCard() {
  const ctx = useStudioMe();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(ctx?.me.avatarUrl ?? null);
  const [name, setName] = useState(ctx?.me.name ?? '');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  if (!ctx) return null;

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const blob = await toAvatarBlob(file);
      const token = await studioToken();
      if (!token) throw new Error('登录过期了，刷新一下再试');
      const form = new FormData();
      form.set('avatar', blob, blob.type === 'image/webp' ? 'avatar.webp' : 'avatar.jpg');
      const res = await fetch('/api/studio/profile', { method: 'POST', headers: studioHeaders(token), body: form });
      const body = (await res.json().catch(() => ({}))) as { avatarUrl?: string; error?: string };
      if (!res.ok || !body.avatarUrl) throw new Error(body.error ?? '上传失败，再试一次');
      setAvatarUrl(body.avatarUrl);
      showToast('头像换好了');
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setUploading(false);
    }
  };

  const saveName = async () => {
    setEditing(false);
    const next = name.trim();
    if (!next || next === ctx.me.name) return setName(ctx.me.name);
    try {
      await studioFetch('/api/studio/profile', send('PATCH', { name: next }));
      showToast('名字改好了');
    } catch (e) {
      setName(ctx.me.name);
      showToast(errorText(e));
    }
  };

  return (
    <section className="flex items-center gap-4 rounded-2xl bg-[var(--bg-raised)] p-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        aria-label="换头像"
        className="relative shrink-0 rounded-full"
      >
        <Avatar person={{ ...ctx.me, name: name || ctx.me.name, avatarUrl }} size={72} />
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) upload(f);
        }}
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="名字"
            className="h-12 w-full rounded-xl border-[1.5px] border-[#8A9690] bg-white px-3 text-[17px] font-bold outline-none focus:border-[var(--accent)]"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="flex h-12 max-w-full items-center gap-2 text-left">
            <span className="truncate text-[19px] font-bold">{name || ctx.me.name}</span>
            <span className="shrink-0 text-[13px] font-medium text-[var(--accent)]">改名字</span>
          </button>
        )}
        <p className="text-[13px] text-[var(--muted)]">日历和修改记录里显示这个名字和头像。点头像换一张。</p>
      </div>
    </section>
  );
}
