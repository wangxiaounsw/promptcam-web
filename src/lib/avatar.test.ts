import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avatarUrl } from './avatar.ts';

test('avatarUrl points at the public avatars bucket, null stays null', () => {
  assert.equal(avatarUrl(null), null);
  assert.ok(avatarUrl('u1/a.webp')!.endsWith('/storage/v1/object/public/avatars/u1/a.webp'));
});

test('squareCrop takes the largest centred square', async () => {
  const { squareCrop } = await import('./avatar.ts');
  assert.deepEqual(squareCrop(400, 300), { sx: 50, sy: 0, size: 300 });
  assert.deepEqual(squareCrop(300, 500), { sx: 0, sy: 100, size: 300 });
  assert.deepEqual(squareCrop(256, 256), { sx: 0, sy: 0, size: 256 });
});
