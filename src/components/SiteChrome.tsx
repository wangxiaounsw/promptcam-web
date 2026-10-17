import Link from 'next/link';
import MobileMenu from './MobileMenu';
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
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5 sm:h-16 sm:px-6">
        <Link href="/" className="font-display whitespace-nowrap text-[17px] font-bold tracking-tight">
          Fordexa <span className="text-[var(--accent)]">口播助手</span>
        </Link>
        {/* 手机上只留 Logo 和登录：390 宽下三个词会折行。口播库从首页和页脚都能进 */}
        <nav className="hidden items-center gap-5 text-[15px] sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <UserMenu />
        {/* 全站唯一的主动作:路人申请开通。客户下载 App 的入口在首页和 App Store,不占页头 */}
        <Link
          href="/apply"
          className="whitespace-nowrap rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          申请开通
        </Link>
        {/* 手机:导航、登录、管理员入口都收进三条杠 */}
        <MobileMenu />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--muted)]">
        {/* 品牌是 Fordexa,公司主体放后面小字,别让人觉得是两家 */}
        <p>
          © {new Date().getFullYear()}{' '}
          <a className="hover:text-[var(--ink)]" href="https://www.fordexa.com" target="_blank" rel="noopener">
            Fordexa
          </a>
          <span className="mx-2">·</span>
          AU GUIDE PTY LTD
        </p>
        <nav className="flex flex-wrap gap-6">
          <Link className="hover:text-[var(--ink)]" href="/how">怎么运作</Link>
          <Link className="hover:text-[var(--ink)]" href="/ideas">口播库</Link>
          <Link className="hover:text-[var(--ink)]" href="/apply">申请开通</Link>
          <Link className="hover:text-[var(--ink)]" href="/privacy">隐私政策</Link>
          <Link className="hover:text-[var(--ink)]" href="/terms">使用条款</Link>
          <a className="hover:text-[var(--ink)]" href="mailto:info@fordexa.com">联系</a>
        </nav>
      </div>
    </footer>
  );
}
