import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUP_ORDER, mediaUrl, parseManifest } from './library.ts';

const item = (code: string, group: string, extra: Record<string, unknown> = {}) => ({
  code, group, kind: 'cover', name: '大数字', purpose: '一句说明', origin: '封面模板', source: 'kit:x', file: `${code}-abcd1234.jpg`, width: 540, height: 720, ...extra,
});

test('parseManifest rejects bad input', () => {
  for (const bad of [null, 'x', {}, { version: 2, items: [] }, { version: 1, items: 'no' }]) {
    assert.equal(parseManifest(bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(parseManifest({ version: 1, items: [item('K01', '模板封面', { file: '../x.jpg' })] }).ok, false);
  assert.equal(parseManifest({ version: 1, items: [item('K01', '模板封面', { file: 'a/b.jpg' })] }).ok, false);
  assert.equal(parseManifest({ version: 1, items: [item('K01', '模板封面', { poster: '../p.jpg' })] }).ok, false);
  assert.equal(parseManifest({ version: 1, items: [item('K01', '模板封面', { kind: 'gif' })] }).ok, false);
  assert.equal(parseManifest({ version: 1, items: [item('K01', '模板封面', { width: 'big' })] }).ok, false);
  assert.equal(parseManifest({ version: 1, items: [{ code: 'K01' }] }).ok, false);
});

test('parseManifest sorts by group then code', () => {
  const r = parseManifest({ version: 1, items: [item('T01', '转场', { kind: 'video', poster: 'T01-p.jpg' }), item('K02', '模板封面'), item('K10', '模板封面'), item('K01', '模板封面')] });
  assert.ok(r.ok);
  assert.deepEqual(r.items.map((i) => i.code), ['K01', 'K02', 'K10', 'T01']);
  assert.equal(r.items[3].poster, 'T01-p.jpg');
});

test('parseManifest drops unknown groups but keeps the rest', () => {
  const r = parseManifest({ version: 1, items: [item('K01', '模板封面'), item('X01', '不认识')] });
  assert.ok(r.ok);
  assert.deepEqual(r.items.map((i) => i.code), ['K01']);
});

test('parseManifest reads tags, added and tagGroups; old manifests still work', () => {
  const r = parseManifest({
    version: 1,
    tagGroups: [{ name: '讲什么', tags: ['一个数字'] }, { name: '坏的', tags: 'x' }, { name: '空的', tags: [] }],
    items: [item('K01', '模板封面', { tags: ['一个数字'], added: '2026-11-04' }), item('K02', '模板封面')],
  });
  assert.ok(r.ok);
  assert.deepEqual(r.tagGroups, [{ name: '讲什么', tags: ['一个数字'] }]);
  assert.deepEqual(r.items[0].tags, ['一个数字']);
  assert.equal(r.items[0].added, '2026-11-04');
  assert.deepEqual(r.items[1].tags, []);
  const old = parseManifest({ version: 1, items: [item('K01', '模板封面')] });
  assert.ok(old.ok);
  assert.deepEqual(old.tagGroups, []);
  assert.equal(parseManifest({ version: 1, items: [item('K01', '模板封面', { tags: [1] })] }).ok, false);
  assert.equal(parseManifest({ version: 1, items: [item('K01', '模板封面', { added: '昨天' })] }).ok, false);
});

test('GROUP_ORDER is the six groups in page order', () => {
  assert.deepEqual(GROUP_ORDER, ['模板封面', '实拍封面', '转场', '口播效果', '素材卡片', '版式件']);
});

test('mediaUrl builds public path', () => {
  assert.equal(mediaUrl('K01-abcd1234.jpg', 'https://x.supabase.co'), 'https://x.supabase.co/storage/v1/object/public/style-library/K01-abcd1234.jpg');
});
