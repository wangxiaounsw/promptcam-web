import { test } from 'node:test';
import assert from 'node:assert/strict';

// 假的 localStorage：两个标签页共用同一份
const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

test('a tab keeps the company it switched to even if another tab switches later', async () => {
  const { VIEWING_KEY, readViewing, writeViewing } = await import('./viewing.ts');
  writeViewing('vtax');
  assert.equal(readViewing(), 'vtax');
  // 另一个标签页切到了王小墨：写的是同一份 localStorage
  store.set(VIEWING_KEY, 'wxm');
  assert.equal(readViewing(), 'vtax');
});
