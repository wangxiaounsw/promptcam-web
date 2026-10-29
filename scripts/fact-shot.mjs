// 官网原文截图：打开出处页面，找到英文原句，标黄，截原句所在那一段（上下留一点）。
// 用法：node scripts/fact-shot.mjs --url <链接> --quote "<原句>" --out <png>  → stdout 一行 JSON
// 给 review.mjs facts 当库用：shootFacts(facts, outDir)。
// Playwright 借 ppt 项目里装好的（本仓库不装浏览器），可用 FORDEXA_PLAYWRIGHT 指到别处。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { searchSnippets } from './facts-lib.mjs';

const PW = process.env.FORDEXA_PLAYWRIGHT ?? 'C:/Users/habit/Local Sites/ppt/node_modules/playwright';
const MAX_CLIP = 1100;
// 无头浏览器默认 UA 带 HeadlessChrome，有些政府站直接 403
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'; // 截图最高多少 CSS 像素，长段落只截原句附近

/** 在页面里跑：文本节点逐字归一后拼起来找片段，命中的字逐段包 <mark>，返回要截的区域 */
function markInPage(snippets) {
  const MAP = { '\u2018': "'", '\u2019': "'", '\u201B': "'", '\u2032': "'", '\u201C': '"', '\u201D': '"', '\u201F': '"', '\u2033': '"', '\u2013': '-', '\u2014': '-', '\u2212': '-' };
  document.querySelectorAll('details').forEach((d) => { d.open = true; });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let text = '';
  const where = []; // text 里每个字来自哪个节点的第几个字
  let n;
  while ((n = walker.nextNode())) {
    const s = n.nodeValue;
    for (let i = 0; i < s.length; i++) {
      let c = MAP[s[i]] ?? s[i];
      if (/\s/.test(c)) {
        if (text.endsWith(' ') || !text) continue;
        c = ' ';
      }
      text += c;
      where.push([n, i]);
    }
    if (!text.endsWith(' ') && text) { text += ' '; where.push(null); }
  }
  const lower = text.toLowerCase();
  for (const snip of snippets) {
    let at = text.indexOf(snip);
    if (at < 0) at = lower.indexOf(snip.toLowerCase());
    if (at < 0) continue;
    // 命中的区间按节点分段，从后往前包，免得前面的包法弄乱后面的偏移
    const spans = [];
    for (let k = at; k < at + snip.length; k++) {
      const w = where[k];
      if (!w) continue;
      const last = spans[spans.length - 1];
      if (last && last.node === w[0] && last.end === w[1]) last.end = w[1] + 1;
      else spans.push({ node: w[0], start: w[1], end: w[1] + 1 });
    }
    const marks = [];
    for (const sp of spans.reverse()) {
      const r = document.createRange();
      r.setStart(sp.node, sp.start);
      r.setEnd(sp.node, sp.end);
      const m = document.createElement('mark');
      m.style.cssText = 'background:#FFE14D;color:inherit;padding:0 1px;border-radius:2px';
      r.surroundContents(m);
      marks.push(m);
    }
    const first = marks[marks.length - 1];
    const block = first.closest('p, li, td, th, dd, dt, blockquote, h1, h2, h3, h4, figcaption, tr') ?? first.parentElement;
    block.scrollIntoView({ block: 'center' });
    const rects = marks.map((m) => m.getBoundingClientRect());
    const b = block.getBoundingClientRect();
    // 上方 300px 内最近的小标题一起截进来，看得出原句在哪一节
    const head = [...document.querySelectorAll('h1, h2, h3, h4')]
      .filter((h) => h.getBoundingClientRect().bottom <= b.top + 1 && b.top - h.getBoundingClientRect().top < 300)
      .pop();
    const top = Math.min(head ? head.getBoundingClientRect().top : b.top, ...rects.map((r) => r.top)) + window.scrollY;
    const bottom = Math.max(b.bottom, ...rects.map((r) => r.bottom)) + window.scrollY;
    return { found: snip, top, bottom, markTop: Math.min(...rects.map((r) => r.top)) + window.scrollY };
  }
  return null;
}

async function hideClutter(page) {
  await page.addStyleTag({
    content: '[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[class*="feedback" i],[class*="back-to-top" i],[class*="backtotop" i]{display:none!important}',
  }).catch(() => {});
  // 贴边的浮层（反馈按钮、悬浮顶栏）会压在截图上
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') el.style.setProperty('display', 'none', 'important');
    }
  }).catch(() => {});
}

/** 一条事实：依次试每个链接、每个片段，找到就截。返回 { ok, url, found } 或 { ok:false, reason } */
export async function shootOne(browser, { urls, quotes }, out) {
  const snippets = [...new Set(quotes.flatMap(searchSnippets))];
  if (!urls.length) return { ok: false, reason: '出处没有链接' };
  if (!snippets.length) return { ok: false, reason: '没有可找的英文原句（只有表格值）' };
  let lastReason = '';
  for (const url of urls) {
    if (/\.(xlsx?|csv|zip)($|\?)/i.test(url)) { lastReason = '链接是数据文件（Excel 等），下载核对'; continue; }
    const page = await browser.newPage({ viewport: { width: 760, height: 1000 }, deviceScaleFactor: 2, userAgent: UA });
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (res && res.status() >= 400) { lastReason = `页面打不开（${res.status()}）`; continue; }
      if (/\.pdf($|\?)/i.test(url) || (res?.headers()['content-type'] ?? '').includes('pdf')) { lastReason = 'PDF 截不了，打开链接核对'; continue; }
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await hideClutter(page);
      const hit = await page.evaluate(markInPage, snippets);
      if (!hit) { lastReason = '页面上没找到原句'; continue; }
      const pad = 32;
      let y = Math.max(0, hit.top - pad);
      let h = hit.bottom - hit.top + pad * 2;
      if (h > MAX_CLIP) { y = Math.max(0, hit.markTop - 200); h = MAX_CLIP; }
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.screenshot({ path: out, clip: { x: 0, y, width: 760, height: h }, fullPage: true });
      return { ok: true, url, found: hit.found };
    } catch (e) {
      lastReason = /Download is starting/.test(e.message)
        ? '链接是下载文件，下载核对'
        : `页面打不开（${String(e.message).split('\n')[0].slice(0, 80)}）`;
    } finally {
      await page.close();
    }
  }
  return { ok: false, reason: lastReason };
}

/** 一批事实，按顺序截（同一个站别并发猛敲）。返回 { [n]: 结果 }，图在 outDir/<n>.png */
export async function shootFacts(facts, outDir, log = () => {}) {
  const { chromium } = createRequire(import.meta.url)(PW);
  const browser = await chromium.launch();
  const results = {};
  try {
    for (const f of facts) {
      const r = await shootOne(browser, { urls: f.urls, quotes: f.prose }, path.join(outDir, `${f.n}.png`));
      results[f.n] = r;
      log(`  ${f.n}. ${r.ok ? '截到' : '没截到：' + r.reason}`);
    }
  } finally {
    await browser.close();
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const { chromium } = createRequire(import.meta.url)(PW);
  const browser = await chromium.launch();
  const r = await shootOne(browser, { urls: [arg('--url')], quotes: [arg('--quote')] }, arg('--out'));
  await browser.close();
  console.log(JSON.stringify(r));
}
