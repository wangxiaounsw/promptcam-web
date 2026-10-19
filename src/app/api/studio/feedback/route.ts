import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { FEEDBACK_LIMITS, feedbackImageExt, validateFeedback } from '@/lib/feedback';
import { mailBugReport, type Attachment } from '@/lib/mail';
import { PRIVATE_BUCKET } from '@/lib/studio/audio';
import { json, peopleById, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * 反馈问题:描述 + 截图(multipart)。存表、截图进私有桶,再发邮件给 Fordexa。
 * 发信必须 await:Vercel 函数返回后会被冻结,不等的话邮件发不出去(laurelint 踩过)。
 * 发信失败不算提交失败 —— 后台反馈页里照样看得到。
 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const message = String(form.get('message') ?? '').trim();
  const pageUrl = String(form.get('pageUrl') ?? '').trim().slice(0, 500) || null;
  const files = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  const invalid = validateFeedback({ message, images: files.map((f) => ({ type: f.type, size: f.size })) });
  if (invalid) return json({ error: invalid }, 400);

  const db = admin();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db
    .from('bug_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', user.id)
    .gte('created_at', since);
  if ((count ?? 0) >= FEEDBACK_LIMITS.perHour) return json({ error: '提交太频繁了，过一会儿再试' }, 429);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const paths: string[] = [];
  const attachments: Attachment[] = [];
  for (const [i, f] of files.entries()) {
    const ext = feedbackImageExt(f.type);
    const buf = Buffer.from(await f.arrayBuffer());
    const path = `bugs/${user.id}/${stamp}_${i + 1}.${ext}`;
    const { error } = await db.storage.from(PRIVATE_BUCKET).upload(path, buf, { contentType: f.type, upsert: false });
    if (error) return json({ error: '截图上传失败，再试一次' }, 502);
    paths.push(path);
    attachments.push({ filename: `截图${i + 1}.${ext}`, content: buf });
  }

  const { error } = await db.from('bug_reports').insert({
    reporter_id: user.id,
    org_id: user.orgId,
    page_url: pageUrl,
    message,
    image_paths: paths.length ? paths : null,
  });
  if (error) return json({ error: '提交失败，再试一次' }, 502);

  const [people, org] = await Promise.all([
    peopleById([user.id]),
    user.orgId
      ? db.from('organizations').select('name').eq('id', user.orgId).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);
  const sent = await mailBugReport({
    reporterName: people.get(user.id)?.name ?? user.email,
    reporterEmail: user.email,
    orgName: (org?.name as string | undefined) ?? null,
    pageUrl,
    message,
    attachments,
  });
  if (!sent) console.warn('[feedback] mail not sent (mail not configured or failed)');
  return json({ ok: true });
}
