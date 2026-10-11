import { marked } from 'marked';

/**
 * 文章正文:Notion 同步过来的 Markdown → HTML。内容是我们自己写的,不做消毒。
 * 表格、图片、引用都按 GFM 来。
 */
export function renderArticle(md: string): string {
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(md) as string;
}
