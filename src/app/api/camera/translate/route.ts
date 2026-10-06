import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { configured, requestUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 20;

/**
 * 段落级英译中代理。客户端原本直连 Gemini（key 在二进制里），改走这里。
 * 失败一律返回非 200，客户端保持只显示原文。
 */
export async function POST(request: NextRequest) {
  const reply = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

  if (!configured) return reply({ error: 'Server not configured.' }, 503);
  if (!process.env.GEMINI_API_KEY) return reply({ error: 'Not configured.' }, 503);

  const user = await requestUser(request);
  if (!user) return reply({ error: 'Please sign in again.' }, 401);

  let text = '';
  try {
    const body = (await request.json()) as { text?: string };
    text = (body.text ?? '').trim();
  } catch {
    return reply({ error: 'Bad request.' }, 400);
  }
  // 上限防滥用：实时字幕是一段一段来的，正常不会超过这个长度
  if (!text || text.length > 2000) return reply({ error: 'Bad request.' }, 400);

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: text,
      config: {
        systemInstruction:
          '你是电话实时翻译。把用户消息翻译成简体中文，只输出译文，不要任何解释。保留人名、机构名、数字原样。',
      },
    });
    const out = res.text?.trim();
    if (!out) return reply({ error: 'Empty result.' }, 502);
    return reply({ text: out });
  } catch {
    return reply({ error: 'Translation unavailable.' }, 502);
  }
}
