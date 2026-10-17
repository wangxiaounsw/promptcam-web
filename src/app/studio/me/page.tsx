'use client';

import PromptCard from './PromptCard';
import VoiceCard from './VoiceCard';

/** 我的：试听用的声音（设一次）+ 写稿提示词（初期常改） */
export default function StudioMe() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <h1 className="flex h-11 items-center text-[22px] font-bold">我的</h1>
      <PromptCard />
      <VoiceCard />
    </div>
  );
}
