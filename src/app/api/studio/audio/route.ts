import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { synthesize, ttsReady } from '@/lib/tts';
import { resolveVoice } from '@/lib/voice';
import { existsPrivate, putPrivate, removePrivate, signedUrl } from '@/lib/studio/audio';
import { ownsPreviewPath, previewHash } from '@/lib/studio/preview';
import { json, ownScript, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 试听。念稿子正文(scriptId)或某一版(versionId)。
 * 正文没改过就直接给上次那份的链接,不再调 Fish —— 省额度;force 强制重念。
 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!ttsReady) return json({ error: 'FISH_API_KEY 没配' }, 503);

  let body: { scriptId?: unknown; versionId?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const force = body.force === true;
  const { voiceId } = await resolveVoice(user.id);

  try {
    if (body.versionId) {
      const { data: v } = await admin()
        .from('script_versions')
        .select('id, body')
        .eq('id', String(body.versionId))
        .eq('user_id', user.id)
        .maybeSingle();
      if (!v) return json({ error: '找不到这一版' }, 404);
      // 版本不会再改:文件名 = 版本 + 声音,换了声音自然重念;force 强制重念
      const path = `audio/${user.id}/v-${v.id}-${voiceId}.mp3`;
      if (force || !(await existsPrivate(path))) {
        await putPrivate(path, await synthesize(v.body, voiceId), 'audio/mpeg');
      }
      return json({ url: await signedUrl(path) });
    }

    const script = await ownScript(user.id, String(body.scriptId ?? ''));
    if (!script) return json({ error: '找不到这条稿子' }, 404);
    const hash = previewHash(script.body, voiceId);
    // audio_path 本人能从 App 改:不是自己目录下的一律当没有,既不签名也不删
    const ownPath = ownsPreviewPath(script.audio_path, user.id) ? script.audio_path : null;
    if (!force && ownPath && script.audio_hash === hash) {
      return json({ url: await signedUrl(ownPath), reused: true });
    }
    const path = `audio/${user.id}/${script.id}-${randomBytes(6).toString('hex')}.mp3`;
    await putPrivate(path, await synthesize(script.body, voiceId), 'audio/mpeg');
    const { error } = await admin()
      .from('scripts')
      .update({ audio_path: path, audio_hash: hash, audio_at: new Date().toISOString() })
      .eq('id', script.id)
      .eq('user_id', user.id);
    if (error) return json({ error: '保存音频失败' }, 502);
    if (ownPath) await removePrivate([ownPath]);
    return json({ url: await signedUrl(path) });
  } catch (e) {
    console.error('studio audio', (e as Error).message);
    return json({ error: (e as Error).message }, 502);
  }
}
