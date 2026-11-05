import type { Metadata } from 'next';
import { fetchLibrary, mediaUrl } from '@/lib/library';
import LibraryGrid, { type GridItem } from './LibraryGrid';

/**
 * 风格库：王小墨的封面、转场、口播效果、素材卡片、版式件，每个一个固定编号。
 * 不用登录，有链接就能看；不收录（这里 noindex；robots.ts 故意不挡 /library，否则爬虫读不到 noindex；不进 sitemap、不从别处链接）。
 * 数据见 src/lib/library.ts。
 */
export const metadata: Metadata = {
  title: '风格库 · Fordexa',
  robots: { index: false, follow: false, nocache: true },
};

export const revalidate = 300;

export default async function LibraryPage() {
  const lib = await fetchLibrary();
  if (!lib.ok) {
    console.error('[library] manifest unavailable:', lib.reason);
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center text-[15px] text-neutral-500">
        风格库暂时打不开，过几分钟再试。
      </main>
    );
  }
  const items: GridItem[] = lib.items.map((i) => ({
    ...i,
    url: mediaUrl(i.file),
    posterUrl: i.poster ? mediaUrl(i.poster) : undefined,
  }));
  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-10">
      <LibraryGrid items={items} tagGroups={lib.tagGroups} />
      <footer className="mt-12 text-center text-[12px] text-neutral-400">Fordexa</footer>
    </main>
  );
}
