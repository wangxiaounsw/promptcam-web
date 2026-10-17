import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeCount, diffLines } from './prompt-diff.ts';

test('one changed line counts as one change', () => {
  assert.equal(changeCount('a\nb\nc', 'a\nB\nc'), 1);
});

test('identical prompts have no changes', () => {
  assert.equal(changeCount('a\nb', 'a\nb'), 0);
});

test('two separate edits count as two changes', () => {
  assert.equal(changeCount('a\nb\nc\nd', 'X\nb\nc\nY'), 2);
});

test('diffLines marks added and removed lines', () => {
  assert.deepEqual(diffLines('a\nb', 'a\nc'), [
    { kind: 'same', text: 'a' },
    { kind: 'del', text: 'b' },
    { kind: 'add', text: 'c' },
  ]);
});
