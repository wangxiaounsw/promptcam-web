import type { Metadata } from 'next';
import { listPublished, listTopics } from '@/lib/content';
import IdeasBrowser from './IdeasBrowser';

/**
 * 口播库总览。引流页:标题、摘要、标签、参考文献全部服务端渲染,Google 抓得到。
 * 口播稿正文不在这一页上 —— 列表的取数函数根本不返回它。
 *
 * 整个列表一次下发,搜索筛选排序都在浏览器里做,零延迟。
 * 几百条没问题;过了一千条再考虑分页。
 *
 * ISR 10 分钟兜底;后台发布/撤下会主动刷新,平时等不到这 10 分钟。
 */
export const revalidate = 600;

export const metadata: Metadata = {
  title: '口播库 · Fordexa',
  description:
    '按行业和主题整理的口播稿，每条都附参考出处，有的还能先听一遍。律师、会计、移民中介打开 App 照着念就行。',
  alternates: { canonical: 'https://app.fordexa.com/ideas' },
  openGraph: {
    title: '口播库 · Fordexa',
    description: '按行业和主题整理的口播稿，每条都附参考出处。',
    url: 'https://app.fordexa.com/ideas',
  },
};

export default async function IdeasPage() {
  const [ideas, topics] = await Promise.all([listPublished(), listTopics()]);

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-8 sm:px-6 sm:pt-12">
      {/* 列表页是工具页：一行标题一句话，故事留给首页讲 */}
      <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">口播库</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
        每条都是客户真问过的问题，查过出处才写。完整口播稿和朗读给 Fordexa 的客户。
      </p>

      <IdeasBrowser ideas={ideas} topics={topics} />
    </main>
  );
}
