import { NextRequest, NextResponse } from 'next/server';
import { audioMapFor } from '@/lib/content';

export const runtime = 'nodejs';

/** 总览页试听:code → 音频链接。免费的都给;其余按权限。 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { audio: await audioMapFor(request) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
