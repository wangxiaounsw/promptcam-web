import { NextRequest, NextResponse } from 'next/server';
import { configured, requireAdmin } from '@/lib/auth';
import { listForReview } from '@/lib/content';
import { listFactCodes } from '@/lib/review-facts';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 审稿列表:还没发布的文章 / 口播,每篇带有没有事实核对。只给管理员。
 * GET /api/admin/review/list
 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const [items, factCodes] = await Promise.all([listForReview(), listFactCodes()]);
  return no({ items: items.map((i) => ({ ...i, hasFacts: factCodes.has(i.code) })) }, 200);
}
