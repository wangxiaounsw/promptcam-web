# 发布日历 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 工作台加一个「日历」标签：一家公司一本月历，按系列自动铺开发布日，每一条有进度、成片链接、小红书文案、备注；客户只看不改、可以写备注。

**Architecture:**
- 两张新表 `posts`、`post_notes`，`organizations` 加 `post_weekdays`。
- 纯逻辑放在 `src/lib/studio/calendar.ts`（日期、铺开、库存、提醒）和 `src/lib/studio/posts.ts`（进度规则、校验、红点、复制文案），前后端和测试共用，不 import auth。
- 数据库读写放 `src/lib/studio/posts-db.ts`。
- 接口在 `src/app/api/studio/posts/**` 和 `src/app/api/studio/org`，全部照现有写法：`requireStudioUser` → 按 `orgId` 查 → service key。
- 页面在 `src/app/studio/calendar/`。

**Tech Stack:** Next.js 15（App Router，动态参数是 Promise）、React 19、Tailwind 4、supabase-js、node:test（`npm test`，Node 直接跑 .ts）。

**Spec:** `docs/superpowers/specs/2026-10-27-content-calendar-design.md`

## Global Constraints

**流程**
- **不 commit、不 push。** Shawn 的规矩：每一批改动都要他亲口说「提交」。每个任务结束时只跑测试，不提交。全部做完报「已改好未提交，等你确认」。
- 动工前，`feat/company-agents` 上还有上一批没提交的改动（审稿流程那批）。先问 Shawn 那批怎么处理，再从当前 HEAD 开新分支 `feat/content-calendar`。
- 迁移 SQL 由 Shawn 在 Supabase SQL Editor 里跑。他明确同意时，也可以用 Supabase MCP 的 `apply_migration` 代跑。
- 本机 3110 端口的 dev server 不是我们开的，不许关。要起本地服务就另开端口（如 3462）。

**数据与权限**
- 所有 `/api/studio/posts*`、`/api/studio/org` 的读写都要带 `.eq('org_id', user.orgId)`。拿 id 找行时也要带，查不到就回 404 `{ error: '找不到这一条' }`。
- 只有管理员能用的接口：先检查 `user.isAdmin`，不是管理员回 403 `{ error: '只有 Fordexa 能改' }`。
- 新表开 RLS、不加策略。
- 日期一律按墨尔本时间。「今天」用 `melbourneDay(new Date())`（`src/lib/studio/week.ts`）。日期在代码里一律是 `'YYYY-MM-DD'` 字符串。

**文案（界面上的中文，照抄）**
- 进度：选题、口播稿、配音、成片（图文叫「出图」）、可发布、已发布。
- 按钮：「我审过了」「复制标题+正文」「换日期」「已发布 · 贴链接」「撤回已发布」「先不排」「排一个系列」「加一条」「打开成片 ↗」。
- 提醒：「差 N 天」「过期未发」「还在做」「还没有做好的」。
- 库存条：`做好的够发到 {M} 月 {D} 日 · 还在做 {n} 条`，有新备注时追加 ` · {k} 条新备注`。

**长度上限**（`POST_LIMITS`）
- 日历短标题 40 字。
- 小红书标题 20 字，正文 1000 字。
- 标签最多 10 个，每个 20 字。
- 系列名 20 字；一次铺开最多 60 集。
- 备注 1000 字。
- 封面 3 MB。浏览器先压缩，Vercel 请求体上限是 4.5 MB。

## Review Focus

1. **成片链接被贴成 `javascript:` 或 `http:` 链接。** 它会当 `href` 渲染给客户。只收 `https:`，其他回「成片链接要以 https:// 开头」。→ Task 3 `cleanMediaUrl` 测试。
2. **发布链接的域名。** 必须是 `xiaohongshu.com`、`xhslink.com` 或它们的子域名；`xiaohongshu.com.evil.com`、前后带空格、带 `?xsec_token=` 参数的都要判对。→ Task 3 `isXhsUrl` 测试。
3. **赞藏数照小红书的写法填。** 比如 `1.2万`、`1万+`、`1,234`、`3w`，都要能解析；`abc` 要报错，不能悄悄存成 0。→ Task 3 `parseCount` 测试。
4. **粘贴的系列标题格式不齐。** 空行、前后空格、半角「图文:」和全角「图文：」都会出现。另外有人会粘贴带序号的标题，比如「1. 排行榜第一就最危险？」，序号要保留原样，不要误删。→ Task 3 `parseSeriesLines` 测试。
5. **跨月、跨夏令时。**
   - 系列从 10 月底铺到 11 月，正好跨过墨尔本 10 月第一个周日的夏令时切换。
   - 「今天」要按墨尔本算：UTC 周一 14:30 在墨尔本已经是周二。
   - 涉及这些的「差 N 天」、库存、铺开都不能差一天。→ Task 2 测试。

---

### Task 1: 数据库迁移

**Files:**
- Create: `supabase/migrations/20261028_post_calendar.sql`

**Interfaces:**
- Produces:
  - 表 `posts`，列名照下面写，后面所有任务都按这些列名读写。
  - 表 `post_notes`。
  - 列 `organizations.post_weekdays int[]`。

- [ ] **Step 1: 写迁移**

开头照现有迁移的写法，写注释说明「设计：docs/superpowers/specs/2026-10-27-content-calendar-design.md」。全部用 `if not exists` / `on conflict`，保证可以重复跑。

```sql
alter table public.organizations add column if not exists post_weekdays int[] not null default '{}';

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  publish_on date,
  kind text not null default 'video' check (kind in ('video', 'image')),
  is_extra boolean not null default false,
  title text not null,
  series text,
  episode int,
  stage text not null default 'planned' check (stage in ('planned','script','voice','cut','ready','published')),
  media_url text,
  cover_path text,
  script_id uuid references public.scripts(id) on delete set null,
  xhs_title text not null default '',
  xhs_body text not null default '',
  xhs_tags text[] not null default '{}',
  published_url text,
  published_at timestamptz,
  likes int, saves int, comments int,
  stats_at timestamptz,
  last_note_at timestamptz,
  last_note_by_admin boolean,
  admin_seen_at timestamptz,
  client_seen_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_org_day_idx on public.posts (org_id, publish_on);
create index if not exists posts_org_series_idx on public.posts (org_id, series);
alter table public.posts enable row level security;

create table if not exists public.post_notes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  org_id uuid not null,
  author_id uuid,
  kind text not null default 'note' check (kind in ('note', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_notes_post_idx on public.post_notes (post_id, created_at);
alter table public.post_notes enable row level security;

update public.organizations set post_weekdays = '{2,5}'
where name = '王小墨' and post_weekdays = '{}';
```

- [ ] **Step 2: 交给 Shawn 跑，跑完核对**

用 Supabase MCP `execute_sql`（只读）核对：

```sql
select name, post_weekdays from organizations;
select count(*) from posts;
```

期望：王小墨是 `{2,5}`，其他公司是 `{}`，`posts` 为 0 行。

---

### Task 2: 日历的日期逻辑

**Files:**
- Create: `src/lib/studio/calendar.ts`
- Test: `src/lib/studio/calendar.test.ts`

**Interfaces:**
- Consumes：从 `./week.ts` 引入 `DayKey`、`melbourneDay`。`addDays` 现在是私有的，在 `week.ts` 里把它改成 `export`，不改行为。
- Produces：

```ts
export type Month = string; // 'YYYY-MM'
export function monthOf(day: DayKey): Month;
export function shiftMonth(month: Month, n: number): Month;
export function monthGrid(month: Month): DayKey[][];   // 每行 7 天、周一开头，首尾补上前后月份的日子
export function isoWeekday(day: DayKey): number;       // 1 = 周一 … 7 = 周日
export function spreadDays(a: { start: DayKey; weekdays: number[]; count: number; taken: Set<DayKey> }): DayKey[];
export type StockItem = { publishOn: DayKey | null; isExtra: boolean; stage: Stage };
export function stockUntil(items: StockItem[], today: DayKey): DayKey | null;
export type DueWarning = { kind: 'short'; days: number } | { kind: 'overdue' } | null;
export function dueWarning(p: { publishOn: DayKey | null; stage: Stage }, today: DayKey): DueWarning;
export const SHORT_DAYS = 3;
```

`Stage` 从 Task 3 的 `./posts.ts` 引入（`import type`）。**先做 Task 3，再做 Task 2。**

- [ ] **Step 1: 写失败的测试**

```ts
test('monthGrid: 2026-11 starts on Mon 26 Oct and has 6 rows (30 Nov is a Monday)', () => {
  const g = monthGrid('2026-11');
  assert.equal(g[0][0], '2026-10-26');
  assert.equal(g.length, 6);
  assert.equal(g[4][6], '2026-11-29');
  assert.equal(g[5][0], '2026-11-30');
  assert.equal(g[5][6], '2026-12-06');
});
test('monthGrid: 2026-02 (starts on Sunday) begins Mon 26 Jan', () => assert.equal(monthGrid('2026-02')[0][0], '2026-01-26'));
test('shiftMonth: across a year boundary', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
test('isoWeekday: 2026-11-03 is a Tuesday', () => assert.equal(isoWeekday('2026-11-03'), 2));
test('spreadDays: Tue/Fri from Mon 2026-10-26 skips taken days and crosses into November', () => {
  assert.deepEqual(
    spreadDays({ start: '2026-10-26', weekdays: [2, 5], count: 4, taken: new Set(['2026-10-30']) }),
    ['2026-10-27', '2026-11-03', '2026-11-06', '2026-11-10'],
  );
});
test('spreadDays: start day itself counts when it is a publish weekday', () =>
  assert.deepEqual(spreadDays({ start: '2026-11-03', weekdays: [2], count: 1, taken: new Set() }), ['2026-11-03']));
test('spreadDays: crosses the DST change on 2026-10-04 without slipping a day', () =>
  assert.deepEqual(spreadDays({ start: '2026-10-01', weekdays: [1], count: 2, taken: new Set() }), ['2026-10-05', '2026-10-12']));
test('spreadDays: no weekdays → empty', () => assert.deepEqual(spreadDays({ start: '2026-11-01', weekdays: [], count: 3, taken: new Set() }), []));
test('stockUntil: stops before the first not-ready item, ignoring past, extra and unscheduled', () => {
  const items: StockItem[] = [
    { publishOn: '2026-10-27', isExtra: false, stage: 'planned' }, // 今天之前，不算
    { publishOn: '2026-11-03', isExtra: false, stage: 'ready' },
    { publishOn: '2026-11-05', isExtra: true, stage: 'planned' },  // 热点，不算
    { publishOn: '2026-11-06', isExtra: false, stage: 'published' },
    { publishOn: '2026-11-10', isExtra: false, stage: 'cut' },
    { publishOn: '2026-11-13', isExtra: false, stage: 'ready' },
    { publishOn: null, isExtra: false, stage: 'planned' },
  ];
  assert.equal(stockUntil(items, '2026-10-28'), '2026-11-06');
});
test('stockUntil: two posts on one day, one not ready → stops at the previous day', () => {
  assert.equal(stockUntil([
    { publishOn: '2026-11-03', isExtra: false, stage: 'ready' },
    { publishOn: '2026-11-06', isExtra: false, stage: 'ready' },
    { publishOn: '2026-11-06', isExtra: false, stage: 'script' },
  ], '2026-11-01'), '2026-11-03');
});
test('stockUntil: first item not ready → null', () =>
  assert.equal(stockUntil([{ publishOn: '2026-11-03', isExtra: false, stage: 'cut' }], '2026-11-01'), null));
test('dueWarning: 3 days out and not ready → short 3; 4 days → null; ready → null', () => {
  assert.deepEqual(dueWarning({ publishOn: '2026-11-03', stage: 'cut' }, '2026-10-31'), { kind: 'short', days: 3 });
  assert.equal(dueWarning({ publishOn: '2026-11-04', stage: 'cut' }, '2026-10-31'), null);
  assert.equal(dueWarning({ publishOn: '2026-11-03', stage: 'ready' }, '2026-10-31'), null);
});
test('dueWarning: same day → short 0; past and not published → overdue (even if ready)', () => {
  assert.deepEqual(dueWarning({ publishOn: '2026-11-03', stage: 'voice' }, '2026-11-03'), { kind: 'short', days: 0 });
  assert.deepEqual(dueWarning({ publishOn: '2026-11-03', stage: 'ready' }, '2026-11-04'), { kind: 'overdue' });
  assert.equal(dueWarning({ publishOn: '2026-11-03', stage: 'published' }, '2026-11-04'), null);
});
test('Melbourne today: Mon 14:30 UTC in daylight saving counts as Tuesday', () =>
  assert.equal(melbourneDay(new Date('2026-11-02T14:30:00Z')), '2026-11-03'));
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test -- --test-name-pattern="monthGrid|spreadDays|stockUntil|dueWarning|shiftMonth|isoWeekday"`
Expected: FAIL，找不到模块 `./calendar.ts`。

- [ ] **Step 3: 实现 `src/lib/studio/calendar.ts`**

- 日期加减用 `week.ts` 的 `addDays`（落在 UTC 正午）。
- `spreadDays` 从 `start` 一天天往后找，最多找 3 年就停。
- `stockUntil` 的算法见 spec 第 3 节：先只留 `publishOn >= today`、非热点、有日期的条目，按日期排序，从前往后看。遇到第一条 `stage` 不在 `ready`/`published` 的就停，同一天里只要有一条没好，那一天整天都不算。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test`
Expected: 全部 PASS，包括原来的 `week.test.ts`。

---

### Task 3: 进度规则、校验、红点、复制文案

**Files:**
- Create: `src/lib/studio/posts.ts`
- Test: `src/lib/studio/posts.test.ts`

**Interfaces:**
- Produces：

```ts
export type PostKind = 'video' | 'image';
export type Stage = 'planned' | 'script' | 'voice' | 'cut' | 'ready' | 'published';
export const STAGES: Stage[];
export function stagesFor(kind: PostKind): Stage[];              // 图文去掉 voice
export function stageLabel(stage: Stage, kind: PostKind): string; // 图文的 cut 叫「出图」
export type Tone = 'todo' | 'ready' | 'done';
export function toneOf(stage: Stage): Tone;
export const POST_LIMITS: { title: 40; xhsTitle: 20; xhsBody: 1000; tags: 10; tag: 20; series: 20; episodes: 60; note: 1000; coverBytes: number };
type Result<T> = { value: T; error: null } | { value: null; error: string };
export function parseSeriesLines(text: string): Result<{ title: string; kind: PostKind }[]>;
export function cleanMediaUrl(raw: string): Result<string | null>;      // 空 → null
export function isXhsUrl(raw: string): boolean;
export function parseCount(raw: string): Result<number | null>;        // 空 → null
export function cleanTags(raw: string[] | string): string[];            // 去掉开头的 #、空格，按 空格/逗号/# 拆
export type ReadyFields = { mediaUrl: string | null; xhsTitle: string; xhsBody: string };
export function readyMissing(p: ReadyFields): string[];                  // ['成片链接','小红书标题','小红书正文'] 中缺的
export function stageAfterLink(stage: Stage): Stage;                     // 早于 cut → cut，否则不变
export function checkStageChange(a: { from: Stage; to: Stage; kind: PostKind } & ReadyFields): string | null; // null = 可以
export type NoteMarks = { lastNoteAt: string | null; lastNoteByAdmin: boolean | null; adminSeenAt: string | null; clientSeenAt: string | null };
export function isUnread(m: NoteMarks, viewerIsAdmin: boolean): boolean;
export function copyText(p: { xhsTitle: string; xhsBody: string; xhsTags: string[] }): string;
export type PostEdit = Partial<{ publish_on: string | null; title: string; kind: PostKind; is_extra: boolean; series: string | null; episode: number | null; media_url: string | null; script_id: string | null; xhs_title: string; xhs_body: string; xhs_tags: string[]; stage: Stage; likes: number | null; saves: number | null; comments: number | null }>;
export function validateEdit(input: Record<string, unknown>, current: { stage: Stage; kind: PostKind } & ReadyFields): Result<PostEdit>;
```

`validateEdit` 的规则：
- 只认上面列出的键，别的键忽略。
- `stage` 交给 `checkStageChange` 判断。
- 已发布的条目不能改 `publish_on`，报「已发布的不能改日期」。
- 已发布的条目不能通过编辑改进度，报「要撤回请点「撤回已发布」」。撤回要走 Task 5 的 `unpublish`，因为它会清掉链接并记一条备注。
- 贴了 `media_url` 时，进度按 `stageAfterLink` 自动推进。
- 只要有 `likes`、`saves`、`comments` 中的任何一个，就在返回里加 `stats_at`，值是现在的时间。

`checkStageChange` 的规则：
- `to = 'published'` 不能直接设，报「要先贴发布链接」。
- `from = 'published'` 只能改到 `ready`（撤回）。
- 图文不能设成 `voice`。
- 设成 `ready` 时缺什么就报 `还缺：成片链接、小红书正文`。

- [ ] **Step 1: 写失败的测试**

```ts
test('stagesFor/stageLabel: image has no 配音 and cut reads 出图', () => {
  assert.ok(!stagesFor('image').includes('voice'));
  assert.equal(stageLabel('cut', 'image'), '出图');
  assert.equal(stageLabel('cut', 'video'), '成片');
});
test('toneOf: 4 working stages are todo, ready is ready, published is done', () => {
  assert.deepEqual(['planned','script','voice','cut'].map((s) => toneOf(s as Stage)), ['todo','todo','todo','todo']);
  assert.equal(toneOf('ready'), 'ready');
  assert.equal(toneOf('published'), 'done');
});
test('parseSeriesLines: blanks, spaces, 图文 prefixes in both widths, numbering kept', () => {
  const r = parseSeriesLines('  排行榜第一就最危险？ \n\n图文：商场的案子\n图文: 租房看哪个数\n视频：1. 拆不掉的区\n');
  assert.deepEqual(r.value, [
    { title: '排行榜第一就最危险？', kind: 'video' },
    { title: '商场的案子', kind: 'image' },
    { title: '租房看哪个数', kind: 'image' },
    { title: '1. 拆不掉的区', kind: 'video' },
  ]);
});
test('parseSeriesLines: empty → error; 61 lines → error; 41-char title → error', () => {
  assert.equal(parseSeriesLines(' \n ').error, '至少写一集');
  assert.match(parseSeriesLines(Array(61).fill('a').join('\n')).error!, /最多 60 集/);
  assert.match(parseSeriesLines('一'.repeat(41)).error!, /40 字/);
});
test('cleanMediaUrl: https OneDrive/Drive ok, trims; javascript:/http:/garbage rejected; empty → null', () => {
  assert.equal(cleanMediaUrl(' https://1drv.ms/v/s!abc ').value, 'https://1drv.ms/v/s!abc');
  assert.equal(cleanMediaUrl('https://drive.google.com/file/d/x/view').value, 'https://drive.google.com/file/d/x/view');
  for (const bad of ['javascript:alert(1)', 'http://1drv.ms/x', 'not a url']) assert.equal(cleanMediaUrl(bad).error, '成片链接要以 https:// 开头');
  assert.equal(cleanMediaUrl('  ').value, null);
});
test('isXhsUrl: real hosts and subdomains yes, look-alikes no', () => {
  for (const ok of ['https://www.xiaohongshu.com/explore/abc?xsec_token=x', ' http://xhslink.com/a/b ', 'https://xiaohongshu.com/discovery/item/1']) assert.ok(isXhsUrl(ok), ok);
  for (const bad of ['https://xiaohongshu.com.evil.com/x', 'https://evilxhslink.com/a', 'xiaohongshu.com/explore/1', '']) assert.ok(!isXhsUrl(bad), bad);
});
test('parseCount: 万 / w / + / commas', () => {
  assert.equal(parseCount('1.2万').value, 12000);
  assert.equal(parseCount('1万+').value, 10000);
  assert.equal(parseCount('3w').value, 30000);
  assert.equal(parseCount('1,234').value, 1234);
  assert.equal(parseCount(' 41 ').value, 41);
  assert.equal(parseCount('').value, null);
  assert.equal(parseCount('abc').error, '数字看不懂：abc');
});
test('cleanTags: strips # and splits on spaces/commas', () =>
  assert.deepEqual(cleanTags('#墨尔本租房 #犯罪率，墨尔本生活'), ['墨尔本租房', '犯罪率', '墨尔本生活']));
test('checkStageChange: published only via link; un-publish only to ready; image has no voice; ready needs fields', () => {
  const full = { mediaUrl: 'https://1drv.ms/x', xhsTitle: 't', xhsBody: 'b' };
  assert.equal(checkStageChange({ from: 'ready', to: 'published', kind: 'video', ...full }), '要先贴发布链接');
  assert.equal(checkStageChange({ from: 'published', to: 'cut', kind: 'video', ...full }), '已发布的只能撤回到「可发布」');
  assert.equal(checkStageChange({ from: 'published', to: 'ready', kind: 'video', ...full }), null);
  assert.equal(checkStageChange({ from: 'script', to: 'voice', kind: 'image', ...full }), '图文没有配音这一步');
  assert.equal(checkStageChange({ from: 'cut', to: 'ready', kind: 'video', mediaUrl: null, xhsTitle: 't', xhsBody: '' }), '还缺：成片链接、小红书正文');
});
test('validateEdit: media link bumps planned → cut; date change on published refused; stats add stats_at', () => {
  const cur = { stage: 'planned' as Stage, kind: 'video' as PostKind, mediaUrl: null, xhsTitle: '', xhsBody: '' };
  assert.equal(validateEdit({ media_url: 'https://1drv.ms/x' }, cur).value?.stage, 'cut');
  assert.equal(validateEdit({ publish_on: '2026-11-10' }, { ...cur, stage: 'published' }).error, '已发布的不能改日期');
  assert.equal(validateEdit({ stage: 'ready' }, { ...cur, stage: 'published' }).error, '要撤回请点「撤回已发布」');
  const s = validateEdit({ likes: '1.2万' }, { ...cur, stage: 'published' });
  assert.equal(s.value?.likes, 12000);
  assert.ok(typeof (s.value as Record<string, unknown>).stats_at === 'string');
});
test('isUnread: admin sees client notes newer than admin_seen_at; own notes never unread; never-seen counts', () => {
  const m = { lastNoteAt: '2026-11-01T10:00:00Z', lastNoteByAdmin: false, adminSeenAt: '2026-11-01T09:00:00Z', clientSeenAt: null };
  assert.equal(isUnread(m, true), true);
  assert.equal(isUnread(m, false), false);
  assert.equal(isUnread({ ...m, adminSeenAt: null }, true), true);
  assert.equal(isUnread({ ...m, lastNoteAt: null }, true), false);
});
test('copyText: title, blank line, body, blank line, #tags', () =>
  assert.equal(copyText({ xhsTitle: 'T', xhsBody: 'B', xhsTags: ['a', 'b'] }), 'T\n\nB\n\n#a #b'));
```

`validateEdit` 里的 `likes` 会收到字符串（页面上的输入框），所以它的入参是 `Record<string, unknown>`，内部用 `parseCount` 解析。

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: FAIL，找不到模块 `./posts.ts`。

- [ ] **Step 3: 实现 `src/lib/studio/posts.ts`**

- 字数一律按 `[...s].length` 算，和 `showcase.ts` 一样。
- `isXhsUrl`：用 `new URL(raw.trim())` 解析，协议是 `http:` 或 `https:`，`hostname` 等于 `xiaohongshu.com` / `xhslink.com`，或者以 `.xiaohongshu.com` / `.xhslink.com` 结尾。
- `POST_LIMITS.coverBytes = 3 * 1024 * 1024`。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test`
Expected: 全部 PASS。

---

### Task 4: 数据层 + 读月历、加一条、铺系列

**Files:**
- Create: `src/lib/studio/posts-db.ts`
- Create: `src/app/api/studio/posts/route.ts`（GET、POST）
- Create: `src/app/api/studio/posts/series/route.ts`（POST）

**Interfaces:**
- Consumes：
  - Task 2 的 `monthGrid`、`stockUntil`、`dueWarning`、`spreadDays`、`isoWeekday`。
  - Task 3 的 `isUnread`、`parseSeriesLines`、`POST_LIMITS`。
  - `server.ts` 的 `requireStudioUser`、`json`。
  - `audio.ts` 的 `PRIVATE_BUCKET`。
- Produces（`posts-db.ts`，页面的类型也从这里来）：

```ts
export type PostRow = { /* Task 1 的全部列，snake_case */ };
export const POST_COLUMNS: string;
export type CalendarPost = {
  id: string; publishOn: string | null; kind: PostKind; isExtra: boolean; title: string;
  series: string | null; episode: number | null; seriesTotal: number | null; stage: Stage;
  mediaUrl: string | null; coverUrl: string | null; scriptId: string | null;
  xhsTitle: string; xhsBody: string; xhsTags: string[];
  publishedUrl: string | null; publishedAt: string | null;
  likes: number | null; saves: number | null; comments: number | null; statsAt: string | null;
  unread: boolean; updatedAt: string;
};
export type CalendarData = {
  today: string; month: string; weekdays: number[]; isAdmin: boolean;
  posts: CalendarPost[]; unscheduled: CalendarPost[];
  stock: { until: string | null; making: number; unread: number };
  seriesNames: string[];
};
export async function postInScope(orgId: string, id: string): Promise<PostRow | null>;
export async function toCalendarPosts(rows: PostRow[], orgId: string, viewerIsAdmin: boolean): Promise<CalendarPost[]>; // 一次签全部封面、一次查系列总数
export async function loadMonth(orgId: string, month: string, viewerIsAdmin: boolean): Promise<CalendarData>;
export async function takenDays(orgId: string, from: string): Promise<Set<string>>; // 从 from 起已有非热点安排的日子
```

接口：
- `GET /api/studio/posts?month=YYYY-MM` → `CalendarData`。`month` 格式不对或没给，就用今天所在的月。
  - `posts` 是 `monthGrid` 首尾范围内有日期的条目。
  - `stock` 的计算范围是今天起所有已排日期的条目，不只这个月。
  - `making` 数的是今天起已排日期、进度还没到 ready 的条目。
  - `unread` 数的是全公司的条目。
- `POST /api/studio/posts`（管理员），body `{ title, kind, publishOn, isExtra, series?, episode? }` → `{ post: CalendarPost }`。
- `POST /api/studio/posts/series`（管理员），body `{ series, lines, start, weekdays, dryRun }`：
  - 先用 `parseSeriesLines` 解析。
  - `episode` 从这个系列现有的最大号 +1 开始。
  - 日子 = `spreadDays({ start, weekdays, count, taken: await takenDays(orgId, start) })`。
  - `weekdays` 为空，回 400「先选发在星期几」。
  - `dryRun: true` 时只回 `{ plan: [{ day, title, kind, episode }] }`，不写库。
  - 否则一条 insert 插入全部，回 `{ created: n }`。

- [ ] **Step 1: 实现 `posts-db.ts` 和两个接口**

照 `src/app/api/studio/showcase/route.ts` 的写法：
- 写一个 `gate()`，`export const runtime = 'nodejs'`。
- 签名链接签失败时回 502「图片暂时取不到，刷新一下再试」。
- `seriesTotal`：一次查这家公司所有 `series` 不为空的行，在内存里按系列名计数。
- `seriesNames` 去重排序。

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 没有错误。

- [ ] **Step 3: 本地核对**

在 3462 端口起 `npx next dev -p 3462`，登录管理员账号，在浏览器控制台运行：

```js
await (await fetch('/api/studio/posts/series',{method:'POST',headers:{'Content-Type':'application/json',...studioHeaders(await studioToken())},body:JSON.stringify({series:'测试卷',lines:'一\n图文：二',start:'2026-11-02',weekdays:[2,5],dryRun:true})})).json()
```

`studioHeaders`、`studioToken` 在控制台里拿不到。从 `/studio/calendar` 页面上的按钮触发也可以，这一步可以等 Task 8 做完再验。

Expected：`plan` 是 11/3 和 11/6 两条，第二条 `kind: 'image'`。

---

### Task 5: 改一条、删一条、撤回、贴发布链接、封面、固定发布日

**Files:**
- Create: `src/app/api/studio/posts/[id]/route.ts`（PATCH、DELETE）
- Create: `src/app/api/studio/posts/[id]/cover/route.ts`（POST）
- Create: `src/app/api/studio/org/route.ts`（PATCH）

**Interfaces:**
- Consumes：
  - Task 3 的 `validateEdit`、`isXhsUrl`、`checkStageChange`、`POST_LIMITS`。
  - Task 4 的 `postInScope`、`toCalendarPosts`。
  - `showcase.ts` 的 `sniffImage`、`imageExt`。
  - `audio.ts` 的 `putPrivate`、`removePrivate`。
- Produces：

`PATCH /api/studio/posts/[id]`（管理员）的 body 有三种：

| body | 做什么 | 返回 |
|---|---|---|
| `{ edit: Record<string, unknown> }` | 走 `validateEdit`，写库，并更新 `updated_at` | `{ post }` |
| `{ action: 'publish', url }` | 链接要通过 `isXhsUrl`，否则回「这不是小红书的链接」。写入 `stage='published'`、`published_url`（去掉前后空格）、`published_at = now`。已经是 published 时只改链接 | `{ post }` |
| `{ action: 'unpublish' }` | 只对 published 有效。改成 `stage='ready'`，`published_url`、`published_at` 置空，插一条 system 备注「撤回了已发布（原链接：…）」 | `{ post }` |

其余接口：
- `DELETE /api/studio/posts/[id]`（管理员）：已发布的回 400「已发布的不能删」；其他的删除行，同时删掉封面文件。返回 `{ ok: true }`。
- `POST /api/studio/posts/[id]/cover`（管理员，multipart 的 `file` 字段）：
  - 文件不超过 `POST_LIMITS.coverBytes`，类型按文件头认。
  - 存到 `posts/<orgId>/<postId>/cover-<随机>.jpg`，再删掉旧封面。
  - 返回 `{ post }`。
- `PATCH /api/studio/org`（管理员），body `{ weekdays: number[] }`：
  - 只留 1–7 的整数，去重、排序。
  - 写入 `organizations.post_weekdays where id = user.orgId`。
  - 返回 `{ weekdays }`。

动态参数照 Next 15 的写法：`{ params }: { params: Promise<{ id: string }> }`，用之前先 `await`。

- [ ] **Step 1: 实现三个接口**

删旧封面前，先核对路径以 `posts/<orgId>/` 开头，和 showcase 一样。

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 没有错误。

---

### Task 6: 备注

**Files:**
- Create: `src/app/api/studio/posts/[id]/notes/route.ts`（GET、POST、DELETE）

**Interfaces:**
- Consumes：
  - Task 4 的 `postInScope`。
  - `server.ts` 的 `peopleById`、`Person`。
  - Task 3 的 `POST_LIMITS.note`。
- Produces：

```ts
export type PostNote = { id: string; kind: 'note' | 'system'; body: string; createdAt: string; author: Person | null; mine: boolean };
```

`PostNote` 放在 `posts-db.ts` 里导出，页面也要用。

- `GET ?`：
  - 返回 `{ notes: PostNote[] }`，按时间从旧到新。
  - 同时更新 `admin_seen_at` 或 `client_seen_at` 为当前时间：管理员更新前者，公司成员更新后者。
  - 这里的「管理员」指 `user.isAdmin`。管理员切到自己公司（王小墨）时也算管理员。
- `POST { body }`：
  - 本公司成员和管理员都能写。
  - 去掉前后空格后不能为空，最多 1000 字。
  - 插入 `kind='note'`。
  - 同时更新 posts 的 `last_note_at = now`、`last_note_by_admin = user.isAdmin`，并把自己那一侧的 `*_seen_at` 也设成 now。
  - 返回最新的 `{ notes }`。
- `DELETE ?note=<id>`：
  - 只能删 `author_id = user.id` 的 `note`，`system` 不能删。
  - 查不到回 404。
  - 返回最新的 `{ notes }`。
  - 删掉的如果正好是最新的一条，`last_note_at` 不回退。这是有意的：红点最多多亮一次。

- [ ] **Step 1: 实现**

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 没有错误。

---

### Task 7: 日历页：月历、手机列表、库存条、标签、深链接

**Files:**
- Create: `src/app/studio/calendar/page.tsx`
- Create: `src/app/studio/calendar/usePosts.ts`
- Create: `src/app/studio/calendar/MonthGrid.tsx`
- Create: `src/app/studio/calendar/AgendaList.tsx`
- Create: `src/app/studio/calendar/PostChip.tsx`（格子里的一条，月历和列表共用）
- Create: `src/app/studio/calendar/StockBar.tsx`
- Modify: `src/app/studio/StudioShell.tsx`：`TABS` 最前面加 `{ href: '/studio/calendar', label: '日历', icon: <日历图标 path> }`；`switchTo(orgId, next = '/studio')`
- Modify: `src/app/studio/studio-me.tsx`：`switchTo: (orgId: string, next?: string) => void`

**Interfaces:**
- Consumes：
  - Task 4 的 `CalendarData`、`CalendarPost`。
  - Task 2 的 `monthGrid`、`shiftMonth`、`monthOf`、`dueWarning`、`isoWeekday`。
  - Task 3 的 `toneOf`、`stageLabel`。
  - `api.ts` 的 `studioFetch`。
  - `useScripts.ts` 的 `useIsDesktop`。
- Produces：

```ts
// usePosts.ts
export function usePosts(): {
  data: CalendarData | null; month: string; setMonth: (m: string) => void;
  reload: () => Promise<void>; replace: (p: CalendarPost) => void; remove: (id: string) => void;
};
// PostChip.tsx
export default function PostChip(props: { post: CalendarPost; today: string; onOpen: (id: string) => void }): JSX.Element;
```

页面行为：
- **电脑**（`useIsDesktop()` 为真）：`MonthGrid`。
  - 表头是「一 二 三 四 五 六 日」。
  - 固定发布日（`weekdays` 包含 `isoWeekday(day)`）用黄框 `#FEC03A`、底色 `#FFF8E6`。
  - 不在本月的日子淡一点。
  - 管理员点格子空白处，打开 Task 9 的「加一条」，日期预填为这一天。
- **手机**：`AgendaList`，按日期往下排。只列本月有条目的日子和固定日；固定日没有条目时显示「空着」。
- **格子颜色**照 spec 和样稿：
  - todo：虚线灰边，`#fafafa` 底。
  - ready：`#DDF3E4`。
  - done：`#EDE4FA`，并显示「❤ 赞 · ★ 藏」。
- **格子里的一条**：
  - 显示「视频 / 图文」、系列（`series episode/seriesTotal`）、标题。
  - 热点加红色「热点」标签（`#FDE2E1` 底、`#991b1b` 字）。
  - `dueWarning` 的结果显示成红字「差 N 天」或「过期未发」。
  - `unread` 时右上角显示红点。
- **月份导航**：‹ ›、「回到本月」、月份标题「2026 年 11 月」。
- **未排期**：月历下方一栏，可以折叠，写法照 `WeekView` 的「未排期」。
- **库存条**：文案照 Global Constraints；`until` 为空时显示「还没有做好的」。
- **深链接**：
  - 网址带 `?org=<id>&post=<id>` 时：
    - 如果是管理员，且 `org` 不是正在看的公司，调用 `ctx.switchTo(org, '/studio/calendar?post=<id>')`。
    - 否则打开那一条的面板，把月份切到它的 `publishOn` 所在月。
  - 只有 `?post=` 时，直接打开面板。
- 面板组件（Task 8）还没做时，`onOpen` 先只记 `selectedId`。

- [ ] **Step 1: 实现上面的文件，改 StudioShell 和 studio-me**

`switchTo` 改成：`writeViewing(orgId); setMe(null); setGate('checking'); router.push(next); loadMe();`。其他调用方不传 `next`，行为不变。

- [ ] **Step 2: 类型检查 + 测试**

Run: `npx tsc --noEmit && npm test`
Expected: 没有错误，测试全过。

- [ ] **Step 3: 本地看页面**

起 `npx next dev -p 3462`，打开 `http://localhost:3462/studio/calendar`。

Expected：
- 「日历」是第一个标签。
- 11 月的周二、周五有黄框。
- 库存条显示「还没有做好的」。
- 把浏览器窄到手机宽度，变成列表。

---

### Task 8: 面板

**Files:**
- Create: `src/app/studio/calendar/PostPanel.tsx`
- Create: `src/app/studio/calendar/StageBar.tsx`
- Create: `src/app/studio/calendar/NotesThread.tsx`
- Create: `src/app/studio/shrink.ts`：把 `showcase/upload.ts` 里的 `shrink` 搬过来，导出成 `shrinkImage(file: File, mode: 'square400' | 'fit1080'): Promise<Blob>`
- Modify: `src/app/studio/showcase/upload.ts`：改用 `shrinkImage`，行为不变
- Modify: `src/app/studio/calendar/page.tsx`：接上面板

**Interfaces:**
- Consumes：
  - Task 5、Task 6 的接口。
  - Task 3 的 `stagesFor`、`stageLabel`、`copyText`、`readyMissing`、`cleanMediaUrl`、`parseCount`。
  - `useScripts` 的 `useScripts()`，用来选要关联的口播稿。
  - `ui.tsx` 的 `PlayButton`、`showToast`。
  - `Avatar.tsx` 的 `Byline`。
- Produces：

```ts
export default function PostPanel(props: {
  post: CalendarPost; isAdmin: boolean; today: string;
  onChange: (p: CalendarPost) => void; onDelete: (id: string) => void; onClose: () => void;
}): JSX.Element;
```

面板从上到下照 spec 第 5 节：头、进度条、成片、小红书内容、口播稿、备注、按钮。

- 电脑上从右侧滑出，宽 480px，有遮罩，按 Esc 关闭。手机上全屏。
- **客户**（`!isAdmin`）：
  - 所有字段只读。
  - 不显示进度条上的点击、上传、按钮。
  - 只能写和删自己的备注。
- **管理员的进度条**：点某一步就 PATCH `{ edit: { stage } }`。服务端回的错误用 toast 显示原文。
- **成片**：
  - 有链接时显示「打开成片 ↗」（`target="_blank" rel="noopener noreferrer"`）。
  - 没有链接时，客户看到「还在做」，管理员看到一个输入框「贴成片链接（OneDrive / Google Drive）」。
- **口播稿**：
  - 关联了稿子时，显示正文（折叠）、`<PlayButton scriptId=... />`，以及链接 `/studio/s/<id>`。
  - 管理员看到下拉框「关联一条稿子」，选项来自 `useScripts()` 的标题，可以选「不关联」。
- **封面**（管理员）：点缩略图或「上传封面」选一张图，先 `shrinkImage(file, 'fit1080')`，再用 multipart POST 到 `/api/studio/posts/<id>/cover`。
- **按钮**：
  - 在「成片」这一步：「我审过了」，等于 PATCH `{ edit: { stage: 'ready' } }`，缺的东西由服务端报。
  - 「换日期」：一个 date 输入框，PATCH `{ edit: { publish_on } }`。
  - 「先不排」：PATCH `{ edit: { publish_on: null } }`。已发布的不显示这两个按钮。
  - 「复制标题+正文」：`navigator.clipboard.writeText(copyText(post))`，成功后 toast「已复制」。
  - 「已发布 · 贴链接」：弹出一个输入框，提交 `{ action: 'publish', url }`。
  - 「撤回已发布」：先确认。不要用 `window.confirm`，用面板内的二次确认按钮。
  - 删除：同样用二次确认，已发布的不显示删除。
  - 赞、藏、评三个输入框，失焦就保存。
- **备注**：打开面板时 GET 一次，这同时会清掉红点。之后调用页面的 `replace({...post, unread: false})`。

- [ ] **Step 1: 搬 `shrinkImage`，确认主页预览照常上传**

Run: `npx tsc --noEmit`
Expected: 没有错误。

- [ ] **Step 2: 实现面板三个组件，接到 page**

- [ ] **Step 3: 类型检查 + 测试**

Run: `npx tsc --noEmit && npm test`
Expected: 没有错误，测试全过。

---

### Task 9: 排一个系列、加一条、固定发布日设置

**Files:**
- Create: `src/app/studio/calendar/SeriesDialog.tsx`
- Create: `src/app/studio/calendar/AddPostDialog.tsx`
- Create: `src/app/studio/calendar/WeekdayPicker.tsx`
- Modify: `src/app/studio/calendar/page.tsx`：月历上方加「排一个系列」「加一条」和固定发布日设置（只给管理员）

**Interfaces:**
- Consumes：
  - Task 4 的 `POST /api/studio/posts`、`POST /api/studio/posts/series`（含 `dryRun`）。
  - Task 5 的 `PATCH /api/studio/org`。
  - `CalendarData.seriesNames`、`CalendarData.weekdays`。
- Produces：三个对话框组件。每个组件接收 `onDone: () => void`，用来让页面 `reload()`。

行为：
- **SeriesDialog**：
  - 系列名用输入框加 datalist，选项是 `seriesNames`。
  - 每集标题是 textarea，占位文字写「一行一集；行首写「图文：」就是图文」。
  - 「从哪天开始」是 date 输入框，默认今天。
  - 「发在星期几」是 `WeekdayPicker`，默认这家公司的 `weekdays`。
  - 输入停下 400ms 后用 `dryRun` 取预览，在右边（手机上是下方）列出「11/3 周二 · 安全 2/8 · 排行榜第一就最危险？」。
  - 「确认排上」后关闭对话框，页面 reload，并跳到第一集所在的月份。
- **AddPostDialog**：标题、视频/图文、日期（可以留空，表示未排期）、勾选「热点」。
- **WeekdayPicker**：7 个可以切换的按钮「一 … 日」。
  - 在页面上作为「固定发布日」设置，改动后立即 PATCH `/api/studio/org`。
  - 客户看不到这个设置。

- [ ] **Step 1: 实现三个组件并接进页面**

- [ ] **Step 2: 类型检查 + 测试**

Run: `npx tsc --noEmit && npm test`
Expected: 没有错误，测试全过。

---

### Task 10: 整体验证（本地）

**Files:** 不改文件。发现问题就回到对应的任务去改。

- [ ] **Step 1: 全部检查**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: 都通过。`build` 不能有新的警告页面。

- [ ] **Step 2: 用浏览器走一遍（管理员 → 王小墨）**

起 `npx next dev -p 3462`，按顺序做：
1. 排一个系列「测试卷」3 集（第 2 集写「图文：」），从下周一开始。预览和建好的日子都应该落在周二、周五。
2. 打开第 1 集：贴成片链接 `https://1drv.ms/v/test`，进度自动到「成片」。点「可发布」，应该提示「还缺：小红书标题、小红书正文」。填好后再点，格子变绿，库存条显示「做好的够发到 …」。
3. 贴发布链接 `https://example.com`，应该被拒绝。改贴 `https://www.xiaohongshu.com/explore/test`，格子变紫。填赞「1.2万」，保存后显示 12000。
4. 撤回已发布，格子变回绿色，备注里出现一条 system 备注。
5. 在任意一天加一条热点，显示红色标签，后面的系列不动。
6. 删掉第 3 集，第 1、2 集的「n/3」变成「n/2」。
7. 打开第 2 集，写一条备注。

- [ ] **Step 3: 客户视角**

用一个客户公司的成员账号走一遍。没有的话，请 Shawn 提供 Vtax 的测试账号，或者问他用哪个。

1. 只能看到自己公司的日历，看不到排系列、加一条、固定发布日。
2. 面板里只能看、能写备注。
3. 在浏览器控制台直接对一条发 `PATCH /api/studio/posts/<id>`，应该回 403。
4. 用管理员账号回到这条，应该有红点；打开后红点消失。

- [ ] **Step 4: 清掉测试数据**

用 Supabase MCP 删掉 `series = '测试卷'` 的行和热点测试行。删之前先 select 出来给 Shawn 看。

- [ ] **Step 5: 报告**

报「已改好未提交，等你确认」，同时列出：
- 改了和新建了哪些文件；
- 测试数；
- 走查结果；
- 迁移是否已跑。

然后停下。
