import { diffSeq, type DiffLine } from './prompt-diff.ts';

/**
 * 口播稿「和上一版比」：按句子比，不按行比。
 * 生成的稿子常常一段好几句，按行比改一个字整段都标红；按句子比只标改了的那句。
 * 换行单独当一个片段，显示时还原成换行，段落不乱。
 */
export function sentences(text: string): string[] {
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    if (i > 0) out.push('\n');
    for (const s of line.match(/[^。！？!?]+[。！？!?]*|[。！？!?]+/g) ?? []) {
      if (s.trim()) out.push(s.trim());
    }
  });
  return out;
}

export function diffSentences(before: string, after: string): DiffLine[] {
  return diffSeq(sentences(before), sentences(after));
}
