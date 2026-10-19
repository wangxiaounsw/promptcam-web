import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { json, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';

/** 灵感库要标的占用状态:ours = 在这家的口播库里;taken = Fordexa 稿已被别家用了 */
export async function GET(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  const { data, error } = await admin().from('fordexa_claims').select('code, org_id');
  if (error) return json({ error: '读取失败' }, 502);
  const claims: Record<string, 'ours' | 'taken'> = {};
  for (const c of data ?? []) claims[c.code as string] = c.org_id === user.orgId ? 'ours' : 'taken';
  return json({ claims });
}
