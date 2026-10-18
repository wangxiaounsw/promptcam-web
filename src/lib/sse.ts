/**
 * DeepSeek（OpenAI 兼容）流式返回的 SSE 解析。网络包会把一个事件切成两半，
 * 所以每次只吃完整的事件（以空行结尾），没吃完的留在 rest 里，和下一包拼起来再解析。
 */
export type SseRead = { deltas: string[]; rest: string; done: boolean; finishReason: string | null };

export function readSse(buffer: string): SseRead {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  const deltas: string[] = [];
  let done = false;
  let finishReason: string | null = null;
  for (const part of parts) {
    for (const line of part.split('\n')) {
      if (!line.startsWith('data:')) continue; // 注释行（: keep-alive）和别的字段不管
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        done = true;
        continue;
      }
      try {
        const data = JSON.parse(payload) as { choices?: { delta?: { content?: string }; finish_reason?: string | null }[] };
        const choice = data.choices?.[0];
        if (choice?.delta?.content) deltas.push(choice.delta.content);
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      } catch {
        // 半截 JSON 不会出现在完整事件里；真坏了就跳过这一行
      }
    }
  }
  return { deltas, rest, done, finishReason };
}
