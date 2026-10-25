import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkbox, date, relationIds, select, text } from './notion-api.ts';

const page = {
  id: 'p1',
  properties: {
    名称: { type: 'title', title: [{ plain_text: '写口播 · ' }, { plain_text: 'Vtax' }] },
    所属企业: { type: 'rich_text', rich_text: [{ plain_text: 'Vtax' }] },
    状态: { type: 'select', select: { name: '启用' } },
    行业: { type: 'select', select: null },
    同步网站: { type: 'checkbox', checkbox: true },
    网站同步于: { type: 'date', date: { start: '2026-10-25T06:00:00+11:00' } },
    接手解除于: { type: 'date', date: null },
    提示词: { type: 'relation', relation: [{ id: 'a' }, { id: 'b' }] },
  },
};

test('text reads title and rich_text', () => {
  assert.equal(text(page, '名称'), '写口播 · Vtax');
  assert.equal(text(page, '所属企业'), 'Vtax');
  assert.equal(text(page, '不存在'), '');
});

test('select, checkbox, date, relation', () => {
  assert.equal(select(page, '状态'), '启用');
  assert.equal(select(page, '行业'), null);
  assert.equal(checkbox(page, '同步网站'), true);
  assert.equal(checkbox(page, '不存在'), false);
  assert.equal(date(page, '网站同步于'), '2026-10-25T06:00:00+11:00');
  assert.equal(date(page, '接手解除于'), null);
  assert.deepEqual(relationIds(page, '提示词'), ['a', 'b']);
});
