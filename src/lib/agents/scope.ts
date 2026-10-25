import type { PromptStep } from '../prompt-pick.ts';

/**
 * Notion 提示词库的一行 → Supabase `prompts` 的一个范围。
 * 规则和 savePrompt 停用旧版一致：有公司的按 步骤 + 公司（不看行业），没公司的按 步骤 + 行业。
 * 不 import `@/`：本机脚本 scripts/agent-sync.mjs 直接用。
 */

export type Scope = { step: PromptStep; orgId: string | null; industry: string | null };

/** Notion 里的中文原值 */
export type NotionPromptMeta = { step: string; industry: string; company: string | null; status: string };

export type OrgRow = { id: string; name: string; industry: string | null };

export type ScopeResult =
  | { ok: true; scope: Scope; orgIndustry: string | null }
  | { ok: false; reason: string };

export const STEP_KEY: Record<string, PromptStep> = {
  精筛: 'screen',
  写文章: 'write_article',
  拆口播: 'split_scripts',
  写口播: 'write_script',
  数据选题: 'data_topics',
  做视频: 'make_video',
};

/** 通用 = 不限行业（null） */
export const INDUSTRY_KEY: Record<string, string | null> = {
  会计: 'accounting',
  移民留学: 'migration',
  贷款: 'mortgage',
  房产: 'property',
  律师: 'legal',
  数据: 'data',
  通用: null,
};

/** 停用的不推，返回 null */
export function statusKey(s: string): 'active' | 'draft' | null {
  if (s === '启用') return 'active';
  if (s === '草稿') return 'draft';
  return null;
}

export function resolveScope(meta: NotionPromptMeta, orgs: readonly OrgRow[]): ScopeResult {
  const step = STEP_KEY[meta.step];
  if (!step) return { ok: false, reason: `不认识的步骤「${meta.step}」` };

  const company = meta.company?.trim();
  if (company) {
    const hits = orgs.filter((o) => o.name === company);
    if (hits.length === 0) return { ok: false, reason: `找不到公司「${company}」（要和后台公司名一字不差）` };
    if (hits.length > 1) return { ok: false, reason: `公司名「${company}」不唯一，后台有 ${hits.length} 家同名` };
    return { ok: true, scope: { step, orgId: hits[0].id, industry: null }, orgIndustry: hits[0].industry };
  }

  if (!(meta.industry in INDUSTRY_KEY)) return { ok: false, reason: `不认识的行业「${meta.industry}」` };
  return { ok: true, scope: { step, orgId: null, industry: INDUSTRY_KEY[meta.industry] }, orgIndustry: null };
}
