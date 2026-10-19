import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';
import { peopleById } from '@/lib/studio/server';

export const runtime = 'nodejs';

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Fordexa 稿占用:每个选题的 Fordexa 稿归哪家、谁哪天占的 */
export async function GET(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);
  const db = admin();
  const { data, error } = await db
    .from('fordexa_claims')
    .select('code, org_id, claimed_by, claimed_at')
    .order('claimed_at', { ascending: false });
  if (error) return no({ error: 'Load failed.' }, 502);
  const rows = data ?? [];
  const [{ data: orgs }, { data: ideas }, people] = await Promise.all([
    db.from('organizations').select('id, name'),
    rows.length ? db.from('idea_bank').select('code, title').in('code', rows.map((r) => r.code)) : Promise.resolve({ data: [] }),
    peopleById(rows.map((r) => r.claimed_by as string | null)),
  ]);
  const orgName = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));
  const title = new Map((ideas ?? []).map((i) => [i.code as string, i.title as string]));
  return no(
    {
      claims: rows.map((r) => ({
        code: r.code as string,
        title: title.get(r.code as string) ?? null,
        orgName: orgName.get(r.org_id as string) ?? null,
        claimedBy: r.claimed_by ? (people.get(r.claimed_by as string)?.name ?? null) : null,
        claimedAt: r.claimed_at as string,
      })),
    },
    200,
  );
}

/** 释放:这份 Fordexa 稿又能给别家用。已经拉走的稿子不动 */
export async function DELETE(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  const me = await requireAdmin(request);
  if (!me) return no({ error: 'Not authorised.' }, 403);
  const code = request.nextUrl.searchParams.get('code')?.trim();
  if (!code) return no({ error: 'Missing code.' }, 400);
  const { error } = await admin().from('fordexa_claims').delete().eq('code', code);
  if (error) return no({ error: 'Release failed.' }, 502);
  console.info('[claims] released', { code, by: me.id });
  return no({ ok: true }, 200);
}
