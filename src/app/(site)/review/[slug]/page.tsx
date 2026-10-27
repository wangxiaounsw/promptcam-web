import type { Metadata } from 'next';
import ReviewView from './ReviewView';

export const metadata: Metadata = {
  title: '审稿 · Fordexa',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ slug: string }> };

/** 审稿页:只有管理员能看,内容在浏览器里带 token 去取,HTML 里什么都没有 */
export default async function ReviewPage({ params }: Props) {
  const { slug } = await params;
  return <ReviewView slug={slug} />;
}
