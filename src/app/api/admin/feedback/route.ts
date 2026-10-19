import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';
import { PRIVATE_BUCKET } from '@/lib/studio/audio';
import { peopleById } from '@/lib/studio/server';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** 工作台反馈列表。status=open(默认) / resolved / all;截图给 1 小时的签名链接 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const status = request.nextUrl.searchParams.get('status') ?? 'open';
  const db = admin();
  let q = db
    .from('bug_reports')
    .select('id, reporter_id, org_id, page_url, message, image_paths, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status === 'open' || status === 'resolved') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return no({ error: 'Load failed.' }, 502);
  const rows = data ?? [];

  const allPaths = rows.flatMap((r) => (r.image_paths as string[] | null) ?? []);
  const [people, { data: orgs }, signed] = await Promise.all([
    peopleById(rows.map((r) => r.reporter_id as string | null)),
    db.from('organizations').select('id, name'),
    allPaths.length
      ? db.storage.from(PRIVATE_BUCKET).createSignedUrls(allPaths, 3600).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);
  const url = new Map(signed.filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl]));
  const orgName = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));

  return no(
    {
      reports: rows.map((r) => ({
        id: r.id as string,
        reporterName: r.reporter_id ? (people.get(r.reporter_id as string)?.name ?? '未知') : '已删除的账号',
        orgName: r.org_id ? (orgName.get(r.org_id as string) ?? null) : null,
        pageUrl: (r.page_url as string | null) ?? null,
        message: r.message as string,
        status: r.status as 'open' | 'resolved',
        createdAt: r.created_at as string,
        imageUrls: ((r.image_paths as string[] | null) ?? []).map((p) => url.get(p)).filter((u): u is string => Boolean(u)),
      })),
    },
    200,
  );
}

/** 标已处理 / 重新打开 */
export async function PATCH(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  const me = await requireAdmin(request);
  if (!me) return no({ error: 'Not authorised.' }, 403);
  let body: { id?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const id = String(body.id ?? '');
  if (!id || (body.status !== 'open' && body.status !== 'resolved')) return no({ error: 'Bad request.' }, 400);
  const resolved = body.status === 'resolved';
  const { error } = await admin()
    .from('bug_reports')
    .update({
      status: body.status,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? me.id : null,
    })
    .eq('id', id);
  if (error) return no({ error: 'Update failed.' }, 502);
  return no({ ok: true }, 200);
}
