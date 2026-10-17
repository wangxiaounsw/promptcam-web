import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPrompt, splitAppendix, type PromptRow } from './prompt-pick.ts';

const row = (p: Partial<PromptRow>): PromptRow => ({
  id: p.id ?? 'x', step: 'write_script', org_id: null, industry: null, name: 'n', status: 'active', body: 'b', ...p,
});

const rows = [
  row({ id: 'general' }),
  row({ id: 'accounting', industry: 'accounting' }),
  row({ id: 'vtax', org_id: 'VTAX', industry: 'accounting' }),
  row({ id: 'old-general', status: 'inactive' }),
  row({ id: 'draft-legal', industry: 'legal', status: 'draft' }),
  row({ id: 'article', step: 'write_article' }),
];

test('company prompt wins over industry and general', () => {
  assert.deepEqual(pickPrompt(rows, 'write_script', { orgId: 'VTAX', industry: 'accounting' }), { row: rows[2], source: 'org' });
});

test('industry prompt is used when the company has none', () => {
  assert.equal(pickPrompt(rows, 'write_script', { orgId: 'OTHER', industry: 'accounting' })?.row.id, 'accounting');
});

test('general prompt is the fallback; drafts and inactive rows are never picked', () => {
  const r = pickPrompt(rows, 'write_script', { orgId: null, industry: 'legal' });
  assert.equal(r?.row.id, 'general');
  assert.equal(r?.source, 'general');
});

test('nothing active for the step → null', () => {
  assert.equal(pickPrompt(rows, 'screen', { orgId: null, industry: null }), null);
});

test('splitAppendix separates the source table after a --- line', () => {
  const out = splitAppendix('第一句。\n第二句。\n\n---\n| 口播里的说法 | 官方原数字 |\n| a | b |');
  assert.equal(out.body, '第一句。\n第二句。');
  assert.equal(out.appendix, '| 口播里的说法 | 官方原数字 |\n| a | b |');
});

test('splitAppendix leaves a script without --- untouched', () => {
  assert.deepEqual(splitAppendix('只有正文。'), { body: '只有正文。', appendix: null });
});
