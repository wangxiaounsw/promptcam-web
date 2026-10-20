import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffSentences, sentences } from './script-diff.ts';

test('sentences split after Chinese and English end marks and keep the mark', () => {
  assert.deepEqual(sentences('先说结论。罚多少？最多 5 个!'), ['先说结论。', '罚多少？', '最多 5 个!']);
});

test('line breaks survive as their own tokens so paragraphs still show', () => {
  assert.deepEqual(sentences('第一段。\n\n第二段。'), ['第一段。', '\n', '\n', '第二段。']);
});

test('a line without an end mark is still one sentence', () => {
  assert.deepEqual(sentences('标题没有句号\n正文。'), ['标题没有句号', '\n', '正文。']);
});

test('unchanged script: every sentence is the same', () => {
  const text = '截止日是 11 月 2 日。找代理可以晚交。';
  assert.ok(diffSentences(text, text).every((d) => d.kind === 'same'));
});

test('one sentence rewritten inside a paragraph: only that sentence is marked', () => {
  const before = '截止日是 11 月 2 日。罚款最多 1650。开之前会先提醒。';
  const after = '截止日是 11 月 2 日。罚款最多 1820。开之前会先提醒。';
  const changed = diffSentences(before, after).filter((d) => d.kind !== 'same');
  assert.deepEqual(changed, [
    { kind: 'del', text: '罚款最多 1650。' },
    { kind: 'add', text: '罚款最多 1820。' },
  ]);
});

test('an added sentence shows as an addition and nothing else changes', () => {
  const diff = diffSentences('第一句。第三句。', '第一句。第二句。第三句。');
  assert.deepEqual(diff.filter((d) => d.kind !== 'same'), [{ kind: 'add', text: '第二句。' }]);
});
