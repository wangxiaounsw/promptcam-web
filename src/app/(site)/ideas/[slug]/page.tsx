import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getPublished, listPublished } from '@/lib/content';
import ScriptBody from './ScriptBody';
import ScriptGate from './ScriptGate';

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await listPublished()).map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // 服务端渲染永远按「没权限」取 —— 正文不进 HTML
  const idea = await getPublished(slug, false);
  if (!idea) return { title: '没找到 · Fordexa' };
  const url = `https://app.fordexa.com/ideas/${idea.slug}`;
  const description =
    idea.summary ?? `${idea.title} —— Fordexa 整理的口播选题，附参考出处。`;
  return {
    title: `${idea.title} · Fordexa 口播选题`,
    description,
    alternates: { canonical: url },
    openGraph: { title: idea.title, description, url, type: 'article' },
  };
}

export default async function IdeaPage({ params }: Props) {
  const { slug } = await params;
  /**
   * 这一页是静态生成 + ISR 的,所以**永远**按没权限渲染:
   * 正文一个字都不进 HTML,也就不可能被缓存成公开页面泄露出去。
   * 有权限的人由 ScriptGate 在浏览器里带着 token 去取。
   */
  const idea = await getPublished(slug, false);
  if (!idea) notFound();
  // 老链接(比如只有编号的 /ideas/fx-0007)永久跳到正式网址,搜索引擎只记一个
  if (idea.slug.toLowerCase() !== slug.toLowerCase()) permanentRedirect(`/ideas/${idea.slug}`);

  return (
    <main className="mx-auto max-w-2xl px-6 pb-24 pt-14">
      <Link
        href="/ideas"
        className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
      >
        ← 口播库
      </Link>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-[var(--row-line)] px-2.5 py-1 font-mono text-xs text-[var(--muted)]">
          {idea.code}
        </span>
        {idea.isFree && (
          <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white">
            免费样稿
          </span>
        )}
        {idea.industryName && (
          <Link
            href={`/ideas?industry=${encodeURIComponent(idea.industry ?? '')}`}
            className="rounded-full bg-[var(--accent-tint)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]"
          >
            {idea.industryName}
          </Link>
        )}
        {idea.tags.map((t) => (
          <Link
            key={t}
            href={`/ideas?tag=${encodeURIComponent(t)}`}
            className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {t}
          </Link>
        ))}
        {idea.publishedAt && (
          <span className="text-xs text-[var(--muted)]">
            {new Date(idea.publishedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        )}
      </div>

      <h1 className="font-display mt-4 text-balance text-3xl font-bold leading-[1.25] md:text-4xl">
        {idea.title}
      </h1>

      {idea.summary && (
        <p className="mt-6 text-lg leading-relaxed text-[var(--muted)]">{idea.summary}</p>
      )}

      {/* 免费样稿整篇进 HTML —— 这是故意的,让路人(和搜索引擎)看到稿子长什么样 */}
      {idea.isFree && idea.script ? (
        <ScriptBody script={idea.script} code={idea.code} badge="免费样稿" audioUrl={idea.audioUrl}>
          这条是公开的样稿。其他选题的完整口播稿给 Fordexa 的客户 ——
          <Link className="text-[var(--accent)] hover:underline" href="/login?next=%2Fideas">
            登录
          </Link>
          后可以申请开通。
        </ScriptBody>
      ) : (
        idea.hasScript && <ScriptGate slug={idea.slug} code={idea.code} />
      )}

      {idea.refs.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display mb-4 text-sm font-semibold tracking-wide text-[var(--muted)]">
            参考出处
          </h2>
          <ul className="space-y-2.5">
            {idea.refs.map((r, i) => (
              <li key={i} className="text-[15px] leading-relaxed">
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener nofollow"
                    className="text-[var(--accent)] hover:underline"
                  >
                    {r.label}
                  </a>
                ) : (
                  <span className="text-[var(--muted)]">{r.label}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-[var(--muted)]">
            出处公开是故意的 —— 你拿去讲之前应该能自己核一遍。
            内容仅供参考，不构成专业意见。
          </p>
        </section>
      )}
    </main>
  );
}
