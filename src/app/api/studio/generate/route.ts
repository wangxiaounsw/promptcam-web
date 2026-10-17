import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { chatDeepSeek } from '@/lib/deepseek';
import type { Checks } from '@/lib/studio/checks';
import { FACT_RULES } from '@/lib/studio/fact-rules';
import { unsupportedFigures } from '@/lib/studio/figures';
import { splitAppendix } from '@/lib/prompt-pick';
import { scriptPrompt } from '@/lib/prompts';
import {
  ensureFordexaVersion,
  json,
  nextVersionNumber,
  ownScript,
  requireStudioUser,
  sourceForScript,
} from '@/lib/studio/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT_LIMIT = 8000;

/**
 * 「按我的风格生成」一版。提示词可以就地改(只用于这一次,快照存进版本);
 * 固定事实规则永远拼在后面。数字核对当场做,AI 复核由前端拿到版本后另调 /review ——
 * 两次模型调用塞进一个请求会超过 60 秒。
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
  const script = await ownScript(user.id, String(body.scriptId ?? ''));
  if (!script) return json({ error: '找不到这条稿子' }, 404);
  if (!script.code) return json({ error: '这条不是从灵感库拉的，没有文章可依据' }, 400);

  const source = await sourceForScript(script);
  if (!source) return json({ error: '找不到这条稿子对应的选题（可能已下架）' }, 404);
  await ensureFordexaVersion(script);

  const style = await scriptPrompt(user.orgId);
  const prompt =
    typeof body.prompt === 'string' && body.prompt.trim()
      ? body.prompt.trim().slice(0, PROMPT_LIMIT)
      : style.prompt;
  const samples = style.samples
    ? `下面是他们以前口播的文字稿，照着这个语感写：\n\n${style.samples}\n\n---\n\n`
    : '';

  let raw: string;
  try {
    raw = await chatDeepSeek({
      system: `${prompt}\n\n${FACT_RULES}`,
      user: `${samples}【依据材料】\n${source.text}`,
      temperature: 1.1,
      maxTokens: 2000,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
  // 王小墨这类提示词会在正文后附一张出处表:拆开,正文拿去念和核对
  const { body: draft, appendix } = splitAppendix(raw);

  const checks: Checks = {
    figures: unsupportedFigures(draft, source.text),
    claims: null,
    claimsFailed: false,
    truncated: source.truncated,
  };
  const { data: version, error } = await admin()
    .from('script_versions')
    .insert({
      script_id: script.id,
      user_id: user.id,
      kind: 'generated',
      n: await nextVersionNumber(script.id),
      body: draft,
      prompt,
      checks,
      appendix,
    })
    .select('id, kind, n, body, prompt, checks, appendix, created_at')
    .single();
  if (error || !version) return json({ error: '保存这一版失败，再点一次' }, 502);
  return json({ version });
}
