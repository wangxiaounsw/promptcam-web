/**
 * AI 逐句复核：生成完后再调一次模型，把「依据材料里找不到依据」的句子挑出来标黄。
 * 拦的是数字核对拦不住的那种编造（「必须有雇主担保」）。只提示，不保证找全。
 * 复核提示词固定在这里，不受任何可编辑提示词影响。
 */
export const CLAIM_REVIEW_PROMPT = `你是事实核对员。下面给你一段「口播稿」和它的「依据材料」（选题、Fordexa 原稿、文章正文、出处列表）。

逐句检查口播稿：句子里的事实性说法（规定、要求、金额、门槛、比例、年份、日期、资格条件、流程步骤、因果结论）能不能在依据材料里找到依据。
- 语气、过渡、比喻、号召行动这类不含事实的句子不用管。
- 以【这条信息文章里没有，需要联系 Fordexa 补充调研 开头的标记句不用管。
- 依据材料说法不同但意思一致，算有依据。

只输出 JSON，不要任何其它文字：
{"unsupported":[{"sentence":"<口播稿里的原句，一字不改>","missing":"<依据材料里缺什么，一句话>"}]}
全部有依据就输出 {"unsupported":[]}`;

export type Claim = { sentence: string; missing: string };

export function parseClaimReview(raw: string): Claim[] | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = (data as { unsupported?: unknown })?.unsupported;
  if (!Array.isArray(list)) return null;
  const claims: Claim[] = [];
  for (const item of list) {
    const sentence = (item as { sentence?: unknown })?.sentence;
    if (typeof sentence !== 'string' || !sentence.trim()) return null;
    const missing = (item as { missing?: unknown }).missing;
    claims.push({ sentence: sentence.trim(), missing: typeof missing === 'string' ? missing.trim() : '' });
  }
  return claims;
}
