'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanMediaUrl } from '@/lib/studio/posts';
import type { CalendarPost } from '@/lib/studio/posts-map';
import type { PostNote } from '@/lib/studio/posts-db';
import { errorText, studioFetch } from '../api';
import { useStudioMe } from '../studio-me';
import { showToast } from '../ui';
import ChangeList from './ChangeList';
import NotesThread from './NotesThread';
import PublishActions from './PublishActions';
import ScriptSection from './ScriptSection';
import StageBar from './StageBar';
import PanelHeader from './PanelHeader';
import { usePostPatch, type SavePost } from './usePostPatch';
import XhsFields from './XhsFields';

/** 成片链接：有就给「打开成片 ↗」；双方都能贴 */
function MediaSection({ post, save }: { post: CalendarPost; save: SavePost }) {
  const [url, setUrl] = useState(post.mediaUrl ?? '');
  useEffect(() => setUrl(post.mediaUrl ?? ''), [post.mediaUrl]);
  // 链接会当 href 渲染：只在 https 时才做成链接
  const safe = post.mediaUrl && cleanMediaUrl(post.mediaUrl).error === null ? post.mediaUrl : null;
  return (
    <section className="grid gap-2">
      <h3 className="text-[15px] font-bold">成片</h3>
      {safe ? (
        <a href={safe} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center text-[15px] font-bold text-[var(--accent)]">打开成片 ↗</a>
      ) : null}
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={async () => {
          if (url.trim() === (post.mediaUrl ?? '')) return;
          if (!(await save({ edit: { media_url: url } }))) setUrl(post.mediaUrl ?? '');
        }}
        placeholder="贴成片链接（OneDrive / Google Drive）"
        aria-label="成片链接"
        className="h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-[15px]"
      />
    </section>
  );
}

/** 一条的详情：电脑上从右边滑出 480px，手机全屏；Esc 和点遮罩关闭 */
export default function PostPanel({
  post, isAdmin, industry, today, onChange, onDelete, onClose,
}: {
  post: CalendarPost; isAdmin: boolean; industry: string | null; today: string;
  onChange: (p: CalendarPost) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const { patch, busy } = usePostPatch(post.id, onChange);
  const [notes, setNotes] = useState<PostNote[] | null>(null);
  const latest = useRef(post);
  latest.current = post;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 关面板前先让正在打字的框失焦，它的失焦保存才会发出去
  const close = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // 打开时取一次备注，服务端同时记「看过了」，红点随之清掉；换条时先清空。
  // 撤回发布等进度变化记在「修改记录」里（ChangeList 按 updatedAt 自己重取），不进备注
  const notesFor = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (notesFor.current !== post.id) setNotes(null);
    notesFor.current = post.id;
    studioFetch<{ notes: PostNote[] }>(`/api/studio/posts/${post.id}/notes`)
      .then((r) => {
        if (!alive) return;
        setNotes(r.notes);
        if (latest.current.unread) onChangeRef.current({ ...latest.current, unread: false });
      })
      .catch((e) => alive && showToast(errorText(e)));
    return () => {
      alive = false;
    };
  }, [post.id]);

  const save: SavePost = patch;
  const ctx = useStudioMe();
  const overdue = !post.publishOn || post.stage === 'published' ? false : post.publishOn < today;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="关闭" onClick={close} className="absolute inset-0 bg-black/40" />
      <aside role="dialog" aria-label="这一条的详情" className="relative flex h-full w-full flex-col bg-[var(--bg)] md:w-[480px]">
        <PanelHeader post={post} overdue={overdue} orgId={ctx?.viewing?.id ?? null} busy={busy} save={save} onClose={close} />
        <div className="grid flex-1 content-start gap-5 overflow-y-auto px-4 py-4">
          <StageBar post={post} industry={industry} busy={busy} onPick={(s) => save({ edit: { stage: s } })} />
          <MediaSection post={post} save={save} />
          <XhsFields post={post} save={save} onChange={onChange} />
          <ScriptSection post={post} />
          <NotesThread postId={post.id} notes={notes} onNotes={setNotes} />
          <PublishActions post={post} busy={busy} save={save} onDelete={onDelete} />
          <ChangeList scriptId={post.id} isAdmin={isAdmin} version={post.updatedAt} />
        </div>
      </aside>
    </div>
  );
}
