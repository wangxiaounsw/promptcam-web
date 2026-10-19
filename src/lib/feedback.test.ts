import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedbackImageExt, validateFeedback } from './feedback.ts';

const png = { type: 'image/png', size: 1 };

test('message is required and capped at 5000 chars', () => {
  assert.equal(validateFeedback({ message: '  ', images: [] }), '先写一下遇到了什么问题');
  assert.equal(validateFeedback({ message: 'x'.repeat(5001), images: [] }), '描述太长了（最多 5000 字）');
});

test('at most 4 screenshots', () => {
  assert.equal(validateFeedback({ message: 'ok', images: Array(5).fill(png) }), '最多 4 张截图');
});

test('HEIC photos get a clear message', () => {
  assert.equal(
    validateFeedback({ message: 'ok', images: [{ type: 'image/heic', size: 1 }] }),
    '只支持 png / jpg / webp / gif 截图（iPhone 照片请先截个屏）',
  );
});

test('a screenshot over 6MB is rejected', () => {
  assert.equal(validateFeedback({ message: 'ok', images: [{ type: 'image/png', size: 6 * 1024 * 1024 + 1 }] }), '单张截图不能超过 6MB');
});

test('a valid report passes', () => {
  assert.equal(validateFeedback({ message: 'ok', images: [{ type: 'image/jpeg', size: 100 }] }), null);
});

test('file extension follows the mime type', () => {
  assert.equal(feedbackImageExt('image/jpeg'), 'jpg');
  assert.equal(feedbackImageExt('image/png'), 'png');
  assert.equal(feedbackImageExt('image/webp'), 'webp');
  assert.equal(feedbackImageExt('image/gif'), 'gif');
});

test('screenshots together must stay under the 4MB request budget (Vercel rejects bodies over 4.5MB)', () => {
  const three = Array(3).fill({ type: 'image/jpeg', size: 1.5 * 1024 * 1024 });
  assert.equal(validateFeedback({ message: 'ok', images: three }), '截图加起来太大了（最多 4MB），少传几张');
  assert.equal(validateFeedback({ message: 'ok', images: three.slice(0, 2) }), null);
});
