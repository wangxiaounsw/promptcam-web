import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { synthesize, ttsReady } from '@/lib/tts';
import { resolveStudioVoice } from '@/lib/voice';
import { existsPrivate, putPrivate, removePrivate, signedUrl } from '@/lib/studio/audio';
import { orgAudioDir, previewHash, previewPathAllowed } from '@/lib/studio/preview';
import { json, requireStudioUser, scriptInScope, versionInScope } from '@/lib/studio/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 试听。念稿子正文(scriptId)或某一版(versionId)。
 * 正文没改过就直接给上次那份的链接,不再调 Fish —— 省额度;force 强制重念。
 * peek:只问有没有现成的,没有就回 url: null,不念 —— 稿子页打开时用,念不念由人点。
 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!ttsReady) return json({ error: 'FISH_API_KEY 没配' }, 503);

  let body: { scriptId?: unknown; versionId?: unknown; force?: unknown; peek?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const peek = body.peek === true;
  const force = !peek && body.force === true;
  const { voiceId } = await resolveStudioVoice(user);

  try {
    if (body.versionId) {
      const found = await versionInScope(user.orgId, String(body.versionId));
      if (!found) return json({ error: '找不到这一版' }, 404);
      const v = found.version;
      // 版本不会再改:文件名 = 版本 + 声音,换了声音自然重念;force 强制重念。同公司的人共用一份
      const path = `${orgAudioDir(found.script.org_id!)}/v-${v.id}-${voiceId}.mp3`;
      const exists = await existsPrivate(path);
      if (peek) return json({ url: exists ? await signedUrl(path) : null });
      if (force || !exists) {
        await putPrivate(path, await synthesize(v.body, voiceId), 'audio/mpeg');
      }
      return json({ url: await signedUrl(path) });
    }

    const script = await scriptInScope(user.orgId, String(body.scriptId ?? ''));
    if (!script) return json({ error: '找不到这条稿子' }, 404);
    const hash = previewHash(script.body, voiceId);
    // audio_path 能从 App 改:不是这家公司(或主人旧目录)下的一律当没有,既不签名也不删
    const ownPath = previewPathAllowed(script.audio_path, { orgId: script.org_id, ownerId: script.user_id })
      ? script.audio_path
      : null;
    const current = ownPath !== null && script.audio_hash === hash;
    if (peek) return json({ url: current ? await signedUrl(ownPath) : null });
    if (!force && current) {
      return json({ url: await signedUrl(ownPath), reused: true });
    }
    const path = `${orgAudioDir(script.org_id!)}/${script.id}-${randomBytes(6).toString('hex')}.mp3`;
    await putPrivate(path, await synthesize(script.body, voiceId), 'audio/mpeg');
    const { error } = await admin()
      .from('scripts')
      .update({ audio_path: path, audio_hash: hash, audio_at: new Date().toISOString(), edited_by: user.id })
      .eq('id', script.id)
      .eq('org_id', script.org_id);
    if (error) return json({ error: '保存音频失败' }, 502);
    if (ownPath) await removePrivate([ownPath]);
    return json({ url: await signedUrl(path) });
  } catch (e) {
    console.error('studio audio', (e as Error).message);
    return json({ error: (e as Error).message }, 502);
  }
}
