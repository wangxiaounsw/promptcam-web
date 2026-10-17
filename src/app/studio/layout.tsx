import type { Metadata } from 'next';
import StudioShell from './StudioShell';

export const metadata: Metadata = {
  title: '口播工作台',
  // 工作台是登录后的私人页面,不该被收录
  robots: { index: false, follow: false, nocache: true },
};

/**
 * 口播工作台:排期、改稿、试听。浅色,照 App 的设计规范(prompter/docs/redesign),
 * 以后搬进 App 不用重新设计。不套网站的页头页脚。
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <StudioShell>{children}</StudioShell>;
}
