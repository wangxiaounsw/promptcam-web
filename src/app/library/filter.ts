import { GROUP_ORDER, type LibraryItem, type TagGroup } from '../../lib/library.ts';

/**
 * 风格库左侧筛选：同一栏里多选是「或」，不同栏之间是「且」；搜索看编号、名字、说明。
 * 纯函数，LibraryGrid 用，测试在 filter.test.ts。
 */
export type Sort = 'group' | 'newest';
export type FilterState = { groups: string[]; tags: string[]; q: string; sort: Sort };
export const EMPTY_FILTER: FilterState = { groups: [], tags: [], q: '', sort: 'group' };
/** 「类型」这一栏在 skip 参数里的名字（标签栏用它们自己的 name）。 */
export const GROUP_FACET = '类型';

type Item = Pick<LibraryItem, 'code' | 'group' | 'name' | 'purpose' | 'tags' | 'added'>;

const matchesQuery = (i: Item, q: string) => {
  const s = q.trim().toLowerCase();
  return !s || [i.code, i.name, i.purpose].some((t) => t.toLowerCase().includes(s));
};

/** skip：算某一栏的数字时不看这一栏自己选了什么（这样同栏其他选项的数字不会变成 0）。 */
export function filterItems<T extends Item>(items: T[], f: FilterState, tagGroups: TagGroup[], skip?: string): T[] {
  const facets = tagGroups
    .filter((g) => g.name !== skip)
    .map((g) => g.tags.filter((t) => f.tags.includes(t)))
    .filter((picked) => picked.length);
  return items.filter((i) =>
    (skip === GROUP_FACET || !f.groups.length || f.groups.includes(i.group))
    && facets.every((picked) => picked.some((t) => i.tags.includes(t)))
    && matchesQuery(i, f.q));
}

const rank = (i: Item) => (GROUP_ORDER as readonly string[]).indexOf(i.group);
const num = (i: Item) => Number(i.code.slice(1));

/** group：按类型、编号（manifest 的顺序）；newest：加入日期新的在前，同一天的编号大的在前。 */
export function sortItems<T extends Item>(items: T[], sort: Sort): T[] {
  const byGroup = (a: T, b: T) => rank(a) - rank(b) || num(a) - num(b);
  if (sort === 'group') return [...items].sort(byGroup);
  return [...items].sort((a, b) => (b.added ?? '').localeCompare(a.added ?? '') || rank(a) - rank(b) || num(b) - num(a));
}

export const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const isFiltered = (f: FilterState) => f.groups.length > 0 || f.tags.length > 0 || f.q.trim() !== '';
