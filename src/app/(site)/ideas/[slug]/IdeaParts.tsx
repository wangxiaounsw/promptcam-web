import Link from 'next/link';
import type { PublicIdea, Ref } from '@/lib/content';

/**
 * 文章页的页头(编号、行业、标签、发布时间、标题、摘要)和参考出处。
 * 公开页和审稿页共用,审稿时看到的就是上线后的样子。
 */
export function IdeaHeader({ idea }: { idea: PublicIdea }) {
  return (
    <>
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
            发布时间：
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
    </>
  );
}

export function RefList({ refs }: { refs: Ref[] }) {
  if (!refs.length) return null;
  return (
    <section className="mt-12">
      <h2 className="font-display mb-4 text-sm font-semibold tracking-wide text-[var(--muted)]">
        参考出处
      </h2>
      <ul className="space-y-2.5">
        {refs.map((r, i) => (
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
  );
}
