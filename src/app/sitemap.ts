import type { MetadataRoute } from 'next';
import { listPublished } from '@/lib/content';

export const revalidate = 600;

/** 引流是这些页面存在的理由,所以 sitemap 必须把每篇都列出来。 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://app.fordexa.com';
  const ideas = await listPublished();
  return [
    { url: base, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/ideas`, changeFrequency: 'weekly', priority: 0.9 },
    ...ideas.map((i) => ({
      url: `${base}/ideas/${i.slug}`,
      lastModified: i.publishedAt ? new Date(i.publishedAt) : undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${base}/privacy`, priority: 0.2 },
    { url: `${base}/terms`, priority: 0.2 },
  ];
}
