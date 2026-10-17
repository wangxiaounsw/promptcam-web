import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';
import { DEFAULT_PROMPT } from '@/lib/draft-prompt';
import { chatDeepSeek, deepseekReady } from '@/lib/deepseek';
import { scriptPrompt } from '@/lib/prompts';

export const runtime = 'nodejs';
export const maxDuration = 60;

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });


/**
 * 用 AI 起一个口播稿草稿。
 *
 * 这是**草稿**，不是成品 —— 后台生成完直接填进编辑框，由 Shawn 改完再发。
 * 所以这里不做任何自动发布，也不写库。
 */
/** 提示词库里挑:这家公司的 → 这个行业的 → 通用的。读失败退回默认 —— 不能因此写不了稿。 */
async function loadPrompt(orgId: string | null, industry: string | null): Promise<string> {
  try {
    return (await scriptPrompt(orgId, industry)).prompt;
  } catch {
    return DEFAULT_PROMPT;
  }
}

export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  // 写稿用 DeepSeek:中文口播的语感比 Gemini 顺,而且便宜很多。
  // Gemini 继续只管语音转写那一摊。
  if (!deepseekReady()) return no({ error: '服务端没有配 DEEPSEEK_API_KEY。' }, 503);

  let body: { title?: string; orgId?: string; industry?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const title = (body.title ?? '').trim();
  if (!title) return no({ error: '先填选题标题。' }, 400);

  const db = admin();

  // 这家公司的风格。没挑公司就只用通用骨架。
  let style = '';
  if (body.orgId) {
    const { data: org } = await db
      .from('organizations')
      .select('name, style_prompt, style_samples')
      .eq('id', body.orgId)
      .maybeSingle();
    if (org) {
      const bits: string[] = [];
      if (org.style_prompt) bits.push(`这条是给「${org.name}」写的。他们的风格：\n${org.style_prompt}`);
      if (org.style_samples) {
        // 样本比形容词准：「专业但不端着」各人理解不同，一段真实口播没有歧义
        bits.push(`下面是他们以前口播的文字稿，照着这个语感写：\n\n${org.style_samples}`);
      }
      style = bits.join('\n\n');
    }
  }

  let industryLine = '';
  if (body.industry) {
    const { data: ind } = await db
      .from('industries')
      .select('name_zh')
      .eq('key', body.industry)
      .maybeSingle();
    if (ind?.name_zh) industryLine = `行业：${ind.name_zh}。`;
  }

  const prompt = [
    style,
    `${industryLine}选题：${title}`,
    body.note?.trim() ? `补充要求：${body.note.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');

  try {
    const text = await chatDeepSeek({
      system: await loadPrompt(body.orgId ?? null, body.industry ?? null),
      user: prompt,
      // 口播要有人味,温度给高一点;但别太高,免得编出不存在的规定
      temperature: 1.1,
      maxTokens: 2000,
    });
    return no({ draft: text }, 200);
  } catch (e) {
    const message = (e as Error).message;
    return no({ error: message }, message.includes('超时') ? 504 : 502);
  }
}
