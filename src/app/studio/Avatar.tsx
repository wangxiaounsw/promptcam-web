'use client';

import type { Person } from './api';

/** 圆头像。没传过的显示名字第一个字；null = 系统（触发器取不到人） */
export default function Avatar({ person, size }: { person: Person | null; size: 20 | 28 | 40 | 72 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  if (person?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.avatarUrl} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-tint)] font-bold leading-none text-[var(--accent)]"
    >
      {person ? [...person.name][0] ?? '?' : '系'}
    </span>
  );
}

/** 头像 + 名字一行小字（日历上的「谁放的」） */
export function Byline({ person }: { person: Person | null }) {
  if (!person) return null;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-[var(--muted)]">
      <Avatar person={person} size={20} />
      <span className="truncate">{person.name}</span>
    </span>
  );
}
