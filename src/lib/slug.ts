/**
 * 网址 slug。
 *
 * 规则:英文关键词 + 编号,比如 bas-common-mistakes-fx-0007。
 * 英文是因为中文 URL 在微信里会变成一长串百分号,而且 Google 对拼音没感觉。
 * 编号兜底保证永远唯一、永远能找回来。
 * 发布后锁定不再变 —— 变了外面已经发出去的链接就断了。
 */
export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** 带编号后缀;已经带了就不重复加 */
export function withCode(slug: string, code: string | null): string {
  const c = (code ?? '').toLowerCase();
  if (!c) return slug;
  const base = slug.replace(new RegExp(`-?${c}$`), '').replace(/-+$/, '');
  return base ? `${base}-${c}` : c;
}

/**
 * 让 DeepSeek 起 3-6 个英文词。失败就返回 null,调用方用编号兜底 ——
 * 起名失败不该挡住发布。
 */
export async function suggestSlug(title: string, summary: string | null): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY ?? '';
  if (!key) return null;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You write URL slugs for articles aimed at Chinese-speaking small business owners and migrants in Australia. ' +
              'Reply with ONLY the slug: 3 to 6 lowercase English words joined by hyphens, no numbers, no dates, no brand names. ' +
              'Use the terms people would actually type into Google (e.g. bas, gst, abn, home-office, tax-deduction, partner-visa).',
          },
          { role: 'user', content: `Title: ${title}\n${summary ? `Summary: ${summary}` : ''}` },
        ],
        temperature: 0.3,
        max_tokens: 40,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (data.choices?.[0]?.message?.content ?? '').trim().split('\n')[0];
    const slug = slugify(raw).replace(/[一-鿿]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return /^[a-z][a-z0-9-]{2,60}$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}
