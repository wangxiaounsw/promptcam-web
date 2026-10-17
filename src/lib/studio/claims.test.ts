import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClaimReview } from './claims.ts';

test('parses JSON wrapped in a code fence', () => {
  const raw = '```json\n{"unsupported":[{"sentence":"必须有雇主担保","missing":"担保要求"}]}\n```';
  assert.deepEqual(parseClaimReview(raw), [{ sentence: '必须有雇主担保', missing: '担保要求' }]);
});

test('empty list means everything is supported', () => {
  assert.deepEqual(parseClaimReview('{"unsupported":[]}'), []);
});

test('prose instead of JSON → null', () => {
  assert.equal(parseClaimReview('好的，以下是'), null);
});

test('truncated JSON → null', () => {
  assert.equal(parseClaimReview('{"unsupported":[{"sentence"'), null);
});

test('an item without a sentence → null', () => {
  assert.equal(parseClaimReview('{"unsupported":[{"missing":"x"}]}'), null);
});
