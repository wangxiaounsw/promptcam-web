import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveScope, statusKey } from './scope.ts';

const ORGS = [
  { id: 'v1', name: 'Vtax', industry: 'accounting' },
  { id: 'w1', name: '王小墨', industry: 'data' },
  { id: 'f1', name: 'fordexa', industry: null },
  { id: 'f2', name: 'Fordexa', industry: 'data' },
];
const m = { step: '写口播', industry: '会计', company: 'Vtax', status: '启用' };

test('org row ignores industry', () => {
  const r = resolveScope({ step: '写口播', industry: '数据', company: 'Vtax', status: '启用' }, ORGS);
  assert.deepEqual(r, { ok: true, scope: { step: 'write_script', orgId: 'v1', industry: null }, orgIndustry: 'accounting' });
});

test('general row', () => {
  assert.deepEqual(resolveScope({ step: '写文章', industry: '通用', company: null, status: '草稿' }, ORGS), {
    ok: true,
    scope: { step: 'write_article', orgId: null, industry: null },
    orgIndustry: null,
  });
});

test('industry row', () => {
  assert.deepEqual(resolveScope({ step: '写文章', industry: '会计', company: null, status: '草稿' }, ORGS), {
    ok: true,
    scope: { step: 'write_article', orgId: null, industry: 'accounting' },
    orgIndustry: null,
  });
});

test('org name not found', () => {
  const r = resolveScope({ ...m, company: 'vtax' }, ORGS);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : '', /找不到公司/);
});

test('org name ambiguous', () => {
  const r = resolveScope({ ...m, company: 'Vtax' }, [...ORGS, { id: 'v2', name: 'Vtax', industry: null }]);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : '', /不唯一/);
});

test('case-sensitive org names are distinct', () => {
  const r = resolveScope({ ...m, company: 'Fordexa' }, ORGS);
  assert.equal(r.ok && r.scope.orgId, 'f2');
});

test('unknown step', () => {
  assert.equal(resolveScope({ ...m, step: '剪辑' }, ORGS).ok, false);
});

test('unknown industry on a general row', () => {
  assert.equal(resolveScope({ ...m, company: null, industry: '餐饮' }, ORGS).ok, false);
});

test('statusKey', () => {
  assert.equal(statusKey('启用'), 'active');
  assert.equal(statusKey('草稿'), 'draft');
  assert.equal(statusKey('停用'), null);
});
