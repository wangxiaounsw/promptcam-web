'use client';

import { useRef, useState } from 'react';
import { POST_LIMITS } from '@/lib/studio/posts';
import type { CalendarPost } from '@/lib/studio/posts-map';
import { errorText, studioHeaders, studioToken } from '../api';
import { shrinkImage } from '../shrink';
import { showToast } from '../ui';
import Blurred from './Blurred';
import type { SavePost } from './usePostPatch';

/** 小红书标题、正文、标签、封面。双方都能改 */
export default function XhsFields({
  post, save, onChange,
}: {
  post: CalendarPost; save: SavePost; onChange: (p: CalendarPost) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await shrinkImage(file, 'fit1080');
      const token = await studioToken();
      if (!token) throw new Error('登录过期了，刷新一下再试');
      const form = new FormData();
      form.set('file', blob, 'cover.jpg');
      const res = await fetch(`/api/studio/posts/${post.id}/cover`, { method: 'POST', headers: studioHeaders(token), body: form });
      const body = (await res.json().catch(() => ({}))) as { post?: CalendarPost; error?: string };
      if (!res.ok || !body.post) throw new Error(body.error ?? '上传失败，再试一次');
      onChange(body.post);
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const cover = post.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={post.coverUrl} alt="封面" className="h-24 w-[72px] rounded-xl object-cover" />
  ) : (
    <span className="flex h-24 w-[72px] items-center justify-center rounded-xl border border-dashed border-[var(--line)] text-[13px] text-[var(--muted)]">无封面</span>
  );

  return (
    <section className="grid gap-2">
      <h3 className="text-[15px] font-bold">小红书内容</h3>
      <div className="flex items-center gap-3">
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} aria-label="选封面">{cover}</button>
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="h-11 text-[15px] font-medium text-[var(--accent)] disabled:opacity-40">
          {uploading ? '上传中…' : '上传封面'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <Blurred placeholder="小红书标题" maxLength={POST_LIMITS.xhsTitle} value={post.xhsTitle} onSave={(v) => save({ edit: { xhs_title: v } })} />
      <Blurred placeholder="小红书正文" multiline maxLength={POST_LIMITS.xhsBody} value={post.xhsBody} onSave={(v) => save({ edit: { xhs_body: v } })} />
      <Blurred placeholder="标签，空格隔开" maxLength={400} value={post.xhsTags.join(' ')} onSave={(v) => save({ edit: { xhs_tags: v } })} />
    </section>
  );
}
