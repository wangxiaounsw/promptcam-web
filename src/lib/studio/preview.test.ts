import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownsPreviewPath, previewHash } from './preview.ts';

test('previewHash changes when the voice changes, not otherwise', () => {
  assert.equal(previewHash('正文', 'voiceA'), previewHash('正文', 'voiceA'));
  assert.notEqual(previewHash('正文', 'voiceA'), previewHash('正文', 'voiceB'));
  assert.notEqual(previewHash('正文', 'voiceA'), previewHash('正文2', 'voiceA'));
});

test('ownsPreviewPath only accepts files under the caller\'s own audio folder', () => {
  assert.equal(ownsPreviewPath('audio/u1/s-abc.mp3', 'u1'), true);
  assert.equal(ownsPreviewPath('audio/u2/voice-test.mp3', 'u1'), false);
  assert.equal(ownsPreviewPath('audio/u1/../u2/x.mp3', 'u1'), false);
  assert.equal(ownsPreviewPath(null, 'u1'), false);
});
