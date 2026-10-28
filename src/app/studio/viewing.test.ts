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

test('switching company stays on the same tab, except a single script page goes back to 口播库', async () => {
  const { pathAfterSwitch } = await import('./viewing.ts');
  assert.equal(pathAfterSwitch('/studio/calendar'), '/studio/calendar');
  assert.equal(pathAfterSwitch('/studio/showcase'), '/studio/showcase');
  assert.equal(pathAfterSwitch('/studio'), '/studio');
  // 稿子页属于原来那家公司，切过去打不开
  assert.equal(pathAfterSwitch('/studio/s/3c178da0-bebe-46a3-b1ab-1977ffd36226'), '/studio');
  assert.equal(pathAfterSwitch(''), '/studio');
});

test('a tab keeps the company it switched to even if another tab switches later', async () => {
  const { VIEWING_KEY, readViewing, writeViewing } = await import('./viewing.ts');
  writeViewing('vtax');
  assert.equal(readViewing(), 'vtax');
  // 另一个标签页切到了王小墨：写的是同一份 localStorage
  store.set(VIEWING_KEY, 'wxm');
  assert.equal(readViewing(), 'vtax');
});
