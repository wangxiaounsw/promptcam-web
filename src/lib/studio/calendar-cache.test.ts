import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REUSE_MS, adjacentMonths, cacheKey, isRecent, monthsOfYear, planFetch, shiftYearOf, snapshotKey, snapshotUsable } from './calendar-cache.ts';

test('cacheKey: 公司 + 月份；没有月份是 now，没有公司是 own', () => {
  assert.equal(cacheKey('org-1', '2026-11'), 'org-1|2026-11');
  assert.equal(cacheKey('org-1', null), 'org-1|now');
  assert.equal(cacheKey(null, '2026-11'), 'own|2026-11');
  assert.notEqual(cacheKey('a', '2026-11'), cacheKey('b', '2026-11'));
});

test('monthsOfYear: 12 个月，补零', () => {
  const m = monthsOfYear(2026);
  assert.equal(m.length, 12);
  assert.equal(m[0], '2026-01');
  assert.equal(m[8], '2026-09');
  assert.equal(m[11], '2026-12');
});

test('adjacentMonths: 跨年', () => {
  assert.deepEqual(adjacentMonths('2026-11'), ['2026-10', '2026-12']);
  assert.deepEqual(adjacentMonths('2026-12'), ['2026-11', '2027-01']);
  assert.deepEqual(adjacentMonths('2026-01'), ['2025-12', '2026-02']);
});

test('shiftYearOf: 选月份弹窗的年份加减', () => {
  assert.equal(shiftYearOf(2026, 1), 2027);
  assert.equal(shiftYearOf(2026, -1), 2025);
});

test('snapshotKey: 按人和公司分开存', () => {
  assert.notEqual(snapshotKey('u1', 'a'), snapshotKey('u1', 'b'));
  assert.notEqual(snapshotKey('u1', 'a'), snapshotKey('u2', 'a'));
});

test('isRecent: 刚取回来的数据（外壳预取的）页面挂载时直接用，不再请求第二遍', () => {
  assert.equal(isRecent(1000, 1000 + REUSE_MS - 1), true);
  assert.equal(isRecent(1000, 1000 + REUSE_MS), false);
  assert.equal(isRecent(undefined, 5), false);
  assert.equal(isRecent(2000, 1000), true); // 时钟回拨不算过期
});

test('snapshotUsable: 只有「同一天存的、存的就是当月」才能先画出来', () => {
  const ok = { month: '2026-10', today: '2026-10-28' };
  assert.equal(snapshotUsable(ok, '2026-10-28'), true);
  assert.equal(snapshotUsable(ok, '2026-10-29'), false); // 隔天了
  assert.equal(snapshotUsable({ month: '2026-11', today: '2026-10-28' }, '2026-10-28'), false); // 存的是翻到的别的月
  assert.equal(snapshotUsable(null, '2026-10-28'), false);
  assert.equal(snapshotUsable({ month: 5, today: 'x' }, '2026-10-28'), false); // 脏数据
});

const base = { fresh: false, low: false, inflightGen: undefined, generation: 3, fetchedAt: undefined, cached: false, now: 10_000 };

test('planFetch: 什么都没有就发新请求', () => {
  assert.equal(planFetch(base), 'fetch');
});

test('planFetch: 同一代还在飞的请求接上', () => {
  assert.equal(planFetch({ ...base, inflightGen: 3 }), 'join');
});

test('planFetch: 编辑之后再翻月 —— 飞着的是上一代的请求，不能接，要重发（否则骨架屏永远不走）', () => {
  assert.equal(planFetch({ ...base, inflightGen: 2 }), 'fetch');
});

test('planFetch: 刚取回来的缓存直接用；过了 5 秒或没缓存就重取', () => {
  assert.equal(planFetch({ ...base, cached: true, fetchedAt: 10_000 - 1000 }), 'reuse');
  assert.equal(planFetch({ ...base, cached: true, fetchedAt: 10_000 - REUSE_MS }), 'fetch');
  assert.equal(planFetch({ ...base, cached: false, fetchedAt: 10_000 - 1000 }), 'fetch');
});

test('planFetch: fresh 永远重发；预取不复用缓存', () => {
  assert.equal(planFetch({ ...base, fresh: true, inflightGen: 3, cached: true, fetchedAt: 9999 }), 'fetch');
  assert.equal(planFetch({ ...base, low: true, cached: true, fetchedAt: 9999 }), 'fetch');
});
