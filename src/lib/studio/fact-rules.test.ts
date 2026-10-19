import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_LIMIT, buildSourceText } from './fact-rules.ts';

const refs = [{ label: 'ATO PAYG instalments', url: 'https://www.ato.gov.au/payg' }];

test('a long article is truncated and the other sections stay whole', () => {
  const { text, truncated } = buildSourceText({ title: '标题', original: '原稿全文', article: '字'.repeat(30000), refs });
  assert.equal(truncated, true);
  assert.ok(text.length <= SOURCE_LIMIT + 2000, String(text.length));
  assert.ok(text.includes('原稿全文'));
  assert.ok(text.includes('https://www.ato.gov.au/payg'));
});

test('a short article is kept whole with every source url', () => {
  const { text, truncated } = buildSourceText({ title: '标题', original: '原稿', article: '短文章', refs });
  assert.equal(truncated, false);
  assert.ok(text.includes('短文章'));
  assert.ok(text.includes('ATO PAYG instalments') && text.includes('https://www.ato.gov.au/payg'));
});

test('no article still produces title and original', () => {
  const { text } = buildSourceText({ title: '只有标题', original: '只有原稿', article: null, refs: [] });
  assert.ok(text.includes('只有标题') && text.includes('只有原稿'));
});

test('a claimed script leaves the fordexa original out of the material', () => {
  const { text } = buildSourceText({ title: '标题', original: null, article: '文章内容', refs });
  assert.ok(!text.includes('【Fordexa 原稿】'));
  assert.ok(text.includes('【选题】') && text.includes('【文章】') && text.includes('【出处】'));
});
