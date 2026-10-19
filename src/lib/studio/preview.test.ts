import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewHash } from './preview.ts';

test('previewHash changes when the voice changes, not otherwise', () => {
  assert.equal(previewHash('正文', 'voiceA'), previewHash('正文', 'voiceA'));
  assert.notEqual(previewHash('正文', 'voiceA'), previewHash('正文', 'voiceB'));
  assert.notEqual(previewHash('正文', 'voiceA'), previewHash('正文2', 'voiceA'));
});

test('previewPathAllowed accepts the org folder and the owner\'s legacy folder only', async () => {
  const { previewPathAllowed } = await import('./preview.ts');
  assert.equal(previewPathAllowed('audio/org/o1/s-abc.mp3', { orgId: 'o1', ownerId: 'u1' }), true);
  assert.equal(previewPathAllowed('audio/org/o1/s-abc.mp3', { orgId: 'o2', ownerId: 'u1' }), false);
  assert.equal(previewPathAllowed('audio/u1/s-abc.mp3', { orgId: 'o2', ownerId: 'u1' }), true);
  assert.equal(previewPathAllowed('audio/u2/s-abc.mp3', { orgId: 'o1', ownerId: 'u1' }), false);
  assert.equal(previewPathAllowed('audio/org/o1/../o2/x.mp3', { orgId: 'o1', ownerId: 'u1' }), false);
  assert.equal(previewPathAllowed(null, { orgId: 'o1', ownerId: 'u1' }), false);
});
