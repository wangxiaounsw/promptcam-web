/** 一行一个 JSON 的流（生成接口用它边写边推）。没收完整的最后一行留到下一包 */
export function readNdjson(buffer: string): { events: unknown[]; rest: string } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const events: unknown[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // 坏行跳过
    }
  }
  return { events, rest };
}
