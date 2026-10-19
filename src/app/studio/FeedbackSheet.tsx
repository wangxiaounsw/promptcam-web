'use client';

import { useEffect, useRef, useState } from 'react';
import { FEEDBACK_LIMITS, validateFeedback } from '@/lib/feedback';
import { studioHeaders, studioToken } from './api';
import { showToast } from './ui';

/**
 * 反馈问题：描述 + 最多 4 张截图，提交后马上发邮件给 Fordexa。
 * 电脑上是右下角卡片，可以 Ctrl+V 直接粘贴截图；手机上是底部面板，从相册选。
 * 会一起带上当前页面，方便定位。
 */
type Picked = { file: File; url: string };

const MAX_SIDE = 1600;

/**
 * 截图压成长边 1600 的 JPEG：Retina / iPhone 原图一张就好几 MB，几张加起来会超过
 * Vercel 4.5MB 的请求上限。GIF 不动（可能是动图）；读不了的原样返回，交给大小检查拦。
 */
async function shrinkScreenshot(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#fff'; // PNG 透明的地方转 JPEG 会变黑
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<Picked[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 离开工作台时释放还在的缩略图；单张移除时在 remove 里释放
  const live = useRef<Picked[]>([]);
  live.current = images;
  useEffect(() => () => live.current.forEach((im) => URL.revokeObjectURL(im.url)), []);

  if (!open) return null;

  const add = async (files: File[]) => {
    const info = (list: File[]) => list.map((f) => ({ type: f.type, size: f.size }));
    // 先按原文件查格式（HEIC 之类给明确提示），再压缩，压完再查总大小
    const typeProblem = validateFeedback({ message: 'x', images: info(files).map((f) => ({ ...f, size: 0 })) });
    if (typeProblem) return setError(typeProblem);
    const shrunk = await Promise.all(files.map(shrinkScreenshot));
    const next = [...images.map((im) => im.file), ...shrunk];
    const problem = validateFeedback({ message: 'x', images: info(next) });
    if (problem) return setError(problem);
    setError(null);
    setImages((list) => [...list, ...shrunk.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const remove = (i: number) => {
    URL.revokeObjectURL(images[i].url);
    setImages((list) => list.filter((_, k) => k !== i));
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files = [...e.clipboardData.items]
      .filter((it) => it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => Boolean(f));
    if (files.length) {
      e.preventDefault();
      add(files);
    }
  };

  const submit = async () => {
    const problem = validateFeedback({ message, images: images.map((im) => ({ type: im.file.type, size: im.file.size })) });
    if (problem) return setError(problem);
    const token = await studioToken();
    if (!token) return setError('登录过期了，刷新一下再试');
    setSending(true);
    setError(null);
    const form = new FormData();
    form.set('message', message.trim());
    form.set('pageUrl', window.location.pathname + window.location.search);
    images.forEach((im) => form.append('images', im.file));
    try {
      const res = await fetch('/api/studio/feedback', { method: 'POST', headers: studioHeaders(token), body: form });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      // 413 是平台在接口之前拦的，没有 JSON
      if (res.status === 413) throw new Error('截图加起来太大了，少传几张再试');
      if (!res.ok) throw new Error(body.error ?? '提交失败，再试一次');
      setMessage('');
      images.forEach((im) => URL.revokeObjectURL(im.url));
      setImages([]);
      onClose();
      showToast('收到了，谢谢！');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#121815]/50 md:bg-transparent" onClick={onClose} />
      <section
        role="dialog"
        aria-label="反馈问题"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-[var(--bg-raised)] px-5 pt-4 shadow-[0_-6px_20px_rgba(0,0,0,0.12)] md:inset-x-auto md:bottom-6 md:right-6 md:w-[400px] md:rounded-3xl md:pb-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
      >
        <div className="flex h-10 items-center justify-between">
          <h2 className="text-[17px] font-bold">反馈问题</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="-mr-2 h-11 w-11 text-xl text-[var(--muted)]">×</button>
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--muted)]">
          哪里不对、用着别扭，写下来就行。<span className="hidden md:inline">可以直接 Ctrl+V 粘贴截图。</span>
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={onPaste}
          rows={4}
          maxLength={FEEDBACK_LIMITS.maxMessage}
          placeholder="比如：点了生成一直转圈 / 日期改了没保存上…"
          className="mt-2 w-full resize-y rounded-2xl border-[1.5px] border-[#8A9690] bg-white p-3 text-[15px] leading-relaxed outline-none focus:border-[var(--accent)]"
        />
        {images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((im, i) => (
              <div key={im.url} className="relative h-16 w-16 overflow-hidden rounded-xl border border-[var(--line)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt={`截图 ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="移除这张"
                  className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) add([...e.target.files]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={images.length >= FEEDBACK_LIMITS.maxImages}
          className="h-11 text-[15px] font-medium text-[var(--accent)] disabled:opacity-40"
        >
          上传截图（{images.length}/{FEEDBACK_LIMITS.maxImages}）
        </button>
        {error && <p className="text-[14px] text-[var(--record)]">{error}</p>}
        <p className="mt-1 text-[12px] text-[var(--muted)]">会一起发出：当前页面</p>
        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="mt-3 h-14 w-full rounded-2xl bg-[var(--accent)] text-[17px] font-bold text-white disabled:opacity-40"
        >
          {sending ? '提交中…' : '提交'}
        </button>
      </section>
    </>
  );
}
