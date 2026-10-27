import { NextRequest, NextResponse } from 'next/server';
import { configured, requireAdmin } from '@/lib/auth';
import { getForReview } from '@/lib/content';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 审稿页取数:一篇文章 + 下面全部口播(含没发布的草稿),正文和试听都给。只给管理员。
 * GET /api/admin/review?key=fx-0028(编号或 slug)
 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const key = (request.nextUrl.searchParams.get('key') ?? '').trim().toLowerCase();
  // 进 PostgREST 的 or() 过滤串,只放编号 / slug 会用到的字符
  if (!/^[a-z0-9-]{1,160}$/.test(key)) return no({ error: 'Bad key.' }, 400);
  const idea = await getForReview(key);
  if (!idea) return no({ error: 'Not found.' }, 404);
  return no({ idea }, 200);
}
