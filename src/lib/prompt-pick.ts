/**
 * 提示词库的挑选规则（纯函数，和 Notion 库原来的规矩一样）：
 * 同一步里，本公司启用的 → 本行业启用的（不限公司）→ 通用启用的。草稿和停用的永远不选。
 */
export type PromptStep = 'screen' | 'write_article' | 'split_scripts' | 'write_script' | 'data_topics' | 'make_video';
export type PromptStatus = 'active' | 'inactive' | 'draft';
export type PromptSource = 'org' | 'industry' | 'general';

export type PromptRow = {
  id: string;
  step: PromptStep;
  org_id: string | null;
  industry: string | null;
  name: string;
  status: PromptStatus;
  body: string;
};

export function pickPrompt<T extends PromptRow>(
  rows: T[],
  step: PromptStep,
  scope: { orgId: string | null; industry: string | null },
): { row: T; source: PromptSource } | null {
  const live = rows.filter((r) => r.step === step && r.status === 'active');
  const org = scope.orgId ? live.find((r) => r.org_id === scope.orgId) : undefined;
  if (org) return { row: org, source: 'org' };
  const industry = scope.industry ? live.find((r) => !r.org_id && r.industry === scope.industry) : undefined;
  if (industry) return { row: industry, source: 'industry' };
  const general = live.find((r) => !r.org_id && !r.industry);
  return general ? { row: general, source: 'general' } : null;
}

/**
 * 有的提示词要求正文后面跟一张出处表，用单独一行 --- 隔开。
 * 拆开存：正文拿去念、去核对，出处表只给人看（不然 TTS 会把表也念出来）。
 */
export function splitAppendix(text: string): { body: string; appendix: string | null } {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.trim() === '---');
  if (at < 0) return { body: text.trim(), appendix: null };
  const appendix = lines.slice(at + 1).join('\n').trim();
  return { body: lines.slice(0, at).join('\n').trim(), appendix: appendix || null };
}
