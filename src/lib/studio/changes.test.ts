import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeChange } from './changes.ts';

test('create and delete', () => {
  assert.equal(describeChange({ action: 'create', field: null, old: null, new: '标题' }), '新建了这条稿子');
  assert.equal(describeChange({ action: 'delete', field: null, old: '标题\n\n正文', new: null }), '删除了这条稿子');
});

test('title and body', () => {
  assert.equal(describeChange({ action: 'update', field: 'title', old: '旧', new: '新' }), '改了标题：旧 → 新');
  assert.equal(describeChange({ action: 'update', field: 'body', old: 'a', new: 'b' }), '改了正文');
});

test('record_by: scheduled, moved, unscheduled', () => {
  assert.equal(describeChange({ action: 'update', field: 'record_by', old: null, new: '2026-10-21' }), '排到 10/21 录完');
  assert.equal(describeChange({ action: 'update', field: 'record_by', old: '2026-10-21', new: '2026-10-23' }), '把要录完日期从 10/21 改到 10/23');
  assert.equal(describeChange({ action: 'update', field: 'record_by', old: '2026-10-21', new: null }), '取消了排期（原来 10/21）');
});

test('status', () => {
  assert.equal(describeChange({ action: 'update', field: 'status', old: 'ready', new: 'recorded' }), '标成了已录');
  assert.equal(describeChange({ action: 'update', field: 'status', old: 'recorded', new: 'ready' }), '标回了待录');
  assert.equal(describeChange({ action: 'update', field: 'status', old: 'ready', new: 'archived' }), '移出了口播库');
});
