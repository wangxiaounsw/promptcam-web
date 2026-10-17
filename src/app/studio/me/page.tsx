'use client';

import Link from 'next/link';
import PromptCard from './PromptCard';
import VoiceCard from './VoiceCard';

/** 我的：试听用的声音（设一次）+ 写稿提示词（初期常改） */
export default function StudioMe() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <h1 className="flex h-11 items-center text-[22px] font-bold">我的</h1>
      <PromptCard />
      <VoiceCard />
      <nav className="overflow-hidden rounded-2xl bg-[var(--bg-raised)] md:hidden">
        <Link href="/admin" className="flex h-14 items-center justify-between border-b border-[var(--row-line)] px-4 text-base font-medium">后台<span className="text-[var(--muted)]">›</span></Link>
        <Link href="/ideas" className="flex h-14 items-center justify-between px-4 text-base font-medium">回到网站<span className="text-[var(--muted)]">›</span></Link>
      </nav>
    </div>
  );
}
