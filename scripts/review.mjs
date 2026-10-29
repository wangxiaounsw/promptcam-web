// 审稿：稿子先进网站当草稿（外人看不到），Shawn 在 app.fordexa.com/review/<编号> 上看和听，改完再发布并回写 Notion。
//   node --env-file=.env.local scripts/review.mjs draft   <稿子.json>                 写草稿 + 生成试听（重跑按 notion_page / 标题更新草稿）
//   node --env-file=.env.local scripts/review.mjs set     <口播编号> [--script 文件] [--title 标题] [--summary 摘要]
//   node --env-file=.env.local scripts/review.mjs audio   <口播编号> [--force]        重做试听（稿子没改默认跳过）
//   node --env-file=.env.local scripts/review.mjs show    <文章编号>                  列出文章和口播的状态
//   node --env-file=.env.local scripts/review.mjs publish <文章编号> [--only FX-0029,FX-0030]   发布草稿 + 回写 Notion
//   node --env-file=.env.local scripts/review.mjs sync    <文章编号>                  只把已发布的回写 Notion（publish 中途 Notion 出错时补）
//   node --env-file=.env.local scripts/review.mjs facts   <文章编号> <工作底稿.md>     事实核对：官网原句截图标黄，和事实表一起放进审稿页
// 稿子.json：{ "article": "FX-0028" 或 {title, summary, industry, refs, file, notion_page}, "facts"?: 工作底稿.md（draft 完顺手跑 facts）,
//             "scripts": [{ title, summary, industry?, tags?, refs?, file 或 script, notion_page?, is_free? }] }
// 文件路径相对 json 所在目录。写的是线上库；发布永远只在 Shawn 说「发布」时跑。
// draft 不碰已发布的口播；已发布的要改用 set（改完会刷新网站）。
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { bankVoice } from '../src/lib/bank-voice.ts';
import {
  SITE, articleProps, mergeNotionBody, normKey, normalizeScript, scriptHash, scriptProps, scriptToNotion,
} from './review-lib.mjs';
import { parseFacts } from './facts-lib.mjs';
import { shootFacts } from './fact-shot.mjs';

const NOTION_SCRIPTS_DS = 'c2d5c9f2-2d22-47ca-839b-44ae900914ab';
const NOTION_ARTICLES_DS = 'cc3c631a-87cd-46ed-a14a-cf46faf5641a';
const ADMIN_EMAIL = 'info@fordexa.com';

const need = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'FISH_API_KEY', 'NOTION_TOKEN'];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`缺环境变量：${missing.join('、')}（用 --env-file=.env.local）`);
  process.exit(2);
}
const env = process.env;
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const [cmd, target, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : undefined;
};
const has = (name) => rest.includes(name);

const COLS = 'id, code, slug, title, summary, industry, tags, refs, script, is_free, is_published, is_active, published_at, audio_url, audio_script_hash, notion_page, parent_id';

async function must(q, what) {
  const { data, error } = await q;
  if (error) throw new Error(`${what}失败：${error.message}`);
  return data;
}

async function byKey(key, { article = false } = {}) {
  const k = normKey(key);
  let q = db.from('idea_bank').select(COLS).or(`slug.eq.${k},code.eq.${k.toUpperCase()}`);
  if (article) q = q.is('parent_id', null);
  const row = await must(q.maybeSingle(), `查 ${key} `);
  if (!row) throw new Error(`库里没有 ${key}`);
  return row;
}

const kids = (articleId) =>
  must(db.from('idea_bank').select(COLS).eq('parent_id', articleId).order('code'), '查口播');

const live = (r) => Boolean(r.is_published && r.is_active);
const status = (r) => (live(r) ? '已发布' : r.published_at ? '已下线' : '草稿');

/** 下一个编号：和 fordexa-pipeline 的 next_code 一样按库里最大的往后排（库的默认序列落后，不能用） */
async function nextCode() {
  const [last] = await must(db.from('idea_bank').select('code').like('code', 'FX-%').order('code', { ascending: false }).limit(1), '查编号');
  const n = last ? parseInt(String(last.code).slice(3, 7), 10) : 0;
  return `FX-${String(n + 1).padStart(4, '0')}`;
}

// ───────── 网站（发布、刷新公开页）─────────

let jwtCache;
/** 拿 info@fordexa.com 的登录令牌调网站的后台接口（发布要走网站：起 slug、刷新公开页）。不发邮件。 */
async function adminToken() {
  if (jwtCache) return jwtCache;
  const h = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
  const link = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'magiclink', email: ADMIN_EMAIL }) });
  if (!link.ok) throw new Error(`拿登录链接失败 ${link.status}`);
  const lj = await link.json();
  const v = await fetch(`${env.SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: lj.hashed_token ?? lj.properties?.hashed_token }),
  });
  if (!v.ok) throw new Error(`换登录令牌失败 ${v.status}`);
  jwtCache = (await v.json()).access_token;
  return jwtCache;
}

async function sitePatch(body) {
  const r = await fetch(`${SITE}/api/admin/bank`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${await adminToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`网站更新失败 ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return (await r.json()).idea;
}

const sitePublish = (id) => sitePatch({ id, is_active: true, is_published: true });
/** 让公开页立刻重新生成（不改任何内容、不动发布时间）。口播挂在文章页上，所以碰的是文章 */
const siteRefresh = (articleId) => sitePatch({ id: articleId, is_active: true });

// ───────── 试听 ─────────

async function synthesize(text, voice) {
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.FISH_API_KEY}`, 'Content-Type': 'application/json', model: 's1' },
    body: JSON.stringify({ text, reference_id: voice, format: 'mp3', mp3_bitrate: 128 }),
  });
  if (!res.ok) throw new Error(`Fish ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** 念好、存进公开桶（文件名带随机串，和网站 storeAudio 同一套），返回要写进库的字段；不写库 */
async function makeAudio(script, industry, code) {
  const voice = bankVoice(industry);
  const mp3 = await synthesize(script, voice);
  const name = `${code.toLowerCase()}-${randomBytes(8).toString('hex')}.mp3`;
  const up = await db.storage.from('idea-audio').upload(name, mp3, { contentType: 'audio/mpeg', upsert: false });
  if (up.error) throw new Error(`上传试听失败：${up.error.message}`);
  console.error(`  ✓ ${code} 试听已生成（${voice.slice(0, 8)}，${Math.round(mp3.length / 1024)} KB）`);
  return {
    audio_url: db.storage.from('idea-audio').getPublicUrl(name).data.publicUrl,
    audio_script_hash: scriptHash(script),
    audio_at: new Date().toISOString(),
  };
}

async function removeAudio(url) {
  const old = url?.split('/idea-audio/')[1];
  if (old) await db.storage.from('idea-audio').remove([old]);
}

/** 稿子改过（或 force）才重念 */
async function ensureAudio(row, force = false) {
  const script = (row.script ?? '').trim();
  if (!script) return console.error(`  · ${row.code} 没有稿子，跳过试听`);
  if (!force && row.audio_url && row.audio_script_hash === scriptHash(script)) return console.error(`  · ${row.code} 试听沿用`);
  const fields = await makeAudio(script, row.industry, row.code);
  await must(db.from('idea_bank').update(fields).eq('id', row.id), '存试听链接');
  await removeAudio(row.audio_url);
}

// ───────── 草稿 ─────────

const readFile = (base, file) => fs.readFileSync(path.resolve(base, file), 'utf8');

/** 只取 spec 里写了的字段 —— 没写的不动，免得重跑把库里已有的值清掉 */
function pick(spec, map) {
  const out = {};
  for (const [key, col] of Object.entries(map)) if (spec[key] !== undefined) out[col] = spec[key];
  return out;
}

async function upsertArticle(spec, base) {
  if (typeof spec === 'string') return byKey(spec, { article: true });
  // 先按 Notion 页找，再按标题找（新文章还没有 Notion 页），重跑不会多出一篇
  const find = (q) => must(q.is('parent_id', null).limit(1), '查文章').then((r) => r[0] ?? null);
  const existing = (spec.notion_page && (await find(db.from('idea_bank').select(COLS).eq('notion_page', spec.notion_page))))
    || (await find(db.from('idea_bank').select(COLS).eq('title', spec.title)));
  const fields = {
    ...pick(spec, { title: 'title', summary: 'summary', industry: 'industry', refs: 'refs', tags: 'tags', notion_page: 'notion_page' }),
    ...(spec.file || spec.markdown ? { article: spec.file ? readFile(base, spec.file) : spec.markdown, article_at: new Date().toISOString() } : {}),
  };
  if (existing) {
    if (live(existing)) {
      console.error(`  · 文章 ${existing.code} 已发布，draft 不改它`);
      return existing;
    }
    await must(db.from('idea_bank').update(fields).eq('id', existing.id), '更新文章');
    return byKey(existing.code, { article: true });
  }
  const code = await nextCode();
  const [row] = await must(db.from('idea_bank').insert([{
    refs: [], tags: [], ...fields, code, slug: code.toLowerCase(), source_kind: 'article', is_active: false, is_published: false, sort_order: 999,
  }]).select(COLS), '新建文章');
  console.error(`✓ 新建文章草稿 ${row.code}「${row.title}」`);
  return row;
}

async function cmdDraft(file) {
  const base = path.dirname(path.resolve(file));
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  const art = await upsertArticle(spec.article, base);
  const current = await kids(art.id);
  for (const s of spec.scripts ?? []) {
    const hit = current.find((k) => (s.notion_page && k.notion_page === s.notion_page) || k.title === s.title);
    if (hit && live(hit)) {
      console.error(`  · ${hit.code}「${hit.title}」已发布，draft 不改它（要改用 set）`);
      continue;
    }
    const given = {
      ...pick(s, { title: 'title', summary: 'summary', industry: 'industry', tags: 'tags', refs: 'refs', notion_page: 'notion_page', is_free: 'is_free' }),
      ...(s.file || s.script !== undefined ? { script: normalizeScript(s.file ? readFile(base, s.file) : s.script) } : {}),
    };
    let row;
    if (hit) {
      [row] = await must(db.from('idea_bank').update(given).eq('id', hit.id).select(COLS), `更新 ${hit.code} `);
      console.error(`✓ 更新草稿 ${row.code}「${row.title}」`);
    } else {
      // 草稿 is_active=false：库的读权限只看 is_active，这样客户直接读库也看不到没发布的稿子
      const code = await nextCode();
      [row] = await must(db.from('idea_bank').insert([{
        industry: art.industry, refs: art.refs ?? [], tags: [], ...given,
        code, slug: code.toLowerCase(), parent_id: art.id, source_kind: 'notion', is_active: false, is_published: false, sort_order: 999,
      }]).select(COLS), '新建口播');
      console.error(`✓ 新建草稿 ${row.code}「${row.title}」`);
    }
    await ensureAudio(row);
  }
  if (spec.facts) await writeFacts(art, path.resolve(base, spec.facts));
  console.log(`${SITE}/review/${(art.slug ?? art.code).toLowerCase()}`);
}

async function cmdSet(key) {
  const row = await byKey(key);
  const patch = {};
  const file = opt('--script');
  if (file) patch.script = normalizeScript(fs.readFileSync(file, 'utf8'));
  if (opt('--title')) patch.title = opt('--title');
  if (opt('--summary')) patch.summary = opt('--summary');
  if (!Object.keys(patch).length) throw new Error('没给要改的：--script / --title / --summary');
  // 稿子改了就先念好新的，稿子和试听一次写进库 —— 已发布的页面不会有一段时间没播放器
  const newAudio = patch.script && patch.script !== row.script ? await makeAudio(patch.script, row.industry, row.code) : null;
  await must(db.from('idea_bank').update({ ...patch, ...newAudio }).eq('id', row.id), `改 ${row.code} `);
  if (newAudio) await removeAudio(row.audio_url);
  console.error(`✓ 改好 ${row.code}：${Object.keys(patch).join('、')}`);
  if (live(row)) {
    await siteRefresh(row.parent_id ?? row.id);
    console.error('  · 已发布的，公开页已刷新');
  }
}

async function cmdAudio(key) {
  const row = await byKey(key);
  await ensureAudio(row, has('--force'));
  if (live(row)) await siteRefresh(row.parent_id ?? row.id);
}

async function cmdShow(key) {
  const art = await byKey(key, { article: true });
  console.log(`文章 ${art.code}「${art.title}」${status(art)}  ${SITE}/review/${(art.slug ?? art.code).toLowerCase()}`);
  for (const k of await kids(art.id)) {
    const audio = k.audio_url && k.audio_script_hash === scriptHash(k.script ?? '') ? '有试听' : '没试听';
    console.log(`  ${k.code} ${status(k)} ${audio}「${k.title}」${k.notion_page ? '' : '（Notion 还没有）'}`);
  }
}

// ───────── Notion ─────────

async function notion(method, p, body) {
  const r = await fetch(`https://api.notion.com/v1${p}`, {
    method,
    headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Notion ${method} ${p} 失败 ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const setMarkdown = (pageId, md) =>
  notion('PATCH', `/pages/${pageId}/markdown`, { type: 'replace_content', replace_content: { new_str: md } });

/** 有页就改属性、换掉 --- 前的稿子；没有就在库里新建一页，再把页 id 记回网站库 */
async function syncScriptToNotion(row, art) {
  const created = !row.notion_page;
  const props = scriptProps({ row, articleSlug: art.slug, articleNotion: art.notion_page, created });
  let pageId = row.notion_page;
  if (created) {
    pageId = (await notion('POST', '/pages', { parent: { type: 'data_source_id', data_source_id: NOTION_SCRIPTS_DS }, properties: props })).id;
    await must(db.from('idea_bank').update({ notion_page: pageId }).eq('id', row.id), '记 Notion 页');
  } else {
    await notion('PATCH', `/pages/${pageId}`, { properties: props });
  }
  const old = created ? '' : (await notion('GET', `/pages/${pageId}/markdown`)).markdown;
  await setMarkdown(pageId, mergeNotionBody(old, scriptToNotion(row.script ?? '')));
}

/** 文章：有 Notion 页只改属性（正文以 Notion 为准）；没有就新建一页并写正文 */
async function syncArticleToNotion(art) {
  if (art.notion_page) {
    await notion('PATCH', `/pages/${art.notion_page}`, { properties: articleProps({ row: art, created: false }) });
    return art;
  }
  const page = await notion('POST', '/pages', { parent: { type: 'data_source_id', data_source_id: NOTION_ARTICLES_DS }, properties: articleProps({ row: art, created: true }) });
  await must(db.from('idea_bank').update({ notion_page: page.id }).eq('id', art.id), '记 Notion 页');
  const full = await must(db.from('idea_bank').select('article').eq('id', art.id).single(), '读文章正文');
  if (full.article) await setMarkdown(page.id, full.article);
  return { ...art, notion_page: page.id };
}

/** 把一篇文章和它下面已发布的口播都回写 Notion。可以单独重跑 */
async function syncNotion(art, rows) {
  const a = await syncArticleToNotion(art);
  for (const k of rows) {
    await syncScriptToNotion(k, a);
    console.error(`  ✓ Notion：${k.code}「${k.title}」`);
  }
}

// ───────── 发布 ─────────

async function cmdPublish(key) {
  const only = (opt('--only') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  let art = await byKey(key, { article: true });
  const todo = (await kids(art.id)).filter((k) => !live(k) && (!only.length || only.includes(k.code)));
  if (live(art) && !todo.length) return console.error('没有要发布的：文章和口播都已经发布了（只补 Notion 用 sync）');
  if (!live(art)) {
    art = { ...art, ...(await sitePublish(art.id)) };
    console.error(`✓ 文章 ${art.code} 上线 ${SITE}/ideas/${art.slug}`);
  }
  const done = [];
  for (const k of todo) {
    if (!k.script?.trim()) { console.error(`  · 跳过 ${k.code}：没有稿子`); continue; }
    await ensureAudio(k);
    const row = { ...k, ...(await sitePublish(k.id)) };
    done.push(row);
    console.error(`✓ 口播 ${row.code}「${row.title}」上线`);
  }
  // 口播挂在文章页上，发口播只刷新了口播自己的地址；最后碰一下文章，让文章页带着口播重新生成
  await siteRefresh(art.id);
  try {
    await syncNotion(art, done);
  } catch (e) {
    console.error(`! 网站已发布，Notion 回写出错：${e.message}\n  修好后跑：scripts/review.mjs sync ${art.code}`);
    process.exitCode = 1;
  }
  console.log(`${SITE}/ideas/${art.slug}`);
}

async function cmdSync(key) {
  const art = await byKey(key, { article: true });
  if (!live(art)) throw new Error(`文章 ${art.code} 还没发布`);
  await syncNotion(art, (await kids(art.id)).filter(live));
  console.error('✓ Notion 已和网站对齐');
}

// 事实核对：私有桶 fact-check/<编号>/ 放 facts.json 和 <n>.png，网站审稿页（只给管理员）读它
const FACTS_BUCKET = 'fact-check';

async function ensureFactsBucket() {
  const { data } = await db.storage.getBucket(FACTS_BUCKET);
  if (data) return;
  const { error } = await db.storage.createBucket(FACTS_BUCKET, { public: false });
  if (error && !/exist/i.test(error.message)) throw new Error(`建桶 ${FACTS_BUCKET} 失败：${error.message}`);
}

async function writeFacts(art, mdFile) {
  const parsed = parseFacts(fs.readFileSync(mdFile, 'utf8'));
  if (!parsed.facts.length) throw new Error(`${mdFile} 里没读到事实（要有「## 事实表」和「### N. …」）`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `facts-${art.code}-`));
  console.error(`事实核对 ${art.code}：${parsed.facts.length} 条，开始截图`);
  const shots = await shootFacts(parsed.facts, tmp, console.error);
  await ensureFactsBucket();
  const store = db.storage.from(FACTS_BUCKET);
  const facts = [];
  for (const f of parsed.facts) {
    const r = shots[f.n];
    let shot = { ok: false, reason: r.reason ?? '没截到' };
    if (r.ok) {
      const file = `${f.n}.png`;
      const { error } = await store.upload(`${art.code}/${file}`, fs.readFileSync(path.join(tmp, file)), { contentType: 'image/png', upsert: true });
      shot = error ? { ok: false, reason: `截到了但上传失败：${error.message}` } : { ok: true, file, url: r.url, found: r.found };
    }
    facts.push({ n: f.n, claim: f.claim, quote: f.quote, source: f.source, urls: f.urls, ...(f.urlsFrom ? { urlsFrom: f.urlsFrom } : {}), published: f.published, key: f.key, shot });
  }
  // 上一版有、这一版没截到的旧图删掉，免得页面上配错图
  const keep = new Set(facts.filter((f) => f.shot.ok).map((f) => f.shot.file));
  const { data: old } = await store.list(art.code);
  const stale = (old ?? []).map((o) => o.name).filter((n) => n.endsWith('.png') && !keep.has(n));
  if (stale.length) await store.remove(stale.map((n) => `${art.code}/${n}`));
  const json = JSON.stringify({ updatedAt: new Date().toISOString(), title: parsed.title, warnings: parsed.warnings, missing: parsed.missing, facts }, null, 1);
  const { error } = await store.upload(`${art.code}/facts.json`, Buffer.from(json), { contentType: 'application/json', upsert: true });
  if (error) throw new Error(`事实表上传失败：${error.message}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.error(`✓ 事实核对：${facts.length} 条，${keep.size} 条有截图`);
}

async function cmdFacts(key) {
  const md = rest[0];
  if (!md || !fs.existsSync(md)) throw new Error('用法：facts <文章编号> <工作底稿.md>');
  const art = await byKey(key, { article: true });
  await writeFacts(art, md);
  console.log(`${SITE}/review/${(art.slug ?? art.code).toLowerCase()}#facts`);
}

const commands = {
  draft: () => cmdDraft(target),
  set: () => cmdSet(target),
  audio: () => cmdAudio(target),
  show: () => cmdShow(target),
  publish: () => cmdPublish(target),
  sync: () => cmdSync(target),
  facts: () => cmdFacts(target),
};

if (!commands[cmd] || !target) {
  console.error('用法见文件开头：draft / set / audio / show / publish / sync / facts');
  process.exit(1);
}
try {
  await commands[cmd]();
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
