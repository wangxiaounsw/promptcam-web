// 事实核对（review.mjs facts）里不碰网络的部分：读调研员交的工作底稿 Markdown，拆成一条条事实。
// 工作底稿格式见调研 BRIEF：「### N. 中文说法」下面跟「- 英文原句：「…」」「- 出处：… 链接」「- 发布日期 / 所属期间：…」「- 关键：是/否」。

/** 截图时在页面上找原句用：弯引号、破折号、各种空白都归一 */
export function normText(s) {
  return String(s)
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MIN_SNIPPET = 16;

/** 原句里带「…」的是摘了几段：按省略号切开，够长的片段拿去页面上找，长的先找 */
export function searchSnippets(quote) {
  return normText(quote)
    .split(/\s*(?:…|\.\.\.)\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SNIPPET)
    .sort((a, b) => b.length - a.length);
}

const URL_RE = /https?:\/\/[^\s「」（）()，。；、<>"']+/g;
const trimUrl = (u) => u.replace(/[.,;:!?。，；：）)】]+$/, '');

/** 「英文原句」一行里的正文原句：「…」里的内容，跳过紧跟在「表格值」后面的那段 */
function proseQuotes(line) {
  const out = [];
  const re = /「([^」]+)」/g;
  let m;
  while ((m = re.exec(line))) {
    const before = line.slice(Math.max(0, m.index - 6), m.index);
    if (/表格值[：:]?\s*$/.test(before)) continue;
    out.push(m[1].trim());
  }
  return out;
}

function field(lines, name) {
  return lines.filter((l) => l.startsWith(`- ${name}`)).map((l) => l.replace(new RegExp(`^- ${name}[^：:]*[：:]\\s*`), '').trim());
}

function parseFact(n, claim, lines) {
  const quotes = field(lines, '英文原句');
  const src = field(lines, '出处').join(' ');
  return {
    n,
    claim,
    quote: quotes.join('\n'),
    prose: quotes.flatMap(proseQuotes),
    hasTable: quotes.some((q) => q.includes('表格值')),
    source: src,
    urls: [...new Set((src.match(URL_RE) ?? []).map(trimUrl))],
    published: field(lines, '发布日期').join(' '),
    key: field(lines, '关键').join('').startsWith('是'),
  };
}

/** 工作底稿 → { title, warnings, facts, missing } */
export function parseFacts(md) {
  const lines = String(md).split(/\r?\n/);
  const title = (lines.find((l) => /^# /.test(l)) ?? '').replace(/^#\s*(工作底稿\s*[·:：]\s*)?/, '').trim();
  const warnings = lines.filter((l) => l.startsWith('⚠️')).map((l) => l.replace(/^⚠️\s*/, '').trim());
  const facts = [];
  const missing = [];
  let section = '';
  let cur = null;
  const flush = () => {
    if (cur) facts.push(parseFact(cur.n, cur.claim, cur.lines));
    cur = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^## /.test(line)) {
      flush();
      section = line.slice(3).trim();
      continue;
    }
    if (section.startsWith('事实表')) {
      const h = line.match(/^###\s*(\d+)[.、]\s*(.+)$/);
      if (h) {
        flush();
        cur = { n: Number(h[1]), claim: h[2].trim(), lines: [] };
      } else if (cur && line.startsWith('- ')) cur.lines.push(line);
    } else if (section.includes('【缺】') && /^(-|\d+\.)\s/.test(line)) {
      missing.push(line.replace(/^(-|\d+\.)\s+/, '').trim());
    }
  }
  flush();
  return { title, warnings, facts: inheritUrls(facts), missing };
}

/** 出处只写「同第 N 条」「同 N」「同上」的：沿用那条的链接，记下沿用的是第几条（页面上要注明） */
function inheritUrls(facts) {
  const byN = new Map(facts.map((f) => [f.n, f]));
  return facts.map((f, i) => {
    if (f.urls.length) return f;
    const ref = f.source.match(/同\s*第?\s*(\d+)\s*条?/);
    const from = ref ? byN.get(Number(ref[1])) : /同上/.test(f.source) ? facts[i - 1] : undefined;
    return from?.urls.length ? { ...f, urls: from.urls, urlsFrom: from.urlsFrom ?? from.n } : f;
  });
}
