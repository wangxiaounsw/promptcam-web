'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CalendarPost } from '@/lib/studio/posts-map';
import { PlayButton } from '../ui';

/** 口播稿（折叠）：面板就是这条稿子，直接看正文、试听，去稿子页精修。图文没有口播 */
export default function ScriptSection({ post }: { post: CalendarPost }) {
  const [open, setOpen] = useState(false);
  const image = post.kind === 'image';
  return (
    <section>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-11 w-full items-center justify-between text-[15px] font-bold">
        {image ? '图文内容' : '口播稿'} <span className="text-[13px] font-normal text-[var(--muted)]">{open ? '▾' : '›'}</span>
      </button>
      {open && (
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            {!image && post.body.trim() && <PlayButton scriptId={post.id} chars={[...post.body].length} />}
            <Link href={`/studio/s/${post.id}`} className="text-[15px] font-medium text-[var(--accent)]">去精修 ↗</Link>
          </div>
          {image && !post.body.trim() ? null : post.body.trim() ? (
            <p className="whitespace-pre-wrap break-words rounded-xl bg-[var(--row-line)] p-3 text-[15px]">{post.body}</p>
          ) : (
            <p className="text-[15px] text-[var(--muted)]">正文还没写</p>
          )}
        </div>
      )}
    </section>
  );
}
