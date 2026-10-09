import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublished } from '@/lib/content';

/**
 * 公开灵感库。引流页:标题、摘要、参考文献全部服务端渲染,Google 抓得到。
 * 口播稿正文不在这一页上 —— 列表的取数函数根本不返回它。
 *
 * ISR 10 分钟:内容是你手写的,不需要实时;但也不能构建时写死,
 * 否则你在后台发一篇还得等一次部署。
 */
export const revalidate = 600;

export const metadata: Metadata = {
  title: '口播库 · Fordexa',
  description:
    '按行业整理的口播稿，每条都附参考出处。律师、会计、移民中介打开 App 照着念就行。',
  alternates: { canonical: 'https://app.fordexa.com/ideas' },
  openGraph: {
    title: '口播库 · Fordexa',
    description: '按行业整理的口播稿，每条都附参考出处。',
    url: 'https://app.fordexa.com/ideas',
  },
};

export default async function IdeasPage() {
  const ideas = await listPublished();

  // 按行业分组。通用的排最后 —— 先让人看到和自己这行相关的
  const groups = new Map<string, typeof ideas>();
  for (const i of ideas) {
    const key = i.industryName ?? '通用';
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(i);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === '通用' ? 1 : b === '通用' ? -1 : a.localeCompare(b, 'zh'),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
      <p className="mb-4 text-xs font-semibold tracking-wide text-[var(--accent)]">
        口播库
      </p>
      <h1 className="font-display text-balance text-4xl font-bold leading-[1.2] md:text-5xl">
        该讲什么，我们已经想好了
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
        每条选题都是客户真问过的问题，查过出处才写。参考文献公开，
        完整口播稿给 Fordexa 的客户 —— 打开 App 照着念就行。
      </p>

      {!ideas.length && (
        <p className="mt-16 text-[var(--muted)]">选题还在整理中，过几天再来看看。</p>
      )}

      {ordered.map(([name, list]) => (
        <section key={name} className="mt-14">
          <h2 className="font-display mb-5 text-sm font-semibold tracking-wide text-[var(--muted)]">
            {name} · {list.length} 条
          </h2>
          <div className="space-y-3">
            {list.map((i) => (
              <Link
                key={i.code}
                href={`/ideas/${i.slug}`}
                className="block block rounded-2xl bg-[var(--bg-raised)] p-5 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(18,24,21,0.18)]"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-[var(--muted)]">
                    {i.code}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold leading-snug">
                      {i.title}
                    </h3>
                    {i.summary && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--muted)]">
                        {i.summary}
                      </p>
                    )}
                    <p className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                      {i.refs.length > 0 && <span>{i.refs.length} 条参考出处</span>}
                      {i.hasScript && !i.isFree && (
                        <span className="text-[var(--accent)]">含完整口播稿</span>
                      )}
                      {i.isFree && (
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-medium text-white">
                          免费样稿 · 不登录就能看
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-20 rounded-2xl bg-[var(--bg-raised)] p-8">
        <h2 className="font-display mb-3 text-xl font-semibold">想直接拿去拍？</h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          Fordexa 的客户打开 App 就能看到这些选题的完整口播稿，举起手机照着念，
          录完发回给我们，剪辑和发布也由我们做。
          <Link className="text-[var(--accent)] hover:underline" href="/login?next=%2Fideas">
            登录
          </Link>
          后可以直接申请开通，整家公司的人一起能看。
        </p>
      </div>
    </main>
  );
}
