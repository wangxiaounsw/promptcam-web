'use client';

import { useEffect, useState } from 'react';

const FIELD = 'w-full rounded-xl border border-[var(--line)] bg-transparent p-3 text-[15px]';

/** 一个失焦才保存的文字框；保存失败就退回原值，服务端改过的值（value 变了）会同步进来 */
export default function Blurred({ value, onSave, multiline, maxLength, placeholder, className }: {
  value: string; onSave: (v: string) => Promise<boolean>; multiline?: boolean; maxLength: number; placeholder: string; className?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const props = {
    value: v, maxLength, placeholder, 'aria-label': placeholder, className: className ?? FIELD,
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: async () => {
      if (v.trim() === value) return;
      if (!(await onSave(v))) setV(value);
    },
  };
  return multiline ? <textarea rows={6} {...props} /> : <input {...props} />;
}
