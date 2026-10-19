import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { resolveStudioVoice } from '@/lib/voice';
import { copyPrivate, existsPrivate, removePrivate } from '@/lib/studio/audio';
import { orgAudioDir, previewHash, previewPathAllowed } from '@/lib/studio/preview';
import {
  ensureFordexaVersion,
  json,
  requireStudioUser,
  scriptInScope,
  versionInScope,
  type StudioUser,
} from '@/lib/studio/server';

export const runtime = 'nodejs';

/** 一条稿子的全部版本:Fordexa 原版(n=0)+ 生成的第 1、2、3… 版 */
export async function GET(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  const script = await scriptInScope(user.orgId, request.nextUrl.searchParams.get('scriptId') ?? '');
  if (!script) return json({ error: '找不到这条稿子' }, 404);

  await ensureFordexaVersion(script);
  const { data, error } = await admin()
    .from('script_versions')
    .select('id, kind, n, body, prompt, checks, appendix, created_at')
    .eq('script_id', script.id)
    .order('n');
  if (error) return json({ error: '读取失败' }, 502);
  return json({ versions: data ?? [] });
}

/** 「用这版」:把这一版设成稿子正文。App 读到的、试听念的都是正文 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let body: { versionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const found = await versionInScope(user.orgId, String(body.versionId ?? ''));
  if (!found) return json({ error: '找不到这一版' }, 404);
  const { version, script } = found;

  // 这一版已经用当前声音念好了：直接拷成正文的试听，省一次合成
  const audio = await adoptVersionAudio(user, { id: script.id, orgId: script.org_id! }, version);
  const { error } = await admin()
    .from('scripts')
    .update({
      body: version.body,
      checks: version.checks ?? null,
      edited_by: user.id,
      ...(audio ? { ...audio, audio_at: new Date().toISOString() } : {}),
    })
    .eq('id', script.id)
    .eq('org_id', script.org_id);
  if (error) return json({ error: '保存失败' }, 502);
  if (audio && previewPathAllowed(script.audio_path, { orgId: script.org_id, ownerId: script.user_id })) {
    await removePrivate([script.audio_path!]);
  }
  return json({ ok: true, audioReady: Boolean(audio) });
}

async function adoptVersionAudio(
  user: StudioUser,
  script: { id: string; orgId: string },
  version: { id: string; body: string },
): Promise<{ audio_path: string; audio_hash: string } | null> {
  const { voiceId } = await resolveStudioVoice(user);
  const dir = orgAudioDir(script.orgId);
  const from = `${dir}/v-${version.id}-${voiceId}.mp3`;
  if (!(await existsPrivate(from))) return null;
  const to = `${dir}/${script.id}-${randomBytes(6).toString('hex')}.mp3`;
  if (!(await copyPrivate(from, to))) return null;
  return { audio_path: to, audio_hash: previewHash(version.body, voiceId) };
}
