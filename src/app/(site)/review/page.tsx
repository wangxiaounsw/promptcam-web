import type { Metadata } from 'next';
import ReviewList from './ReviewList';

export const metadata: Metadata = {
  title: '待审稿 · Fordexa',
  robots: { index: false, follow: false },
};

/** 审稿列表:只有管理员能看,列表在浏览器里带 token 去取 */
export default function ReviewIndexPage() {
  return <ReviewList />;
}
