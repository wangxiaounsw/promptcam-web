import { NextRequest, NextResponse } from 'next/server';
import { accessFor, getPublished, listPublished } from '@/lib/content';
import { requestUser } from '@/lib/auth';
import { ANON_LIMIT } from '@/lib/limits';

export const runtime = 'nodejs';

/**
 * 网站灵感库。
 *   /api/ideas            已发布列表(从不含正文)。没登录只给前 ANON_LIMIT 条,
 *                         带 total 告诉客户端一共多少 —— 「注册看全部」的门在服务端,App 不用改
 *   /api/ideas?slug=xxx   单篇;带 Bearer 且有权限时才含 script,
 *                         同时回访客状态(signedIn / allowed / pending)给页面选显示
 *
 * App 也可以用这个接口拿公开内容,不用再写一套。
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    const [all, user] = await Promise.all([listPublished(), requestUser(request)]);
    const ideas = user ? all : all.slice(0, ANON_LIMIT);
    return NextResponse.json(
      { ideas, total: all.length, limited: ideas.length < all.length, signedIn: Boolean(user) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  // 权限和稿子并行取,互不依赖
  // 单篇连同挂在下面的口播一起给(文章页用);App 和网站同一套
  const access = await accessFor(request);
  const idea = await getPublished(slug, access.allowed, access.viewer);
  if (!idea) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
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
