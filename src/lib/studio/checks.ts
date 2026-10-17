import type { Claim } from './claims.ts';

/**
 * 一份稿子(或一版)的核对结果。稿子正文、每个版本都存一份,形状相同。
 *   figures      程序核对:依据材料里找不到的数字(原文片段)
 *   claims       AI 复核:找不到依据的句子;null = 还没跑或没跑成
 *   claimsFailed AI 复核这次没跑成(超时、返回不是 JSON),界面给「重试」
 *   truncated    文章太长,依据材料被截断过
 */
export type Checks = {
  figures: string[];
  claims: Claim[] | null;
  claimsFailed: boolean;
  truncated: boolean;
};

/** 要确认的处数:黄标的数字 + 黄标的句子 */
export function pendingCount(checks: Checks | null | undefined): number {
  if (!checks) return 0;
  return checks.figures.length + (checks.claims?.length ?? 0);
}

/** 生成稿的逐句复核还没跑成（没跑、跑到一半关了页面、失败）——不能显示成「核对过」 */
export function needsReview(checks: Checks | null | undefined): boolean {
  return Boolean(checks) && checks!.claims === null;
}
