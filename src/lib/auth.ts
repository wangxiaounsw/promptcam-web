import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export const supabaseUrl = process.env.SUPABASE_URL ?? '';
export const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
export const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? '';
export const configured = Boolean(supabaseUrl && publishableKey && serviceKey);

/**
 * 哪些环境变量还没配上。只回变量名、绝不回值 ——
 * 否则排查一个 503 要靠反复猜「是没 redeploy 还是名字拼错了」。
 * Vercel 的环境变量改动不会套到已有部署，必须重新部署才生效。
 */
export function missingEnv(): string[] {
  return [
    ['SUPABASE_URL', supabaseUrl],
    ['SUPABASE_PUBLISHABLE_KEY', publishableKey],
    ['SUPABASE_SERVICE_KEY', serviceKey],
    ['GEMINI_API_KEY', process.env.GEMINI_API_KEY ?? ''],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k as string);
}

/** 一枚临时令牌≈一个 Live 会话。客户端每 3 分钟主动轮换，所以按 180s 计量。 */
export const SESSION_SECONDS = 180;

/** 绕过 RLS：profiles 只能由服务端写（否则客户能自己改 is_fordexa_client 提权）。 */
export function admin(): SupabaseClient {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 只认 Bearer：Prompt Cam 是原生 App，没有浏览器会话，
 * 所以不需要 cookie 路径和 Origin 检查（token 本身就是凭据）。
 */
export async function requestUser(
  request: NextRequest,
): Promise<{ id: string } | null> {
  if (!configured) return null;
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

export type Profile = {
  is_fordexa_client: boolean;
  live_seconds_remaining: number;
};

/** 后台鉴权。is_admin 和 is_fordexa_client 一样只由服务端写 —— profiles
 *  对客户端是只读的，否则任何客户都能把自己变成管理员。 */
export async function requireAdmin(
  request: NextRequest,
): Promise<{ id: string } | null> {
  const user = await requestUser(request);
  if (!user) return null;
  const { data, error } = await admin()
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data?.is_admin) return null;
  return user;
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await admin()
    .from('profiles')
    .select('is_fordexa_client, live_seconds_remaining')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}
