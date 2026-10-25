/**
 * Notion 文本列的读写：单段最多 2000 字，长提示词要切成几段写进同一列，读回来再拼起来。
 * 切的时候不能把 emoji 这类代理对切成两半，否则读回来就不是原文了。
 */

export type RichTextIn = { type: 'text'; text: { content: string } };

const SEGMENT = 2000;

export function toRichText(s: string): RichTextIn[] {
  const out: RichTextIn[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + SEGMENT, s.length);
    const last = s.charCodeAt(end - 1);
    if (end < s.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    out.push({ type: 'text', text: { content: s.slice(i, end) } });
    i = end;
  }
  return out;
}

export function fromRichText(arr: readonly { plain_text: string }[] | undefined): string {
  return (arr ?? []).map((r) => r.plain_text).join('');
}

/** 比较 Shawn 调的版本和网站版本时用：去首尾空白、统一换行 */
export function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}
