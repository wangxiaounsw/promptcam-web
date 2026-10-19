'use client';

import Link from 'next/link';
import { useStudioMe } from '../studio-me';
import ProfileCard from './ProfileCard';
import PromptCard from './PromptCard';
import VoiceCard from './VoiceCard';

/** 我的：头像名字 + 试听用的声音（设一次）+ 写稿提示词（初期常改）+ 反馈问题 */
export default function StudioMe() {
  const ctx = useStudioMe();
  const row = 'flex h-14 w-full items-center justify-between border-b border-[var(--row-line)] px-4 text-left text-base font-medium last:border-b-0';
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <h1 className="flex h-11 items-center text-[22px] font-bold">我的</h1>
      <ProfileCard />
      <PromptCard />
      <VoiceCard />
      <nav className="overflow-hidden rounded-2xl bg-[var(--bg-raised)]">
        <button type="button" onClick={() => ctx?.openFeedback()} className={row}>
          反馈问题<span className="text-[var(--muted)]">›</span>
        </button>
        {ctx?.me.isAdmin && (
          <Link href="/admin" className={`${row} md:hidden`}>后台<span className="text-[var(--muted)]">›</span></Link>
        )}
        <Link href="/ideas" className={`${row} md:hidden`}>回到网站<span className="text-[var(--muted)]">›</span></Link>
      </nav>
    </div>
  );
}
