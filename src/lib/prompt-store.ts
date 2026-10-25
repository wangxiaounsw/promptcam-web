import type { SupabaseClient } from '@supabase/supabase-js';
import type { PromptRow, PromptStep } from './prompt-pick.ts';

/**
 * 存一版提示词：同一范围（步骤 + 公司，或步骤 + 行业）里原来启用的改停用，再插一条新的。
 * 网站（savePrompt）和本机同步脚本（agents/sync）共用这一份，所以不 import `@/`，客户端由调用方传。
 */

export const PROMPT_COLUMNS = 'id, step, org_id, industry, name, status, body, note, created_at';

export type SavedPrompt = PromptRow & { note: string | null; created_at: string };

export type NewVersion = {
  step: PromptStep;
  orgId: string | null;
  industry: string | null;
  name: string;
  body: string;
  note: string | null;
  userId: string;
  /** 默认启用；草稿不动现有的启用版 */
  status?: 'active' | 'draft';
};

export async function saveVersion(db: SupabaseClient, v: NewVersion): Promise<SavedPrompt> {
  const status = v.status ?? 'active';
  if (status === 'active') {
    let off = db.from('prompts').update({ status: 'inactive' }).eq('step', v.step).eq('status', 'active');
    // 公司专属的只按公司停(公司换了行业也不会留下两条启用的);不限公司的按行业分
    if (v.orgId) off = off.eq('org_id', v.orgId);
    else off = (v.industry ? off.eq('industry', v.industry) : off.is('industry', null)).is('org_id', null);
    const { error } = await off;
    if (error) throw new Error(`「${v.name}」停用旧版失败：${error.message}`);
  }
  const { data, error } = await db
    .from('prompts')
    .insert({
      step: v.step,
      org_id: v.orgId,
      industry: v.industry,
      name: v.name,
      status,
      body: v.body,
      note: v.note,
      created_by: v.userId,
    })
    .select(PROMPT_COLUMNS)
    .single();
  if (error || !data) {
    const why = error?.message ?? '没有返回数据';
    throw new Error(
      status === 'active'
        ? `「${v.name}」停用了旧版但新版没写进去，这个范围现在没有启用的提示词：${why}`
        : `「${v.name}」草稿没写进去：${why}`,
    );
  }
  return data as SavedPrompt;
}
