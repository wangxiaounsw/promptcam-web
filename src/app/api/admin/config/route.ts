import { NextResponse } from 'next/server';
import { publishableKey, supabaseUrl } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * 把浏览器端登录需要的两个**公开**值吐给 /admin 页面。
 *
 * 为什么不用 NEXT_PUBLIC_ 变量：那需要把同一组值在 Vercel 配两遍
 * （一份给服务端、一份给浏览器），以后改了容易只改一半。
 * publishable key 设计上就是给浏览器用的（App 二进制里也带着它），
 * 通过接口给出来不增加任何暴露面。service key 当然不在这里。
 */
export async function GET() {
  return NextResponse.json(
    { url: supabaseUrl, key: publishableKey },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
