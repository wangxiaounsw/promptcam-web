import Link from 'next/link';
import UserMenu from './UserMenu';

const NAV = [
  { href: '/how', label: '怎么运作' },
  { href: '/ideas', label: '口播库' },
];

/**
 * 全站头尾。只套在 (site) 这个路由组上 —— /admin 有自己的外壳,
 * 它是内部工具,不该顶着对外的导航条。
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="font-display text-[17px] font-bold tracking-tight">
          Fordexa <span className="text-[var(--accent)]">口播助手</span>
        </Link>
        <nav className="flex items-center gap-5 text-[15px]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <UserMenu />
        <a
          href="https://apps.apple.com/au/app/prompt-cam/id6805019682"
          className="hidden rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:inline-block"
        >
          下载 App
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--muted)]">
        <p>
          © {new Date().getFullYear()} AU GUIDE PTY LTD
          <span className="mx-2">·</span>
          <a
            className="hover:text-[var(--ink)]"
            href="https://www.fordexa.com"
            target="_blank"
            rel="noopener"
          >
            Powered by Fordexa
          </a>
        </p>
        <nav className="flex flex-wrap gap-6">
          <Link className="hover:text-[var(--ink)]" href="/how">怎么运作</Link>
          <Link className="hover:text-[var(--ink)]" href="/ideas">口播库</Link>
          <Link className="hover:text-[var(--ink)]" href="/privacy">隐私政策</Link>
          <Link className="hover:text-[var(--ink)]" href="/terms">使用条款</Link>
          <a className="hover:text-[var(--ink)]" href="mailto:info@fordexa.com">联系</a>
        </nav>
      </div>
    </footer>
  );
}
