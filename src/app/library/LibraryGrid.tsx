'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GROUP_ORDER, type LibraryItem, type TagGroup } from '@/lib/library';
import { EMPTY_FILTER, GROUP_FACET, filterItems, isFiltered, sortItems, toggle, type FilterState, type Sort } from './filter';

export type GridItem = LibraryItem & { url: string; posterUrl?: string };
const COPIED_MS = 1500;
const SORTS: { value: Sort; label: string }[] = [
  { value: 'group', label: '按类型' },
  { value: 'newest', label: '最新加入' },
];

const chip = (on: boolean) =>
  `rounded-full px-2.5 py-1 text-[12px] leading-none transition-colors ${on ? 'bg-[#2C3E50] text-white' : 'border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'}`;

interface CardProps {
  item: GridItem;
  activeTags: string[];
  onTag: (tag: string) => void;
}

function Card({ item, activeTags, onTag }: CardProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(item.code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_MS);
  };
  return (
    <figure className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <button type="button" onClick={copy} title="点一下复制编号" className="relative w-full bg-neutral-100" style={{ aspectRatio: `${item.width} / ${item.height}` }}>
        {item.kind === 'cover' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <video src={item.url} poster={item.posterUrl} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
        )}
        <span className="absolute left-2 top-2 rounded-lg bg-[#FEC03A] px-2 py-0.5 text-[15px] font-bold text-[#2C3E50] shadow">{item.code}</span>
        {copied && <span className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/75 px-3 py-1 text-[13px] text-white">已复制 {item.code}</span>}
      </button>
      <figcaption className="flex flex-col gap-1.5 p-3">
        <span className="text-[14px] font-semibold text-neutral-900">{item.name}</span>
        {item.tags.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <button key={t} type="button" onClick={() => onTag(t)} title={`只看「${t}」`}
                className={`rounded-md px-2 py-0.5 text-[12px] font-medium ${activeTags.includes(t) ? 'bg-[#FEC03A] text-[#2C3E50]' : 'bg-[#2C3E50]/10 text-[#2C3E50] hover:bg-[#2C3E50]/20'}`}>
                {t}
              </button>
            ))}
          </span>
        )}
        <span className="line-clamp-3 text-[12px] leading-snug text-neutral-500">{item.purpose}</span>
        <span className="text-[11px] text-neutral-400">{item.origin}</span>
      </figcaption>
    </figure>
  );
}

interface FacetProps {
  title: string;
  options: { value: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
}

function Facet({ title, options, selected, onToggle }: FacetProps) {
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-semibold text-neutral-500">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {options.map(({ value, count }) => {
          const on = selected.includes(value);
          return (
            <button key={value} type="button" onClick={() => onToggle(value)} disabled={!on && count === 0}
              className={`${chip(on)} disabled:cursor-default disabled:opacity-35`}>
              {value}<span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface LibraryGridProps {
  items: GridItem[];
  tagGroups: TagGroup[];
}

export default function LibraryGrid({ items, tagGroups }: LibraryGridProps) {
  const [f, setF] = useState<FilterState>(EMPTY_FILTER);
  const resultsRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  // any filter or sort change jumps back to the top of the results (the sidebar is sticky, so it stays put)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const top = resultsRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollTo({ top: window.scrollY + top });
  }, [f]);
  const shown = useMemo(() => sortItems(filterItems(items, f, tagGroups), f.sort), [items, f, tagGroups]);

  // each column's numbers ignore that column's own picks, so picking one option doesn't zero out its neighbours
  const groupOptions = useMemo(() => {
    const base = filterItems(items, f, tagGroups, GROUP_FACET);
    return GROUP_ORDER.map((g) => ({ value: g as string, count: base.filter((i) => i.group === g).length }));
  }, [items, f, tagGroups]);
  const tagOptions = useMemo(() => tagGroups.map((g) => {
    const base = filterItems(items, f, tagGroups, g.name);
    return { name: g.name, options: g.tags.map((t) => ({ value: t, count: base.filter((i) => i.tags.includes(t)).length })) };
  }), [items, f, tagGroups]);

  const toggleTag = (t: string) => setF((s) => ({ ...s, tags: toggle(s.tags, t) }));
  const sections = f.sort === 'group'
    ? GROUP_ORDER.map((g) => ({ g: g as string, list: shown.filter((i) => i.group === g) })).filter((s) => s.list.length)
    : [{ g: '', list: shown }];

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="flex shrink-0 flex-col gap-5 pt-4 md:sticky md:top-0 md:h-screen md:w-60 md:overflow-y-auto md:pb-8">
        <div>
          <h1 className="text-[18px] font-bold text-neutral-900">风格库</h1>
          <p className="mt-0.5 text-[12px] text-neutral-500">点图复制编号，告诉我编号就行</p>
        </div>
        <input type="search" value={f.q} onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))} placeholder="搜编号、名字、说明"
          className="h-9 rounded-lg border border-neutral-200 px-3 text-[13px] outline-none focus:border-neutral-400" />
        <section>
          <h3 className="mb-2 text-[12px] font-semibold text-neutral-500">排序</h3>
          <div className="flex gap-1.5">
            {SORTS.map((s) => (
              <button key={s.value} type="button" onClick={() => setF((x) => ({ ...x, sort: s.value }))} className={chip(f.sort === s.value)}>{s.label}</button>
            ))}
          </div>
        </section>
        <Facet title={GROUP_FACET} options={groupOptions} selected={f.groups} onToggle={(g) => setF((s) => ({ ...s, groups: toggle(s.groups, g) }))} />
        {tagOptions.map((g) => <Facet key={g.name} title={g.name} options={g.options} selected={f.tags} onToggle={toggleTag} />)}
        {isFiltered(f) && (
          <button type="button" onClick={() => setF((s) => ({ ...EMPTY_FILTER, sort: s.sort }))} className="self-start text-[12px] text-neutral-500 underline">
            清除筛选
          </button>
        )}
      </aside>

      <div ref={resultsRef} className="min-w-0 flex-1 pt-4">
        <p className="mb-3 text-[12px] text-neutral-500">共 {shown.length} 个{isFiltered(f) ? `（全部 ${items.length}）` : ''}</p>
        {shown.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-300 py-16 text-center text-[13px] text-neutral-500">
            没有符合的。<button type="button" className="underline" onClick={() => setF((s) => ({ ...EMPTY_FILTER, sort: s.sort }))}>清除筛选</button>
          </div>
        )}
        {sections.map(({ g, list }) => (
          <section key={g || 'all'} className="mb-6">
            {g && <h2 className="mb-3 text-[15px] font-semibold text-neutral-800">{g}<span className="ml-1.5 text-[12px] font-normal text-neutral-400">{list.length}</span></h2>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {list.map((it) => <Card key={it.code} item={it} activeTags={f.tags} onTag={toggleTag} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
