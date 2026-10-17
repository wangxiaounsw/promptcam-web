/**
 * DeepSeek 调用。写稿用它:中文口播的语感比 Gemini 顺,而且便宜很多。
 * 失败一律抛 Error,消息是给人看的中文;细节打到服务端日志。
 */
export type ChatOptions = {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
};

export const deepseekReady = (): boolean => Boolean(process.env.DEEPSEEK_API_KEY);

export async function chatDeepSeek(opts: ChatOptions): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY ?? '';
  if (!key) throw new Error('服务端没有配 DEEPSEEK_API_KEY。');
  let res: Response;
  try {
    res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 55_000),
    });
  } catch (e) {
    console.error('deepseek error', e);
    throw new Error('生成超时，稍后再试。');
  }
  if (!res.ok) {
    console.error('deepseek failed', res.status, await res.text().catch(() => ''));
    throw new Error('生成失败，稍后再试。');
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('没生成出内容，换个说法再试。');
  return text;
}
