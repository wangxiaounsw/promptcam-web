import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, loadProfile, missingEnv, requestUser } from '@/lib/auth';
import { transcribe } from '@/lib/transcribe';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** 16kHz × 16bit 单声道 = 32000 B/s。上限 65 秒，和客户端的录音上限对齐。 */
const BYTES_PER_SECOND = 32000;
const MAX_BYTES = BYTES_PER_SECOND * 65;

/**
 * 批量转写兜底：客户端实时转写失败时，把整段录音发到这里重试。
 * 按实际音频秒数扣配额（比 /session 那种按会话 180s 估算更准）。
 */
export async function POST(request: NextRequest) {
  const no = (body: object, status: number) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

  if (!configured) return no({ error: 'Server not configured.', missing: missingEnv() }, 503);
  if (!process.env.GEMINI_API_KEY) return no({ error: 'Voice not configured.' }, 503);

  const user = await requestUser(request);
  if (!user) return no({ error: 'Please sign in again.' }, 401);
  if (!request.headers.get('content-type')?.startsWith('application/octet-stream')) {
    return no({ error: 'Expected raw PCM.' }, 415);
  }

  const reader = request.body?.getReader();
  if (!reader) return no({ error: 'No audio received.' }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) {
        await reader.cancel();
        return no({ error: 'Recording longer than 60s, split it up.' }, 413);
      }
      chunks.push(value);
    }
  } catch {
    return no({ error: 'Could not read audio.' }, 400);
  }
  // 太短或者字节数不是偶数 → 不是合法的 16bit PCM
  if (length < 6400 || length % 2) return no({ error: 'Recording too short or invalid.' }, 400);

  const seconds = Math.ceil(length / BYTES_PER_SECOND);
  const profile = await loadProfile(user.id);
  const isClient = profile?.is_fordexa_client ?? false;
  const remaining = profile?.live_seconds_remaining ?? 0;
  if (!isClient && remaining < seconds) {
    return no({ error: 'Voice minutes used up.', code: 'no_credits', secondsRemaining: remaining }, 402);
  }

  try {
    const text = await transcribe(Buffer.concat(chunks));
    if (!text) return no({ error: 'Nothing recognised.' }, 502);
    let secondsRemaining: number | null = isClient ? null : remaining - seconds;
    if (!isClient) {
      try {
        await admin()
          .from('profiles')
          .update({ live_seconds_remaining: secondsRemaining })
          .eq('id', user.id);
      } catch {
        secondsRemaining = remaining;
      }
    }
    return no({ text, secondsRemaining }, 200);
  } catch {
    // 不扣费：录音在客户端还留着，可以再试
    return no({ error: 'Transcription failed, try again.' }, 502);
  }
}
