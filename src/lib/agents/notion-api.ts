import { fromRichText } from './rich-text.ts';

/**
 * 只用到的几个 Notion REST 接口（不加依赖，直接 fetch）。
 * 查询一律翻到底：只看第一页会把「没有」误判成真的没有。
 */

const BASE = 'https://api.notion.com/v1';
const VERSION = '2025-09-03';

type Prop = {
  type?: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  checkbox?: boolean;
  date?: { start: string } | null;
  relation?: { id: string }[];
};

export type NotionPage = { id: string; properties: Record<string, Prop> };

export class NotionApi {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async call<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Notion-Version': VERSION,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(`Notion ${method} ${path} 失败（${res.status}）：${detail?.message ?? res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async queryAll(dataSourceId: string, filter?: object): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.call<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>(
        'POST',
        `/data_sources/${dataSourceId}/query`,
        { page_size: 100, ...(filter ? { filter } : {}), ...(cursor ? { start_cursor: cursor } : {}) },
      );
      pages.push(...res.results);
      cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
    } while (cursor);
    return pages;
  }

  getPage(id: string): Promise<NotionPage> {
    return this.call<NotionPage>('GET', `/pages/${id}`);
  }

  async updateProps(pageId: string, props: Record<string, unknown>): Promise<void> {
    await this.call('PATCH', `/pages/${pageId}`, { properties: props });
  }
}

export function text(p: NotionPage, name: string): string {
  const prop = p.properties[name];
  return fromRichText(prop?.title ?? prop?.rich_text);
}

export function select(p: NotionPage, name: string): string | null {
  return p.properties[name]?.select?.name ?? null;
}

export function checkbox(p: NotionPage, name: string): boolean {
  return p.properties[name]?.checkbox === true;
}

export function date(p: NotionPage, name: string): string | null {
  return p.properties[name]?.date?.start ?? null;
}

export function relationIds(p: NotionPage, name: string): string[] {
  return (p.properties[name]?.relation ?? []).map((r) => r.id);
}
