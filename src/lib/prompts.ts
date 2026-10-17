import { admin } from '@/lib/auth';
import { DEFAULT_PROMPT } from '@/lib/draft-prompt';
import { pickPrompt, type PromptRow, type PromptSource, type PromptStep } from '@/lib/prompt-pick';

/**
 * 提示词库（2026-10-17 从 Notion 搬进来，写口播这一步先搬）。
 * 一条 = 一个版本；保存 = 插一条新的启用、旧的改停用，所以表本身就是历史。
 * 网站后台「起草稿的提示词」、工作台「写稿提示词」读写的都是这里 —— 只有一份。
 */

export type ScriptPrompt = {
  prompt: string;
  promptId: string | null;
  name: string;
  source: PromptSource | 'default';
  samples: string | null;
};

const COLUMNS = 'id, step, org_id, industry, name, status, body, note, created_at';

export type PromptVersion = PromptRow & { note: string | null; created_at: string };

async function activeRows(step: PromptStep): Promise<PromptRow[]> {
  const { data } = await admin().from('prompts').select(COLUMNS).eq('step', step).eq('status', 'active');
  return (data ?? []) as PromptRow[];
}

/** 写口播用哪份：公司的 → 行业的 → 通用的 → 代码里的默认骨架 */
export async function scriptPrompt(orgId: string | null, industry?: string | null): Promise<ScriptPrompt> {
  const db = admin();
  const { data: org } = orgId
    ? await db.from('organizations').select('industry, style_samples').eq('id', orgId).maybeSingle()
    : { data: null };
  const samples = ((org?.style_samples as string | null) ?? '').trim() || null;
  const picked = pickPrompt(await activeRows('write_script'), 'write_script', {
    orgId,
    industry: industry ?? (org?.industry as string | null) ?? null,
  });
  if (!picked) return { prompt: DEFAULT_PROMPT, promptId: null, name: '默认骨架', source: 'default', samples };
  return { prompt: picked.row.body, promptId: picked.row.id, name: picked.row.name, source: picked.source, samples };
}

/** 存一版：同一范围（步骤 + 公司 + 行业）里原来启用的改停用，新的一条启用 */
export async function savePrompt(input: {
  step: PromptStep;
  orgId: string | null;
  industry: string | null;
  name: string;
  body: string;
  note: string | null;
  userId: string;
}): Promise<PromptVersion> {
  const db = admin();
  let off = db.from('prompts').update({ status: 'inactive' }).eq('step', input.step).eq('status', 'active');
  // 公司专属的只按公司停(公司换了行业也不会留下两条启用的);不限公司的按行业分
  if (input.orgId) off = off.eq('org_id', input.orgId);
  else off = (input.industry ? off.eq('industry', input.industry) : off.is('industry', null)).is('org_id', null);
  const { error: offErr } = await off;
  if (offErr) throw new Error('保存失败');
  const { data, error } = await db
    .from('prompts')
    .insert({
      step: input.step,
      org_id: input.orgId,
      industry: input.industry,
      name: input.name,
      status: 'active',
      body: input.body,
      note: input.note,
      created_by: input.userId,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error('保存失败');
  return data as PromptVersion;
}

/** 某个范围的历史版本，新的在前 */
export async function promptHistory(step: PromptStep, orgId: string | null, limit = 20): Promise<PromptVersion[]> {
  let q = admin().from('prompts').select(COLUMNS).eq('step', step);
  q = orgId ? q.eq('org_id', orgId) : q.is('org_id', null).is('industry', null);
  const { data } = await q.order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as PromptVersion[];
}
