import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESEARCH_MARK_HEAD, researchMarks } from './markers.ts';

test('finds a complete research marker', () => {
  const body = `a${RESEARCH_MARK_HEAD}：门槛】b`;
  assert.deepEqual(researchMarks(body), [`${RESEARCH_MARK_HEAD}：门槛】`]);
});

test('no marker → empty list', () => {
  assert.deepEqual(researchMarks('普通的稿子【强调】'), []);
});

test('finds several markers in order', () => {
  const body = `${RESEARCH_MARK_HEAD}：一】中间${RESEARCH_MARK_HEAD}：二】`;
  assert.equal(researchMarks(body).length, 2);
});
