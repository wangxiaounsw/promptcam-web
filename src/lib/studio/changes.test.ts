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

test('publish_on and stage in plain words', () => {
  assert.equal(describeChange({ action: 'update', field: 'publish_on', old: '2026-11-03', new: '2026-11-06' }), '把发布日期从 11/3 改到 11/6');
  assert.equal(describeChange({ action: 'update', field: 'publish_on', old: null, new: '2026-11-03' }), '排到 11/3 发布');
  assert.equal(describeChange({ action: 'update', field: 'publish_on', old: '2026-11-03', new: null }), '取消了发布日期');
  assert.equal(describeChange({ action: 'update', field: 'stage', old: 'refining', new: 'final' }), '进度：精修中 → 定稿');
  assert.equal(describeChange({ action: 'update', field: 'stage', old: 'cut', new: 'published' }), '标成已发布');
});

test('content fields, stats and notes', () => {
  const u = (field: string, o: string | null, n: string | null) => describeChange({ action: 'update', field, old: o, new: n });
  assert.equal(u('xhs_title', 'a', 'b'), '改了小红书标题');
  assert.equal(u('xhs_body', 'a', 'b'), '改了小红书正文');
  assert.equal(u('media_url', null, 'https://x'), '贴了成片链接');
  assert.equal(u('media_url', 'https://x', null), '清掉了成片链接');
  assert.equal(u('likes', '0', '12000'), '赞 0 → 12000');
  assert.equal(u('saves', null, '5'), '藏 0 → 5');
  assert.equal(u('note', null, '一条备注'), '加了一条备注');
  assert.equal(u('note', '一条备注', null), '删了一条备注');
  assert.equal(u('kind', 'video', 'image'), '改成了图文');
  assert.equal(u('is_extra', 'false', 'true'), '标成了热点');
  assert.equal(u('nonsense', 'a', 'b'), '改了这条稿子');
});
