/**
 * 系统固定的事实规则。拼在可编辑提示词**之后**，谁也改不掉 ——
 * 客户再怎么调风格，也调不出编造的事实。
 */
export const FACT_RULES = `以下规则优先于上面的一切要求，不可违反：
1. 只能使用下面「依据材料」里出现的信息：选题标题、Fordexa 原稿、文章正文、出处列表。
2. 依据材料里没有的事实（规定、金额、门槛、比例、年份、日期、资格条件、流程步骤）一律不许写，也不许凭常识补。
3. 讲清楚这件事确实需要、但依据材料里没有的信息，在稿子相应位置原样插入：【这条信息文章里没有，需要联系 Fordexa 补充调研：<缺什么>】
4. 稿子是念给观众听的：不要提「依据材料」「材料里」「文章里」这类字眼，直接讲内容。
5. 只输出口播稿正文。上面要求在正文后附出处表的，正文后单独一行写 ---，再写表。`;

/** 依据材料的字数上限。超了只截文章末尾，其余段落保持完整 */
export const SOURCE_LIMIT = 24000;

export type SourceRef = { label: string; url: string };
export type SourceInput = { title: string; original: string; article: string | null; refs: SourceRef[] };

export function buildSourceText(s: SourceInput): { text: string; truncated: boolean } {
  const refLines = s.refs.map((r) => `- ${r.label} ${r.url}`.trim()).join('\n');
  const head = `【选题】\n${s.title}\n\n【Fordexa 原稿】\n${s.original}`;
  const tail = refLines ? `\n\n【出处】\n${refLines}` : '';
  const article = s.article?.trim() ?? '';
  if (!article) return { text: head + tail, truncated: false };

  const room = Math.max(0, SOURCE_LIMIT - head.length - tail.length);
  const truncated = article.length > room;
  const body = truncated ? `${article.slice(0, room)}\n……（文章过长，后面已截断）` : article;
  return { text: `${head}\n\n【文章】\n${body}${tail}`, truncated };
}
