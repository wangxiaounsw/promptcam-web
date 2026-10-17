'use client';

import { use } from 'react';
import ScriptPanel from './ScriptPanel';

/** 手机上的稿子页（电脑上口播库右栏直接嵌 ScriptPanel） */
export default function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ScriptPanel id={id} />;
}
