'use client';

import { useEffect, useRef, useState } from 'react';
import { keepUrls, splitList, type ShowcaseData, type ShowcaseProfile } from '@/lib/studio/showcase';
import { errorText, send, studioFetch, studioHeaders, studioToken } from '../api';
import { useStudioMe } from '../studio-me';
import { showToast } from '../ui';
import NotesEditor from './NotesEditor';
import Phone from './Phone';
import { uploadImage, type ImageKind } from './upload';

/**
 * 主页预览：正在看的这家公司的小红书主页，装在 iPhone 17 Pro Max 里。
 * 左边改名字、简介、头像、背景和笔记封面，右边跟着变；文字停笔一会儿自动保存。
 * 给客户演示「我帮你做之后主页是什么样」，也用来比较不同的封面排在一起的效果。
 */

type Draft = Omit<ShowcaseProfile, 'tags' | 'collections'> & { tags: string; collections: string };

const toDraft = (p: ShowcaseProfile): Draft => ({ ...p, tags: p.tags.join('，'), collections: p.collections.join('，') });
const fromDraft = (d: Draft): ShowcaseProfile => ({ ...d, tags: splitList(d.tags), collections: splitList(d.collections) });

const field = 'h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[15px]';
const label = 'flex flex-col gap-1 text-[13px] font-medium text-[var(--muted)]';

/** 手机整台缩放到放得下：窗口高度减去页头，或窄屏时的宽度 */
function usePhoneScale(box: React.RefObject<HTMLDivElement | null>): number {
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const fit = () => {
      const w = box.current?.clientWidth ?? 466;
      setScale(Math.min(1, (window.innerHeight - 150) / 982, w / 466));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [box]);
  return scale;
}

export default function ShowcasePage() {
  const ctx = useStudioMe();
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const dirty = useRef(false);
  const phoneBox = useRef<HTMLDivElement>(null);
  const scale = usePhoneScale(phoneBox);

  useEffect(() => {
    studioFetch<ShowcaseData>('/api/studio/showcase')
      .then((d) => {
        setData(d);
        setDraft(toDraft(d.profile));
      })
      .catch((e) => showToast(errorText(e)));
  }, []);

  // 停笔 0.8 秒后保存；名字清空时不存，等填上。保存排队发，后改的一定后到
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef<Draft | null>(null);
  latest.current = draft;
  const saveProfile = (d: Draft) => {
    dirty.current = false;
    queue.current = queue.current
      .then(() => studioFetch('/api/studio/showcase', send('PATCH', { profile: fromDraft(d) })))
      .catch((e) => {
        dirty.current = true; // 下次再改时一起重试
        showToast(errorText(e));
      });
  };
  useEffect(() => {
    if (!draft || !dirty.current || !draft.name.trim()) return;
    const t = setTimeout(() => saveProfile(draft), 800);
    return () => clearTimeout(t);
    // saveProfile 只读 ref 和 setter，不用跟着重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  // 离开页面（或切换公司）时，还没存的改动用 keepalive 补存一次
  useEffect(
    () => () => {
      const d = latest.current;
      if (!dirty.current || !d?.name.trim()) return;
      void studioToken().then((token) => {
        if (!token) return;
        void fetch('/api/studio/showcase', {
          method: 'PATCH', keepalive: true,
          headers: { 'Content-Type': 'application/json', ...studioHeaders(token) },
          body: JSON.stringify({ profile: fromDraft(d) }),
        });
      });
    },
    [],
  );

  const edit = (k: keyof Draft, v: string) => {
    dirty.current = true;
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  };

  const upload = async (kind: ImageKind, file: File | undefined) => {
    if (!file) return;
    setUploading(kind);
    try {
      const d = await uploadImage(file, kind);
      setData((prev) => keepUrls(prev, { ...d, profile: prev?.profile ?? d.profile }, { avatar: kind === 'avatar', bg: kind === 'bg' }));
      showToast(kind === 'avatar' ? '头像换好了' : '背景换好了');
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setUploading(null);
    }
  };

  if (!data || !draft) return <div className="mt-10 h-40 animate-pulse rounded-2xl bg-[var(--row-line)]" />;
  const text = (k: keyof Draft, l: string, max?: number) => (
    <label className={label}>{l}<input className={field} value={String(draft[k])} maxLength={max} onChange={(e) => edit(k, e.target.value)} /></label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[22px] font-bold">主页预览</h1>
        <p className="text-[14px] text-[var(--muted)]">{ctx?.viewing?.name ?? ''} 的小红书主页做出来是什么样。改完自动保存，这家公司的人都能看到。</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-2xl bg-[var(--bg-raised)] p-4">
            <h2 className="text-[17px] font-bold">账号</h2>
            {text('name', '名字', 24)}
            <div className="grid grid-cols-2 gap-3">{text('redId', '小红书号', 16)}{text('ip', 'IP 属地', 16)}</div>
            <div className="grid grid-cols-3 gap-3">{text('follows', '关注', 16)}{text('fans', '粉丝', 16)}{text('likes', '获赞与收藏', 16)}</div>
            <label className={label}>简介（每行一条）
              <textarea className={`${field} h-28 py-2`} value={draft.bio} maxLength={300} onChange={(e) => edit('bio', e.target.value)} />
            </label>
            {text('tags', '标签（逗号隔开）')}
            {text('collections', '合集（逗号隔开）')}
            <label className={label}>手机颜色
              <select className={field} value={draft.frame} onChange={(e) => edit('frame', e.target.value)}>
                <option value="orange">宇宙橙</option><option value="blue">深蓝</option><option value="silver">银色</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(['avatar', 'bg'] as const).map((k) => (
                <label key={k} className="flex h-9 cursor-pointer items-center rounded-xl border border-[var(--line)] px-4 text-[14px] font-medium">
                  {uploading === k ? '上传中…' : k === 'avatar' ? '换头像' : '换背景图'}
                  <input type="file" accept="image/*" hidden disabled={uploading !== null} onChange={(e) => upload(k, e.target.files?.[0]).finally(() => (e.target.value = ''))} />
                </label>
              ))}
            </div>
          </section>
          <NotesEditor
            notes={data.notes}
            onData={(d) => setData((prev) => keepUrls(prev, { ...d, profile: prev?.profile ?? d.profile }, { avatar: false, bg: false }))}
            onNotes={(notes) => setData((prev) => (prev ? { ...prev, notes } : prev))}
          />
        </div>
        <div ref={phoneBox} className="flex flex-col items-center gap-3 lg:sticky lg:top-24">
          <Phone profile={fromDraft(draft)} avatarUrl={data.avatarUrl} bgUrl={data.bgUrl} notes={data.notes} scale={scale} />
          <p className="text-[12px] text-[var(--muted)]">预览示意，非小红书官方页面</p>
        </div>
      </div>
    </div>
  );
}
