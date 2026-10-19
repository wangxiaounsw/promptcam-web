'use client';

import { useState } from 'react';
import { diffLines } from '@/lib/studio/prompt-diff';
import { errorText, studioFetch, type Person } from '../../api';
import Avatar from '../../Avatar';

/**
 * 修改记录：谁、什么时候、改了什么。App 里的改动也在（数据库触发器记的）。
 * 展开时才去取，每次展开都取最新的。
 */
type Change = {
  id: string;
  at: string;
  field: string | null;
  old: string | null;
  new: string | null;
  text: string;
  actor: Person | null;
};

const WHEN = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Australia/Melbourne',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function BodyDiff({ before, after }: { before: string; after: string }) {
  return (
    <div className="mt-2 max-h-60 overflow-auto rounded-xl bg-[var(--bg)] p-2 font-mono text-[12px] leading-relaxed">
      {diffLines(before, after)
        .filter((l) => l.kind !== 'same')
        .map((l, i) => (
          <div key={i} className={l.kind === 'add' ? 'bg-[var(--accent-tint)]' : 'bg-[#FBE9E7] line-through'}>
            {l.kind === 'add' ? '+ ' : '− '}
            {l.text}
          </div>
        ))}
    </div>
  );
}

function Row({ c }: { c: Change }) {
  const [open, setOpen] = useState(false);
  const canDiff = c.field === 'body' && c.old !== null && c.new !== null;
  return (
    <li className="flex gap-2.5 border-b border-[var(--row-line)] py-2.5 last:border-b-0">
      <Avatar person={c.actor} size={28} />
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed">
        <p>
          <span className="font-bold">{c.actor?.name ?? '系统'}</span>
          <span className="ml-2 text-[13px] text-[var(--muted)]">{WHEN.format(new Date(c.at))}</span>
        </p>
        <p className="break-words">{c.text}</p>
        {canDiff && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="h-9 text-[13px] font-medium text-[var(--accent)]">
            {open ? '收起' : '看改了哪里'}
          </button>
        )}
        {open && canDiff && <BodyDiff before={c.old!} after={c.new!} />}
      </div>
    </li>
  );
}

export default function ChangeLog({ scriptId }: { scriptId: string }) {
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await studioFetch<{ changes: Change[] }>(`/api/studio/changes?scriptId=${scriptId}`);
      setChanges(data.changes);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <details className="mt-3 rounded-2xl bg-[var(--bg-raised)] px-4" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && load()}>
      <summary className="flex h-14 cursor-pointer items-center text-[15px] font-medium">修改记录</summary>
      {error ? (
        <p className="pb-4 text-[14px] text-[var(--record)]">{error}</p>
      ) : changes === null ? (
        <div className="mb-4 h-12 animate-pulse rounded-xl bg-[var(--row-line)]" />
      ) : changes.length ? (
        <ul className="pb-2">
          {changes.map((c) => <Row key={c.id} c={c} />)}
        </ul>
      ) : (
        <p className="pb-4 text-[14px] text-[var(--muted)]">还没有记录。</p>
      )}
    </details>
  );
}
