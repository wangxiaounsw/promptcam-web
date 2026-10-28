'use client';

import { useEffect, useState } from 'react';
import { copyText, isXhsUrl } from '@/lib/studio/posts';
import type { CalendarPost } from '@/lib/studio/posts-map';
import { errorText, studioFetch } from '../api';
import { showToast } from '../ui';
import type { SavePost } from './usePostPatch';

const BTN = 'h-11 rounded-xl border border-[var(--line)] px-4 text-[15px] font-medium disabled:opacity-40';
const PRIMARY = 'h-11 rounded-xl bg-[var(--accent)] px-4 text-[15px] font-bold text-white disabled:opacity-40';
const DANGER = 'h-11 rounded-xl border border-[var(--record)] px-4 text-[15px] font-medium text-[var(--record)] disabled:opacity-40';

/** 赞、藏、评：失焦就保存，写法照小红书（1.2万、3w）由服务端解析 */
function StatInput({ label, value, busy, onSave }: { label: string; value: number | null; busy: boolean; onSave: (v: string) => Promise<boolean> }) {
  const [v, setV] = useState(value === null ? '' : String(value));
  useEffect(() => setV(value === null ? '' : String(value)), [value]);
  return (
    <label className="grid min-w-0 flex-1 gap-1 text-[13px] text-[var(--muted)]">
      {label}
      <input
        value={v}
        inputMode="text"
        disabled={busy}
        onChange={(e) => setV(e.target.value)}
        onBlur={async () => {
          if (v.trim() === (value === null ? '' : String(value))) return;
          if (!(await onSave(v))) setV(value === null ? '' : String(value));
        }}
        className="h-11 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-[15px] text-[var(--ink)] disabled:opacity-40"
      />
    </label>
  );
}

/** 面板底部按钮（双方都有）；撤回、删除都在面板内点两下确认，不弹浏览器对话框 */
export default function PublishActions({
  post, busy, save, onDelete,
}: {
  post: CalendarPost; busy: boolean; save: SavePost; onDelete: (id: string) => void;
}) {
  const [pasting, setPasting] = useState(false);
  const [url, setUrl] = useState('');
  const [dating, setDating] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [confirm, setConfirm] = useState<'unpublish' | 'delete' | null>(null);
  const published = post.stage === 'published';
  const showCopy = post.stage === 'cut' || published;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(post));
      showToast('已复制');
    } catch {
      showToast('复制失败，浏览器没给权限');
    }
  };

  const publish = async () => {
    if (await save({ action: 'publish', url })) {
      setPasting(false);
      setUrl('');
    }
  };

  const remove = async () => {
    try {
      await studioFetch(`/api/studio/posts/${post.id}`, { method: 'DELETE' });
      onDelete(post.id);
    } catch (e) {
      showToast(errorText(e));
      setConfirm(null);
    }
  };

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {showCopy && <button type="button" className={BTN} onClick={copy}>复制标题+正文</button>}
        {post.stage === 'cut' && (
          <button type="button" disabled={busy} className={PRIMARY} onClick={() => setPasting((v) => !v)}>已发布 · 贴链接</button>
        )}
        {!published && (
          <>
            <button type="button" disabled={busy} className={BTN} onClick={() => { setDateDraft(post.publishOn ?? ''); setDating((v) => !v); }}>换日期</button>
            {post.publishOn && (
              <button type="button" disabled={busy} className={BTN} onClick={() => save({ edit: { publish_on: null } })}>先不排</button>
            )}
          </>
        )}
      </div>

      {dating && !published && (
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            aria-label="换日期"
            value={dateDraft}
            disabled={busy}
            onChange={(e) => setDateDraft(e.target.value)}
            className="h-11 rounded-xl border border-[var(--line)] bg-transparent px-3 text-[15px] disabled:opacity-40"
          />
          <button
            type="button"
            disabled={busy || !dateDraft || dateDraft === post.publishOn}
            className={PRIMARY}
            onClick={async () => { if (await save({ edit: { publish_on: dateDraft } })) setDating(false); }}
          >
            确定
          </button>
          <button type="button" disabled={busy} className={BTN} onClick={() => setDating(false)}>取消</button>
        </div>
      )}

      {pasting && (
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="小红书链接（xiaohongshu.com 或 xhslink.com）"
            aria-label="发布链接"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-transparent px-3 text-[15px]"
          />
          <button type="button" disabled={busy || !url.trim()} className={PRIMARY} onClick={publish}>确定</button>
        </div>
      )}

      {published && (
        <>
          <div className="flex items-center gap-3">
            {post.publishedUrl && (isXhsUrl(post.publishedUrl) ? (
              <a href={post.publishedUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-[15px] font-medium text-[var(--accent)]">发布链接 ↗</a>
            ) : (
              <span className="min-w-0 truncate text-[15px] text-[var(--muted)]">{post.publishedUrl}</span>
            ))}
            <button type="button" className="h-11 text-[14px] text-[var(--muted)]" onClick={() => setPasting((v) => !v)}>改链接</button>
          </div>
          <div className="flex gap-2">
            <StatInput label="赞" value={post.likes} busy={busy} onSave={(v) => save({ edit: { likes: v } })} />
            <StatInput label="藏" value={post.saves} busy={busy} onSave={(v) => save({ edit: { saves: v } })} />
            <StatInput label="评" value={post.comments} busy={busy} onSave={(v) => save({ edit: { comments: v } })} />
          </div>
          {confirm === 'unpublish' ? (
            <div className="flex gap-2">
              <button type="button" disabled={busy} className={DANGER} onClick={async () => { await save({ action: 'unpublish' }); setConfirm(null); }}>确认撤回</button>
              <button type="button" className={BTN} onClick={() => setConfirm(null)}>算了</button>
            </div>
          ) : (
            <button type="button" className={`${BTN} justify-self-start`} onClick={() => setConfirm('unpublish')}>撤回已发布</button>
          )}
        </>
      )}

      {!published &&
        (confirm === 'delete' ? (
          <div className="flex gap-2">
            <button type="button" className={DANGER} onClick={remove}>确认删除</button>
            <button type="button" className={BTN} onClick={() => setConfirm(null)}>算了</button>
          </div>
        ) : (
          <button type="button" className={`${DANGER} justify-self-start`} onClick={() => setConfirm('delete')}>删除</button>
        ))}
    </section>
  );
}
