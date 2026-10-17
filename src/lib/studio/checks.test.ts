import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingCount } from './checks.ts';

test('pendingCount adds flagged figures and flagged sentences', () => {
  const checks = { figures: ['3 个月'], claims: [{ sentence: 'a', missing: 'b' }], claimsFailed: false, truncated: false };
  assert.equal(pendingCount(checks), 2);
});

test('pendingCount is 0 when the AI review has not run and for missing checks', () => {
  assert.equal(pendingCount({ figures: [], claims: null, claimsFailed: true, truncated: false }), 0);
  assert.equal(pendingCount(null), 0);
});
