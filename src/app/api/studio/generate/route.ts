import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { streamDeepSeek } from '@/lib/deepseek';
import type { Checks } from '@/lib/studio/checks';
import { FACT_RULES } from '@/lib/studio/fact-rules';
import { unsupportedFigures } from '@/lib/studio/figures';
import { splitAppendix } from '@/lib/prompt-pick';
import { scriptPrompt } from '@/lib/prompts';
import {
  ensureFordexaVersion,
  json,
  nextVersionNumber,
  requireStudioUser,
  scriptInScope,
  sourceForScript,
} from '@/lib/studio/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT_LIMIT = 8000;

/**
 * 「按我的风格生成」一版。提示词可以就地改(只用于这一次,快照存进版本);
 * 固定事实规则永远拼在后面。数字核对当场做,AI 复核由前端拿到版本后另调 /review ——
 * 两次模型调用塞进一个请求会超过 60 秒。稿子是流式写出来的,前端边收边显示。
 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let body: { scriptId?: unknown; prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const script = await scriptInScope(user.orgId, String(body.scriptId ?? ''));
  if (!script) return json({ error: '找不到这条稿子' }, 404);
  if (!script.code) return json({ error: '这条不是从灵感库拉的，没有文章可依据' }, 400);

  // 三样互不依赖，一起查：数据库在悉尼，串着查每样多 200ms
  const [source, style] = await Promise.all([
    sourceForScript(script),
    scriptPrompt(user.orgId),
    ensureFordexaVersion(script),
  ]);
  if (!source) return json({ error: '找不到这条稿子对应的选题（可能已下架）' }, 404);
  const prompt =
    typeof body.prompt === 'string' && body.prompt.trim()
      ? body.prompt.trim().slice(0, PROMPT_LIMIT)
      : style.prompt;
  const samples = style.samples
    ? `下面是他们以前口播的文字稿，照着这个语感写：\n\n${style.samples}\n\n---\n\n`
    : '';

  // 流式返回:一行一个 JSON 事件。delta = 新写出的字;done = 存好的版本;error = 出错
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const { text: raw, finishReason } = await streamDeepSeek(
          {
            system: `${prompt}\n\n${FACT_RULES}`,
            user: `${samples}【依据材料】\n${source.text}`,
            temperature: 1.1,
            maxTokens: 2000,
          },
          (text) => send({ t: 'delta', text }),
        );
        // 王小墨这类提示词会在正文后附一张出处表:拆开,正文拿去念和核对
        const { body: draft, appendix } = splitAppendix(raw);
        const checks: Checks = {
          figures: unsupportedFigures(draft, source.text),
          claims: null,
          claimsFailed: false,
          truncated: source.truncated,
        };
        const version = await saveVersion(script.id, user.id, { body: draft, prompt, checks, appendix });
        send({ t: 'done', version, cut: finishReason === 'length' });
      } catch (e) {
        send({ t: 'error', error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** 存一版。连点两次会算出同一个 n、撞唯一约束:重新取号再试一次 */
async function saveVersion(
  scriptId: string,
  userId: string,
  v: { body: string; prompt: string; checks: Checks; appendix: string | null },
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await admin()
      .from('script_versions')
      .insert({ script_id: scriptId, user_id: userId, kind: 'generated', n: await nextVersionNumber(scriptId), ...v })
      .select('id, kind, n, body, prompt, checks, appendix, created_at')
      .single();
    if (data) return data;
    if (error?.code !== '23505') break;
  }
  throw new Error('保存这一版失败，再点一次');
}
