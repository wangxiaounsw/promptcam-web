import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // /admin 不该被收录;/api 也没有给人看的东西
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    ],
    sitemap: 'https://app.fordexa.com/sitemap.xml',
  };
}
