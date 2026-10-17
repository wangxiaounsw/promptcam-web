/**
 * 【待补调研】标记。AI 遇到「讲清楚需要、但文章里没有」的信息时原样插入这段，
 * 不单独存列 —— 每次从正文里扫，删掉标记提示就自动消失。
 */
export const RESEARCH_MARK_HEAD = '【这条信息文章里没有，需要联系 Fordexa 补充调研';

export function researchMarks(body: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const start = body.indexOf(RESEARCH_MARK_HEAD, from);
    if (start < 0) return out;
    const end = body.indexOf('】', start + RESEARCH_MARK_HEAD.length);
    if (end < 0) return out;
    out.push(body.slice(start, end + 1));
    from = end + 1;
  }
}
