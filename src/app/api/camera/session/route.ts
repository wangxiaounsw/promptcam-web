import { GoogleGenAI, Modality, AudioTranscriptionConfigMode } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { configured, loadProfile, missingEnv, requestUser, SESSION_MIN_SECONDS } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * 发一枚 Gemini Live 的**一次性**临时令牌。
 *
 * 为什么存在：Gemini key 绝不能进客户端。Prompt Cam 1.0 把 key 编进了二进制并于
 * 2026-09-02 上架，等同公开泄露；这个端点就是用来终结那个做法的。
 *
 * 客户端拿到 token 后连 .BidiGenerateContentConstrained（注意是 Constrained
 * 变体，普通 BidiGenerateContent 不接受临时令牌），且 setup 只能发 model ——
 * responseModalities / inputAudioTranscription 在这里锁定，客户端改不了。
 */
export async function POST(request: NextRequest) {
  const reply = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

  if (!configured) return reply({ error: 'Server not configured.', missing: missingEnv() }, 503);
  if (!process.env.GEMINI_API_KEY) return reply({ error: 'Voice not configured.', missing: missingEnv() }, 503);

  const user = await requestUser(request);
  if (!user) return reply({ error: 'Please sign in again.' }, 401);

  const profile = await loadProfile(user.id);
  // 档案缺失按**非客户**处理：默认值搞反等于白送（Diting 踩过这个坑）
  const isClient = profile?.is_fordexa_client ?? false;
  const remaining = profile?.live_seconds_remaining ?? 0;

  // fordexa 客户付的是服务费，不按秒卡；其余只做一个低门槛。
  // 这里**不扣费** —— 令牌可能只用 5 秒也可能用满 3 分钟，预扣必然错，
  // 而预扣 180s 会让 300s 的免费额度只够一次会话（原来的 bug）。
  if (!isClient && remaining < SESSION_MIN_SECONDS) {
    return reply(
      { error: 'Voice minutes used up.', code: 'no_credits', secondsRemaining: remaining },
      402,
    );
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: 'v1alpha', timeout: 15000 },
    });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 120_000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 30_000).toISOString(),
        liveConnectConstraints: {
          model: 'gemini-3.5-transcribe-live',
          config: {
            responseModalities: [Modality.TEXT],
            inputAudioTranscription: { mode: AudioTranscriptionConfigMode.SMART },
          },
        },
      },
    });
    if (!token.name) throw new Error('Missing token');

    return reply({
      token: token.name,
      secondsRemaining: isClient ? null : remaining,
      isClient,
    });
  } catch {
    return reply({ error: 'Live transcription unavailable, try again.' }, 502);
  }
}
