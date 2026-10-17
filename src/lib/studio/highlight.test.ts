import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlight } from './highlight.ts';

const MARK = '【这条信息文章里没有，需要联系 Fordexa 补充调研：门槛】';

test('marks figures and claim sentences yellow, research marks red, the rest plain', () => {
  const body = `晚交一天罚 220 澳元。税是提前交的。${MARK}`;
  const out = highlight(body, { figures: ['220 澳元'], claims: [{ sentence: '晚交一天罚 220 澳元。', missing: 'x' }] });
  assert.deepEqual(out.segments, [
    { text: '晚交一天罚 220 澳元。', kind: 'unsupported' },
    { text: '税是提前交的。', kind: 'plain' },
    { text: MARK, kind: 'research' },
  ]);
  assert.deepEqual(out.unplaced, []);
});

test('a figure inside plain text is cut out on its own', () => {
  const out = highlight('等 3 个月再交', { figures: ['3 个月'], claims: [] });
  assert.deepEqual(out.segments, [
    { text: '等 ', kind: 'plain' },
    { text: '3 个月', kind: 'unsupported' },
    { text: '再交', kind: 'plain' },
  ]);
});

test('a claim sentence that is not in the body is reported as unplaced', () => {
  const out = highlight('正文', { figures: [], claims: [{ sentence: '不在正文里的话', missing: '缺' }] });
  assert.deepEqual(out.segments, [{ text: '正文', kind: 'plain' }]);
  assert.deepEqual(out.unplaced, [{ sentence: '不在正文里的话', missing: '缺' }]);
});

test('no checks → one plain segment', () => {
  assert.deepEqual(highlight('正文', null).segments, [{ text: '正文', kind: 'plain' }]);
});
