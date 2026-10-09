import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fordexa 后台',
  // 后台不该被搜索引擎收录
  robots: { index: false, follow: false, nocache: true },
};

/**
 * 网站整体是浅色(和 App 一致),后台保留暗色 ——
 * 这是长时间盯着改稿子的地方,整页表单,浅色晃眼。
 * .admin-dark 在 globals.css 里把 CSS 变量换回暗色一套。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-dark">{children}</div>;
}
