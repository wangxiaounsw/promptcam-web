import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fordexa 后台',
  // 后台不该被搜索引擎收录
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
