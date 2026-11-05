import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTER, GROUP_FACET, filterItems, isFiltered, sortItems, toggle } from './filter.ts';

const it = (code: string, group: string, tags: string[], extra: Record<string, string> = {}) => ({ code, group, tags, name: `名字${code}`, purpose: '说明', ...extra }) as never;
const ITEMS = [
  it('K01', '模板封面', ['一个数字'], { added: '2026-11-04' }),
  it('K02', '模板封面', ['谁多谁少'], { added: '2026-11-04' }),
  it('T01', '转场', ['讲数据'], { added: '2026-11-04' }),
  it('L04', '版式件', ['一个数字', '开头'], { added: '2026-11-06', name: '大数字' }),
];
const GROUPS = [{ name: '讲什么', tags: ['一个数字', '谁多谁少'] }, { name: '用在哪', tags: ['讲数据', '开头'] }];
const codes = (xs: { code: string }[]) => xs.map((x) => x.code);

test('no filter keeps everything', () => {
  assert.deepEqual(codes(filterItems(ITEMS, EMPTY_FILTER, GROUPS)), ['K01', 'K02', 'T01', 'L04']);
  assert.equal(isFiltered(EMPTY_FILTER), false);
});

test('tags in one column are OR, columns are AND', () => {
  assert.deepEqual(codes(filterItems(ITEMS, { ...EMPTY_FILTER, tags: ['一个数字', '谁多谁少'] }, GROUPS)), ['K01', 'K02', 'L04']);
  assert.deepEqual(codes(filterItems(ITEMS, { ...EMPTY_FILTER, tags: ['一个数字', '开头'] }, GROUPS)), ['L04']);
});

test('groups, search and skip', () => {
  const f = { ...EMPTY_FILTER, groups: ['模板封面'], tags: ['一个数字'] };
  assert.deepEqual(codes(filterItems(ITEMS, f, GROUPS)), ['K01']);
  assert.deepEqual(codes(filterItems(ITEMS, f, GROUPS, GROUP_FACET)), ['K01', 'L04']);
  assert.deepEqual(codes(filterItems(ITEMS, f, GROUPS, '讲什么')), ['K01', 'K02']);
  assert.deepEqual(codes(filterItems(ITEMS, { ...EMPTY_FILTER, q: '大数' }, GROUPS)), ['L04']);
  assert.deepEqual(codes(filterItems(ITEMS, { ...EMPTY_FILTER, q: 't01' }, GROUPS)), ['T01']);
});

test('sort: by group, or newest first', () => {
  const shuffled = [ITEMS[3], ITEMS[1], ITEMS[2], ITEMS[0]];
  assert.deepEqual(codes(sortItems(shuffled, 'group')), ['K01', 'K02', 'T01', 'L04']);
  assert.deepEqual(codes(sortItems(shuffled, 'newest')), ['L04', 'K02', 'K01', 'T01']);
  assert.deepEqual(codes(shuffled), ['L04', 'K02', 'T01', 'K01'], 'does not mutate');
});

test('toggle adds and removes', () => {
  assert.deepEqual(toggle(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggle(['a', 'b'], 'a'), ['b']);
});
