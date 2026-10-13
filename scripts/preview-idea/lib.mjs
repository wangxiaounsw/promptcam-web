/**
 * 本地预览用的纯函数:读稿子文件、口播字数和时长。
 * 字数 / 时长 / 分段的规则和 src/app/(site)/ideas/[slug]/ScriptBody.tsx 保持一致,改那边时同步改这里。
 */

/** 只认三种写法:`key: 值`、`key: [a, b]`、`key:` 下面跟 `  - 项`。够稿子的 frontmatter 用,不是完整 YAML。 */
export function parseDoc(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) { meta[listKey].push(item[1].trim()); continue; }
    const kv = line.match(/^([\w一-鿿]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    listKey = null;
    if (raw === '') { meta[key] = []; listKey = key; }
    else if (/^\[.*\]$/.test(raw)) meta[key] = raw.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    else meta[key] = raw.trim();
  }
  return { meta, body: m[2] };
}

/** Notion「出处」一行一条「名称｜网址」;只有网址时名称就是网址 */
export function parseRef(line) {
  const [a, b] = line.split('｜').map((s) => s.trim());
  if (b) return { label: a, url: b };
  return /^https?:\/\//.test(a) ? { label: a, url: a } : { label: a, url: '' };
}

export function scriptParas(script) {
  return script.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export function scriptStats(script) {
  const chars = script.replace(/\s/g, '').length;
  const secs = Math.max(10, Math.ceil(chars / 4 / 10) * 10);
  const length =
    secs < 60
      ? `约 ${secs} 秒`
      : secs % 60 === 0
        ? `约 ${Math.floor(secs / 60)} 分钟`
        : `约 ${Math.floor(secs / 60)} 分 ${secs % 60} 秒`;
  return { chars, length };
}
