import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { synthesize, ttsReady } from '@/lib/tts';
import { resolveVoice } from '@/lib/voice';
import { putPrivate, signedUrl } from '@/lib/studio/audio';
import { json, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VOICE_ID = /^[0-9a-f]{32}$/;
const TEST_LINE = '你好，这是我的声音。';

export async function GET(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  return json(await resolveVoice(user.id));
}

/** 填一个在 Fish 上训练好的声音 ID;null = 清掉,回落到公司/默认声音 */
export async function PUT(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let body: { voiceId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const raw = body.voiceId === null ? null : String(body.voiceId ?? '').trim().toLowerCase();
  if (raw !== null && !VOICE_ID.test(raw)) {
    return json({ error: '声音 ID 是 32 位字母数字，在 Fish 声音页面的网址里（modelId=后面那串）' }, 400);
  }
  const { error } = await admin().from('profiles').update({ voice_id: raw }).eq('id', user.id);
  if (error) return json({ error: '保存失败' }, 502);
  return json(await resolveVoice(user.id));
}

/** 用当前声音念一句试试 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);
  if (!ttsReady) return json({ error: 'FISH_API_KEY 没配' }, 503);
  try {
    const { voiceId } = await resolveVoice(user.id);
    const path = `audio/${user.id}/voice-test.mp3`;
    await putPrivate(path, await synthesize(TEST_LINE, voiceId), 'audio/mpeg');
    return json({ url: await signedUrl(path, 600) });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
