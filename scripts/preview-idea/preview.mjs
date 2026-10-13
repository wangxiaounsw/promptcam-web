// 本地预览一篇「文章 + 口播」在 app.fordexa.com/ideas/<slug> 上的样子,不用起 Next、不连数据库。
//   node scripts/preview-idea/preview.mjs "<76-小红书视频/FX-0003 xxx>"
// 读文件夹里的 FX-NNNN.md(文章)和 FX-NNNNa.md、FX-NNNNb.md…(口播),写出同目录的「预览.html」。
// 样式直接取 src/app/globals.css,class 照抄 ideas/[slug]/page.tsx、ScriptSection、ScriptBody、SiteChrome ——
// 那几个文件改了版式,这里要跟着改。点赞 / 收藏 / 登录在预览里只是样子,不能点。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { parseDoc, parseRef, scriptParas, scriptStats } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TAILWIND = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.13';
const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700&family=Instrument+Sans:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap';

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('用法: node scripts/preview-idea/preview.mjs "<稿子文件夹>"');
  process.exit(1);
}
const code = (path.basename(dir).match(/FX-\d{4}/) ?? ['FX-0000'])[0];
const read = (f) => parseDoc(fs.readFileSync(path.join(dir, f), 'utf8'));
const articleFile = `${code}.md`;
if (!fs.existsSync(path.join(dir, articleFile))) {
  console.error(`找不到文章 ${articleFile}`);
  process.exit(1);
}
const article = read(articleFile);
const scripts = fs.readdirSync(dir)
  .filter((f) => new RegExp(`^${code}[a-z]\\.md$`).test(f))
  .sort()
  .map((f) => ({ code: `${code}${f.slice(code.length, -3)}`.toUpperCase(), ...read(f) }));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// globals.css 去掉 @import,其余原样交给浏览器版 Tailwind(@layer、var 令牌、.article 都照旧)
const css = fs.readFileSync(path.join(ROOT, 'src', 'app', 'globals.css'), 'utf8').replace(/@import\s+["']tailwindcss["'];?/, '');

const heart = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
const bookmark = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
const reactions = (size) => {
  const base = size === 'sm' ? 'gap-1 px-2 py-1 text-xs' : 'gap-1.5 px-3 py-1.5 text-sm';
  const btn = `inline-flex items-center rounded-full border transition-colors ${base} border-[var(--line)] text-[var(--muted)]`;
  return `<span class="inline-flex items-center gap-2"><span class="${btn}">${heart}0</span><span class="${btn}">${bookmark}0</span></span>`;
};

const chip = {
  code: (c) => `<span class="rounded-full bg-[var(--row-line)] px-2.5 py-1 font-mono text-xs text-[var(--muted)]">${esc(c)}</span>`,
  industry: (n, sm) => `<span class="rounded-full bg-[var(--accent-tint)] ${sm ? 'px-2 py-0.5' : 'px-2.5 py-1 text-xs'} font-medium text-[var(--accent)]">${esc(n)}</span>`,
  tag: (t, sm) => `<span class="rounded-full border border-[var(--line)] ${sm ? 'px-2 py-0.5' : 'px-2.5 py-1 text-xs'} text-[var(--muted)]">${esc(t)}</span>`,
};

function scriptBody(s) {
  const { chars, length } = scriptStats(s.body);
  const paras = scriptParas(s.body)
    .map((p, i) => `<p class="whitespace-pre-wrap text-[17px] leading-[1.95] text-[var(--ink)]" style="margin-top:${i === 0 ? 0 : '1.25rem'}">${esc(p)}</p>`)
    .join('');
  return `<section class="mt-10">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <h2 class="font-display text-sm font-semibold tracking-wide text-[var(--muted)]">口播稿 · ${esc(s.code)}</h2>
        <span class="text-xs text-[var(--muted)]">${chars} 字 · 念完${length}</span>
        <div class="flex-1"></div>
        <button class="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]" data-copy="${esc(s.body.trim())}">复制全文</button>
      </div>
      <div class="rounded-2xl bg-[var(--bg-raised)] p-7">${paras}</div>
    </section>`;
}

function scriptSection(s) {
  const tags = list(s.meta.tags);
  return `<section id="${esc(s.code.toLowerCase())}" class="rounded-2xl bg-[var(--bg-raised)] p-5">
      <div class="flex flex-wrap items-center gap-3">
        <span class="font-mono text-xs text-[var(--muted)]">${esc(s.code)}</span>
        <h3 class="font-display min-w-0 flex-1 text-base font-semibold leading-snug">${esc(s.meta.title)}</h3>
        ${reactions('sm')}
      </div>
      ${s.meta.summary ? `<p class="mt-2 text-sm leading-relaxed text-[var(--muted)]">${esc(s.meta.summary)}</p>` : ''}
      ${s.meta.industry || tags.length ? `<div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">${s.meta.industry ? chip.industry(s.meta.industry, true) : ''}${tags.map((t) => chip.tag(t, true)).join('')}</div>` : ''}
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <button class="rounded-lg bg-[var(--accent-tint)] px-3 py-1.5 text-sm font-medium text-[var(--accent)]" data-toggle>展开口播稿 ▾</button>
      </div>
      <div hidden data-script>${scriptBody(s)}</div>
    </section>`;
}

const m = article.meta;
const refs = list(m.refs).map(parseRef);
const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
marked.setOptions({ gfm: true, breaks: false }); // 和 src/lib/article.ts 同一套

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.title)} · 预览</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="${FONTS}">
<script src="${TAILWIND}"></script>
<style type="text/tailwindcss">
:root { --font-display: "Bricolage Grotesque"; --font-body: "Instrument Sans"; }
${css}
</style>
</head>
<body>
<div style="background:#fff3cd;color:#664d03;font-size:13px;padding:6px 16px;text-align:center">本地预览 · 编号、发布时间以真正发布时网站分配的为准 · 点赞收藏不可点</div>
<header class="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur">
  <div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5 sm:h-16 sm:px-6">
    <span class="font-display whitespace-nowrap text-[17px] font-bold tracking-tight">Fordexa <span class="text-[var(--accent)]">口播助手</span></span>
    <nav class="hidden items-center gap-5 text-[15px] sm:flex"><span class="whitespace-nowrap text-[var(--muted)]">怎么运作</span><span class="whitespace-nowrap text-[var(--muted)]">口播库</span></nav>
    <div class="flex-1"></div>
    <span class="whitespace-nowrap rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">申请开通</span>
  </div>
</header>
<main class="mx-auto max-w-2xl px-6 pb-24 pt-14">
  <span class="text-sm text-[var(--muted)]">← 口播库</span>
  <div class="mt-8 flex flex-wrap items-center gap-3">
    ${chip.code(code)}
    ${list(m.industry).map((n) => chip.industry(n)).join('')}
    ${list(m.tags).map((t) => chip.tag(t)).join('')}
    <span class="text-xs text-[var(--muted)]">发布时间：${today}</span>
  </div>
  <h1 class="font-display mt-4 text-balance text-3xl font-bold leading-[1.25] md:text-4xl">${esc(m.title)}</h1>
  ${m.summary ? `<p class="mt-6 text-lg leading-relaxed text-[var(--muted)]">${esc(m.summary)}</p>` : ''}
  <div class="mt-5">${reactions('md')}</div>
  <article class="article mt-8">${marked.parse(article.body)}</article>
  ${scripts.length ? `<section class="mt-12">
    <h2 class="font-display mb-4 text-sm font-semibold tracking-wide text-[var(--muted)]">这篇出的口播 · ${scripts.length} 条</h2>
    <div class="space-y-3">${scripts.map(scriptSection).join('')}</div>
  </section>` : ''}
  ${refs.length ? `<section class="mt-12">
    <h2 class="font-display mb-4 text-sm font-semibold tracking-wide text-[var(--muted)]">参考出处</h2>
    <ul class="space-y-2.5">${refs.map((r) => `<li class="text-[15px] leading-relaxed">${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener nofollow" class="text-[var(--accent)] hover:underline">${esc(r.label)}</a>` : `<span class="text-[var(--muted)]">${esc(r.label)}</span>`}</li>`).join('')}</ul>
    <p class="mt-5 text-xs leading-relaxed text-[var(--muted)]">出处公开是故意的 —— 你拿去讲之前应该能自己核一遍。 内容仅供参考，不构成专业意见。</p>
  </section>` : ''}
</main>
<footer class="mt-24 border-t border-[var(--line)]">
  <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--muted)]">
    <p>© ${new Date().getFullYear()} Fordexa<span class="mx-2">·</span>AU GUIDE PTY LTD</p>
    <nav class="flex flex-wrap gap-6"><span>怎么运作</span><span>口播库</span><span>申请开通</span><span>隐私政策</span><span>使用条款</span><span>联系</span></nav>
  </div>
</footer>
<script>
document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
  const box = b.closest('section').querySelector('[data-script]');
  box.hidden = !box.hidden;
  b.textContent = box.hidden ? '展开口播稿 ▾' : '收起口播稿 ▴';
}));
document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = '已复制'; } catch { b.textContent = '复制失败'; }
  setTimeout(() => { b.textContent = '复制全文'; }, 1500);
}));
</script>
</body>
</html>
`;

const out = path.join(dir, '预览.html');
fs.writeFileSync(out, html, 'utf8');
console.log(`wrote ${out}(文章 1 篇,口播 ${scripts.length} 条)`);
