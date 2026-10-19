import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { admin, configured, requestUser } from '@/lib/auth';
import { avatarUrl } from '@/lib/avatar';
import { canEnterStudio } from '@/lib/studio/scope';

export const runtime = 'nodejs';

/**
 * 页头要的登录态:是不是管理员、能不能进工作台、名字和头像。
 * 只决定「显不显示入口」,真正的权限在各个接口上查。
 */
export async function GET(request: NextRequest) {
  const no = (body: object, status: number) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  const user = await requestUser(request);
  if (!user) return no({ error: 'Not signed in.' }, 401);
  const { data } = await admin()
    .from('profiles')
    .select('is_admin, display_name, avatar_path, organizations(is_active)')
    .eq('id', user.id)
    .maybeSingle();
  const org = data?.organizations as { is_active: boolean } | { is_active: boolean }[] | null | undefined;
  const ownOrgActive = Array.isArray(org) ? Boolean(org[0]?.is_active) : Boolean(org?.is_active);
  const isAdmin = Boolean(data?.is_admin);
  return no(
    {
      isAdmin,
      canStudio: canEnterStudio({ isAdmin, ownOrgActive }),
      name: ((data?.display_name as string | null) ?? '').trim() || user.email.split('@')[0],
      avatarUrl: avatarUrl((data?.avatar_path as string | null) ?? null),
    },
    200,
  );
}
