'use client';

import { useState } from 'react';

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="rounded-lg bg-[var(--accent-tint)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* 浏览器不给剪贴板权限时静默,用户还能自己选中复制 */
        }
      }}
    >
      {copied ? '已复制' : '复制全文'}
    </button>
  );
}
