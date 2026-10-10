import { NextRequest, NextResponse } from 'next/server';
import { accessFor, fetchPublishedRow, listPublished, rowToPublic } from '@/lib/content';

export const runtime = 'nodejs';

/**
 * 网站灵感库。
 *   /api/ideas            已发布列表(从不含正文)
 *   /api/ideas?slug=xxx   单篇;带 Bearer 且有权限时才含 script,
 *                         同时回访客状态(signedIn / allowed / pending)给页面选显示
 *
 * App 也可以用这个接口拿公开内容,不用再写一套。
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json(
      { ideas: await listPublished() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  // 权限和稿子并行取,互不依赖
  const [access, row] = await Promise.all([accessFor(request), fetchPublishedRow(slug)]);
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const idea = await rowToPublic(row, access.allowed);
  return NextResponse.json(
    {
      idea,
      allowed: access.allowed,
      signedIn: Boolean(access.user),
      pending: access.pending,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
