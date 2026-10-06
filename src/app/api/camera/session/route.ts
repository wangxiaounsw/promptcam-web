import { GoogleGenAI, Modality, AudioTranscriptionConfigMode } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, loadProfile, missingEnv, requestUser, SESSION_SECONDS } from '@/lib/auth';

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

  // fordexa 客户付的是服务费，不按秒卡；其余按配额。
  if (!isClient && remaining < SESSION_SECONDS) {
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

    // 非客户才扣。一枚令牌 = 一个会话 ≈ 3 分钟（客户端的轮换周期）。
    let secondsRemaining: number | null = isClient ? null : remaining - SESSION_SECONDS;
    if (!isClient) {
      try {
        await admin()
          .from('profiles')
          .update({ live_seconds_remaining: secondsRemaining })
          .eq('id', user.id);
      } catch {
        secondsRemaining = remaining; // 扣费失败不拦使用，下次再扣
      }
    }
    return reply({ token: token.name, secondsRemaining, isClient });
  } catch {
    return reply({ error: 'Live transcription unavailable, try again.' }, 502);
  }
}
