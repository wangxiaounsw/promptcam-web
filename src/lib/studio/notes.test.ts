import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seenColumn, toNoteViews, validateNoteBody, type NoteRow } from './notes.ts';

test('validateNoteBody trims and rejects empty / over-long', () => {
  assert.deepEqual(validateNoteBody('  你好 '), { value: '你好', error: null });
  assert.equal(validateNoteBody('   ').error, '备注不能为空');
  assert.equal(validateNoteBody(undefined).error, '备注不能为空');
  assert.equal(validateNoteBody(42).error, '备注不能为空');
  assert.equal(validateNoteBody('字'.repeat(1000)).error, null);
  assert.equal(validateNoteBody('字'.repeat(1001)).error, '备注最多 1000 字');
  // 1000 个增补平面字符也算 1000 字
  assert.equal(validateNoteBody('😀'.repeat(1000)).error, null);
  // 前后空格不占额度
  assert.equal(validateNoteBody(` ${'字'.repeat(1000)} `).error, null);
});

test('seenColumn picks the viewer side', () => {
  assert.equal(seenColumn(true), 'admin_seen_at');
  assert.equal(seenColumn(false), 'client_seen_at');
});

test('toNoteViews sorts ascending, marks mine, tolerates missing author', () => {
  const rows: NoteRow[] = [
    { id: 'b', kind: 'note', body: 'later', created_at: '2026-10-28T02:00:00Z', author_id: 'u1' },
    { id: 'a', kind: 'system', body: 'first', created_at: '2026-10-28T01:00:00Z', author_id: null },
    { id: 'c', kind: 'note', body: 'other', created_at: '2026-10-28T03:00:00Z', author_id: 'u2' },
  ];
  const people = new Map([['u1', { id: 'u1', name: 'A', avatarUrl: null, isAdmin: true }]]);
  const out = toNoteViews(rows, people, 'u1');
  assert.deepEqual(out.map((n) => n.id), ['a', 'b', 'c']);
  assert.deepEqual(out.map((n) => n.mine), [false, true, false]);
  assert.equal(out[0].author, null);
  assert.equal(out[1].author?.name, 'A');
  assert.equal(out[2].author, null);
});
