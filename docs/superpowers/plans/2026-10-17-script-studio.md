# 口播工作台（第一期）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在网站上加一个手机优先的「口播工作台」`/studio`：从灵感库拉选题到自己的口播库、按自己的风格反复生成多版并核对事实、按「要录完的日期」排周历、用自己的 Fish 声音试听。

**Architecture:** Next.js App Router 新路由 `/studio`（浅色，照 App 设计规范），客户端用现有 `browserSupabase()` 拿会话、带 Bearer 调新的 `/api/studio/*`；服务端用 service key 读写 Supabase。纯逻辑（周历分组、数字核对、标记扫描、提示词对比、复核结果解析）放 `src/lib/studio/` 无依赖模块，用 Node 24 自带 `node --test` 直接跑 `.ts`。稿子仍存在 App 在用的 `scripts` 表，版本另存 `script_versions`。

**Tech Stack:** Next.js 15 / React 19 / Tailwind 4 / Supabase (Postgres, Storage, Auth) / DeepSeek `deepseek-chat` / Fish Audio TTS + `POST /model` / Node 24 `node:test`

**Spec:** `docs/superpowers/specs/2026-10-17-script-studio-design.md`（执行者两份都要读）

## Global Constraints

- **不许自动 commit / push。** Shawn 的规矩：每批改动先本地验证（`npx tsc --noEmit`、`npm test`、`npm run build`），报告「已改好未提交，等你确认」后停下。下面各任务的「检查点」就是这个，不是 `git commit`。
- 稿子写在现有 `scripts` 表；新列一律可空或有默认值（App 的 upsert 只写 `id/title/body/source/status/sort_order/code/user_id`，不能被新列卡住）。
- `scripts.source` 只用 `fordexa` / `self`，`status` 只用 `ready` / `recorded` / `archived`——App 只认这些。
- 稿子 ↔ 选题的关联用 `scripts.code` = `idea_bank.code`（App 加稿子时已经这样写）。文章 = 该选题自身 `article`，否则父行（`parent_id`）的 `article`；出处 = 同一行的 `refs`（`[{label,url}]`），自身没有就用父行的。
- 固定事实规则不进任何可编辑提示词；标记原文固定为：`【这条信息文章里没有，需要联系 Fordexa 补充调研：<缺什么>】`
- 时区一律 `Australia/Melbourne`；周 = 周一到周日。
- 第一期 `/studio` 和 `/api/studio/*` 只对管理员（`profiles.is_admin`）开放，但所有数据按 `user_id` 归属。
- 视觉照抄 `C:\Users\habit\Local Sites\prompter\docs\redesign\01-design-tokens.md`：主色 `#0F7B45`、底 `#F2F4F3`、卡片白底圆角 16 无阴影（首页大卡片 20）、行高 56、按钮高 56 圆角 16、页面标题 22/700、页面左右边距 20、可点区域 ≥ 44×44、底部标签栏（56×28 圆角 14 的图标块，选中 `#E2F2E9` 底）。网站 `globals.css` 浅色变量已是同一套色值，直接用 `var(--accent)` 等。
- 新文件单个不超过 400 行；不再往 `src/app/admin/page.tsx`（1745 行）里加东西。
- 写稿模型沿用 DeepSeek（`DEEPSEEK_API_KEY`）；TTS 沿用 Fish（`FISH_API_KEY`），Shawn 的声音 ID `8382e1c04b8f4e56b91a8e30be619e49`，默认声音仍是 `FISH_VOICE`。
- 训练录音与个人试听音频放私有桶 `studio-private`，播放用短期签名链接；训练录音在 Fish 建模成功后删除。

## Review Focus

1. **App 里加的、没有任何版本记录的稿子**（只有 `code`）点「按我的风格生成」——应自动补一条「Fordexa 原版」版本再生成，不报错。（Task 7 测）
2. **App 里自己写的稿子**（`code` 为空）——稿子页不显示「按我的风格生成」，接口返回 400「这条不是从灵感库拉的，没有文章可依据」。（Task 7 测）
3. **墨尔本周日深夜 / 周一凌晨**——UTC 时间 `2026-10-18T14:30:00Z` 在墨尔本是周一 10 月 19 日，必须算进新的一周。（Task 2 测）
4. **复核 AI 返回的不是合法 JSON 或被截断**——不影响拿到稿子，显示「复核没跑成，可重试」。（Task 4 测解析，Task 7 测接口）
5. **数字写法不同**——稿子写「1.2 万」「一万二」，文章写「12,000」，应算找到；稿子写「15%」文章只有「百分之十五」也算找到；文章里没有的「3 个月」要标出。（Task 3 测）

---

## 文件结构

```
supabase/migrations/20261017_script_studio.sql   表结构 + 私有桶 + Fordexa 公司种子
src/lib/studio/week.ts            周历：墨尔本今天、周范围、分组（纯函数）
src/lib/studio/figures.ts         数字抽取、归一化、找不到依据的数字（纯函数）
src/lib/studio/markers.ts         【待补调研】标记扫描（纯函数）
src/lib/studio/prompt-diff.ts     两份提示词逐行对比（纯函数）
src/lib/studio/claims.ts          复核提示词常量 + 复核结果解析（纯函数）
src/lib/studio/fact-rules.ts      固定事实规则常量 + 拼「依据材料」+ 截断（纯函数）
src/lib/studio/*.test.ts          以上各自的测试
src/lib/deepseek.ts               DeepSeek 调用（从 draft 路由抽出来）
src/lib/studio/server.ts          requireStudioUser、取选题与文章、取/建版本（服务端）
src/lib/studio/audio.ts           私有桶存取、签名链接
src/lib/voice.ts                  resolveVoice()
src/lib/tts.ts                    改：synthesize(text, voiceId)
src/app/api/studio/scripts/route.ts      GET 我的稿子 / PATCH 改稿
src/app/api/studio/pull/route.ts         POST 拉选题
src/app/api/studio/versions/route.ts     GET 版本列表 / POST 用这版
src/app/api/studio/generate/route.ts     POST 按我的风格生成一版
src/app/api/studio/review/route.ts       POST 核对（数字 + AI 逐句）
src/app/api/studio/audio/route.ts        POST 试听
src/app/api/studio/prompt/route.ts       GET / PUT 我的写稿提示词
src/app/api/studio/voice/route.ts        GET / PUT 声音 ID，POST 试一句
src/app/api/studio/voice/train/route.ts  POST 上传地址 / PUT 训练
src/app/studio/layout.tsx         浅色外壳 + 鉴权 + 底部标签栏（手机）/ 顶栏（电脑）
src/app/studio/StudioShell.tsx    客户端：会话、标签栏、未登录/无权限落点
src/app/studio/api.ts             客户端 fetch 封装（带 Bearer）
src/app/studio/page.tsx           口播库（本周）
src/app/studio/ideas/page.tsx     灵感库 + 拉到我这里
src/app/studio/s/[id]/page.tsx    稿子页（编辑、版本、提示词、核对、试听）
src/app/studio/s/[id]/*.tsx       稿子页的子组件（版本切换、提示词面板、高亮正文、播放器）
src/app/studio/me/page.tsx        我的（声音、写稿提示词）
```

---

### Task 0: 环境与测试基础

**Files:**
- Modify: `tsconfig.json`（`compilerOptions` 加 `"allowImportingTsExtensions": true`）
- Modify: `package.json`（`scripts.test`）
- Create: `scripts/fish-smoke.mjs`

- [ ] **Step 1:** 请 Shawn 在项目目录跑 `! npx vercel link` 和 `! npx vercel env pull .env.local`（本地没有任何环境变量，`.env*.local` 已在 `.gitignore`）。确认 `.env.local` 里有 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`、`SUPABASE_SERVICE_KEY`、`DEEPSEEK_API_KEY`、`FISH_API_KEY`（只看变量名，不打印值）。
- [ ] **Step 2:** `package.json` 加 `"test": "node --test \"src/**/*.test.ts\" \"scripts/**/*.test.mjs\""`。tsconfig 加 `allowImportingTsExtensions`（`noEmit` 已是 true）。
- [ ] **Step 3:** 写 `scripts/fish-smoke.mjs`：读 `.env.local` 的 `FISH_API_KEY`，用 `reference_id: '8382e1c04b8f4e56b91a8e30be619e49'`、`model: s1` 合成「这是一句测试。」存到 scratchpad，打印 HTTP 状态和字节数；再 `GET https://api.fish.audio/model?self=true&page_size=1` 打印返回里的总数字段（查文档确认字段名）。
- [ ] **Step 4:** 跑 `node scripts/fish-smoke.mjs`。期望：200 + 非零字节（证明 key 与 Shawn 声音同账号）。若 402/403/404，停下报告 Shawn（key 不是这个账号，或 API 余额与网页套餐分开计费）。
- [ ] **Step 5:** `npm test` 期望：现有 `scripts/preview-idea/lib.test.mjs` 5 个通过。

### Task 1: 数据库迁移

**Files:**
- Create: `supabase/migrations/20261017_script_studio.sql`

内容（全部 `if not exists`，可重复执行）：
- `scripts` 加列：`record_by date`、`audio_path text`、`audio_hash text`、`audio_at timestamptz`、`checks jsonb`（当前正文的核对结果）。
- 新表 `script_versions`：`id uuid pk default gen_random_uuid()`、`script_id uuid not null references scripts(id) on delete cascade`、`user_id uuid not null`、`kind text not null check (kind in ('fordexa','generated'))`、`n int not null`（Fordexa 原版 = 0，生成的从 1 递增）、`body text not null`、`prompt text`（生成时用的可编辑提示词快照）、`checks jsonb`、`created_at timestamptz default now()`；`unique (script_id, n)`；索引 `(script_id)`；`enable row level security` 且**不建任何 policy**（只走服务端）。
- `profiles` 加 `voice_id text`；`organizations` 加 `voice_id text`、`draft_prompt text`（公司的可编辑写稿提示词 B；空 = 用 `DEFAULT_PROMPT`）。
- 私有桶：`insert into storage.buckets (id, name, public) values ('studio-private','studio-private', false) on conflict do nothing`。
- 种子：没有 `name = 'Fordexa'` 的公司就插一条（`is_active = true`）；把 `auth.users.email = 'wangxiaounsw@gmail.com'` 对应的 `profiles.org_id` 设成它（仅当当前 `org_id` 为空）；`profiles.voice_id` 设为 `'8382e1c04b8f4e56b91a8e30be619e49'`（仅当为空）。

- [ ] **Step 1:** 写 SQL 文件。
- [ ] **Step 2:** 应用：把文件内容交给 Shawn 在 Supabase SQL Editor 执行（或 Shawn 提供数据库连接串后用 `psql -f`）。**执行前把 SQL 给 Shawn 看。**
- [ ] **Step 3:** 验证：用 service key 写个一次性脚本查 `script_versions` 可读、`studio-private` 桶存在且非公开、Shawn 的 profile 有 `org_id` 和 `voice_id`。

### Task 2: 周历纯逻辑

**Files:**
- Create: `src/lib/studio/week.ts`, `src/lib/studio/week.test.ts`

**Interfaces — Produces:**
```ts
export type DayKey = string; // 'YYYY-MM-DD'
export type WeekItem = { id: string; record_by: DayKey | null; status: 'ready' | 'recorded' | 'archived' };
export function melbourneDay(now: Date): DayKey;
export function weekOf(day: DayKey): { start: DayKey; end: DayKey; days: DayKey[] }; // 周一..周日 7 天
export function shiftWeek(day: DayKey, weeks: number): DayKey;
export function groupWeek<T extends WeekItem>(items: T[], today: DayKey, weekStart: DayKey):
  { overdue: T[]; days: Record<DayKey, T[]>; unscheduled: T[]; next: T | null };
```
规则：`archived` 全部忽略；`overdue` = `ready` 且 `record_by < today`（不论在不在本周），按日期升序；`days` 只含本周 7 天，每天内 `ready` 在前 `recorded` 在后；`unscheduled` = `ready` 且无日期；`next` = `overdue[0]` ?? 今天及以后最早的 `ready` ?? null。

- [ ] **Step 1: 写测试**（`import { test } from 'node:test'; import assert from 'node:assert/strict'; import {...} from './week.ts'`）
  - `melbourneDay(new Date('2026-10-18T14:30:00Z')) === '2026-10-19'`（夏令时 +11，周一）
  - `melbourneDay(new Date('2026-06-30T13:59:00Z')) === '2026-06-30'`（冬令 +10，23:59）
  - `weekOf('2026-10-17').start === '2026-10-13'`、`.end === '2026-10-19'`、`days.length === 7`
  - `weekOf('2026-10-19').start === '2026-10-13'`（周日属于本周）
  - `shiftWeek('2026-10-17', 1)` 落在 `'2026-10-20'` 那一周（返回该周任一天均可，断言 `weekOf(...).start === '2026-10-20'`）
  - `groupWeek`：today `2026-10-17`；items：A ready `2026-10-13`、B ready `2026-10-17`、C recorded `2026-10-17`、D ready null、E archived `2026-10-17`、F ready `2026-10-01` → `overdue` ids `['F','A']`，`days['2026-10-17']` ids `['B','C']`，`unscheduled` `['D']`，`next.id === 'F'`，E 不出现在任何地方
- [ ] **Step 2:** `npm test` → FAIL（模块不存在）
- [ ] **Step 3:** 实现。时区用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year:'numeric', month:'2-digit', day:'2-digit' })`；日期加减用 UTC 正午的 `Date` 避免夏令时跳变。
- [ ] **Step 4:** `npm test` → PASS

### Task 3: 数字核对纯逻辑

**Files:**
- Create: `src/lib/studio/figures.ts`, `src/lib/studio/figures.test.ts`

**Interfaces — Produces:**
```ts
export function extractFigures(text: string): string[];      // 原样片段，去重，按出现顺序
export function normalizeFigure(raw: string): string | null;  // 归一成可比较的键，非数字返回 null
export function unsupportedFigures(script: string, sourceText: string): string[]; // 稿子里在依据材料中找不到的原样片段
```
抽取范围：阿拉伯数字（含小数、千分位逗号、全角数字）连同紧跟的单位/量词（`%`、`万`、`千`、`亿`、`元`、`块`、`澳币`、`岁`、`年`、`个月`、`月`、`天`、`周`、`次`、`倍`）；前置 `$`/`A$`；中文数字串（`零一二两三四五六七八九十百千万亿` 组成，长度 ≥ 1，且后面跟上面的单位，避免把「一个人」「一下」当数字）；`百分之X`。年份（`2025年`）归一为 `y:2025`。归一规则：数值换算成阿拉伯数字（`1.2万`→`12000`，`一万二`→`12000`，`12,000`→`12000`，`百分之十五`/`15%`→`pct:15`），带时间单位的保留单位（`3个月`→`3:个月`）。依据材料先把所有片段抽出来归一，再判断稿子的每个键在不在集合里。宁可多标：解析不了的片段视为找不到。

- [ ] **Step 1: 写测试**
  - `unsupportedFigures('按去年 1.2 万的收入算', '应税投资收入 12,000 澳币') → []`
  - `unsupportedFigures('大概一万二', '12,000') → []`
  - `unsupportedFigures('税率 15%', '税率为百分之十五') → []`
  - `unsupportedFigures('等 3 个月再交', '一般需要 30 天') → ['3 个月']`
  - `unsupportedFigures('2025年起', '自 2025 年 7 月 1 日起') → []`
  - `unsupportedFigures('一个人去办一下', '') → []`（不是数字）
  - `extractFigures('$1,500 和 ２０ 天') ` 含 `'$1,500'` 和 `'２０ 天'`
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** 实现（正则抽取 + 小型中文数字解析器；单位前允许空格）
- [ ] **Step 4:** `npm test` → PASS

### Task 4: 标记、提示词对比、复核解析、依据材料

**Files:**
- Create: `src/lib/studio/markers.ts`, `prompt-diff.ts`, `claims.ts`, `fact-rules.ts` 及各自 `.test.ts`

**Interfaces — Produces:**
```ts
// markers.ts
export const RESEARCH_MARK_HEAD = '【这条信息文章里没有，需要联系 Fordexa 补充调研';
export function researchMarks(body: string): string[]; // 每个完整【…】标记的原文

// prompt-diff.ts
export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string };
export function diffLines(before: string, after: string): DiffLine[]; // 按行 LCS
export function changeCount(before: string, after: string): number;  // 连续的 add/del 段算一处

// claims.ts
export const CLAIM_REVIEW_PROMPT: string;
export type Claim = { sentence: string; missing: string };
export function parseClaimReview(raw: string): Claim[] | null; // 解析失败返回 null

// fact-rules.ts
export const FACT_RULES: string;
export const SOURCE_LIMIT = 24000; // 字符
export type SourceInput = { title: string; original: string; article: string | null; refs: { label: string; url: string }[] };
export function buildSourceText(s: SourceInput): { text: string; truncated: boolean };
```
`FACT_RULES` 正文（固定文案，原样写入）：
```
以下规则优先于上面的一切要求，不可违反：
1. 只能使用下面「依据材料」里出现的信息：选题标题、Fordexa 原稿、文章正文、出处列表。
2. 依据材料里没有的事实（规定、金额、门槛、比例、年份、日期、资格条件、流程步骤）一律不许写，也不许凭常识补。
3. 讲清楚这件事确实需要、但依据材料里没有的信息，在稿子相应位置原样插入：【这条信息文章里没有，需要联系 Fordexa 补充调研：<缺什么>】
4. 只输出口播稿正文。
```
`CLAIM_REVIEW_PROMPT`：要求逐句检查「口播稿」中的事实性说法能否在「依据材料」中找到依据，只输出 JSON：`{"unsupported":[{"sentence":"<稿子原句>","missing":"<缺什么>"}]}`，全部有依据输出 `{"unsupported":[]}`；【…补充调研】标记句不算。
`parseClaimReview`：容忍 ```json 代码块包裹和前后杂字（取第一个 `{` 到最后一个 `}`）；`unsupported` 不是数组或元素缺 `sentence` 返回 null。
`buildSourceText`：分段 `【选题】…【Fordexa 原稿】…【文章】…【出处】- label url`；总长超 `SOURCE_LIMIT` 时只截文章段末尾，`truncated: true`。

- [ ] **Step 1: 写测试**
  - `researchMarks('a【这条信息文章里没有，需要联系 Fordexa 补充调研：门槛】b') ` 长度 1；无标记 → `[]`
  - `changeCount('a\nb\nc', 'a\nB\nc') === 1`；`changeCount('a\nb', 'a\nb') === 0`；`changeCount('a\nb\nc\nd', 'X\nb\nc\nY') === 2`
  - `parseClaimReview('```json\n{"unsupported":[{"sentence":"必须有雇主担保","missing":"担保要求"}]}\n```')` → 1 条
  - `parseClaimReview('{"unsupported":[]}')` → `[]`；`parseClaimReview('好的，以下是')` → `null`；`parseClaimReview('{"unsupported":[{"sentence"')` → `null`
  - `buildSourceText` 文章 30000 字 → `truncated === true` 且 `text.length <= SOURCE_LIMIT + 2000`（其余段落完整）；短文章 → `truncated === false` 且含每条出处的 url
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** 实现
- [ ] **Step 4:** `npm test` → PASS

### Task 5: 服务端基础件

**Files:**
- Create: `src/lib/deepseek.ts`, `src/lib/voice.ts`, `src/lib/studio/server.ts`, `src/lib/studio/audio.ts`
- Modify: `src/app/api/admin/draft/route.ts`（改用 `chatDeepSeek`，行为不变）
- Modify: `src/lib/tts.ts`（`synthesize(text: string, voiceId: string = FISH_VOICE)`，`reference_id: voiceId`；现有调用不传第二参数，行为不变）

**Interfaces — Produces:**
```ts
// deepseek.ts
export async function chatDeepSeek(opts: { system: string; user: string; temperature: number; maxTokens: number; timeoutMs?: number }): Promise<string>; // 失败抛 Error（消息给人看的中文）
// voice.ts
export async function resolveVoice(userId: string): Promise<{ voiceId: string; from: 'me' | 'org' | 'default' }>;
// studio/server.ts
export async function requireStudioUser(request: NextRequest): Promise<{ id: string; email: string; orgId: string | null } | null>; // 第一期 = 管理员
export type IdeaSource = { code: string; title: string; script: string; article: string | null; refs: Ref[] };
export async function ideaByCode(code: string): Promise<IdeaSource | null>; // 自身无 article/refs 时取父行
export async function ownScript(userId: string, id: string): Promise<ScriptRow | null>; // 不是本人的返回 null
export async function ensureFordexaVersion(script: ScriptRow): Promise<void>; // 无 n=0 版本且有 code 时，用选题原稿补一条
export async function orgDraftPrompt(orgId: string | null): Promise<string>; // organizations.draft_prompt ?? DEFAULT_PROMPT
export type ScriptRow = { id: string; user_id: string; title: string; body: string; source: string; status: string; code: string | null; record_by: string | null; audio_path: string | null; audio_hash: string | null; checks: unknown };
// studio/audio.ts
export async function putPrivate(path: string, data: Buffer, contentType: string): Promise<void>;
export async function signedUrl(path: string, seconds?: number): Promise<string>; // 默认 3600
export async function removePrivate(paths: string[]): Promise<void>;
```

- [ ] **Step 1:** 实现以上；`requireStudioUser` 基于 `requestUser` + `profiles.is_admin, org_id`。
- [ ] **Step 2:** `npx tsc --noEmit` 通过；`npm test` 仍全绿。
- [ ] **Step 3:** 手测 `/admin` 里「AI 起草稿」仍能出稿（`npm run dev`，Shawn 登录后试一次）。

### Task 6: 我的稿子 + 拉选题 API

**Files:**
- Create: `src/app/api/studio/scripts/route.ts`, `src/app/api/studio/pull/route.ts`

响应格式沿用现有路由：成功 `{ ...data }`，失败 `{ error: '<中文>' }`，均 `Cache-Control: no-store`；未登录/非管理员 403。

- `GET /api/studio/scripts` → `{ scripts: (ScriptRow & { research: number; hasAudio: boolean; versions: number })[], today: DayKey }`：本人、非 `archived`；`research` = `researchMarks(body).length`；`hasAudio` = `audio_hash === scriptHash(body)`；`today` = `melbourneDay(new Date())`。
- `PATCH /api/studio/scripts` body `{ id, title?, body?, status?, record_by?: DayKey | null }` → 只改本人的；`record_by` 校验 `/^\d{4}-\d{2}-\d{2}$/` 或 null；`body` 改了就把 `checks` 置 null。
- `POST /api/studio/pull` body `{ code }` → 找到已发布且有 `script` 的选题（`ideaByCode`），插 `scripts`（`title`、`body = script.trim()`、`source 'fordexa'`、`code`、`status 'ready'`、`sort_order 0`、`record_by null`），再插 `script_versions` n=0 kind `fordexa`；返回 `{ id }`。没找到 404「这条选题没有口播稿」。

- [ ] **Step 1:** 实现
- [ ] **Step 2:** `npx tsc --noEmit`
- [ ] **Step 3:** 手测（dev + 浏览器控制台带 token fetch，或临时脚本）：拉 `FX-0003` → `scripts` 多一行、`script_versions` 一行 n=0；GET 能看到它；PATCH `record_by: '2026-10-20'` 生效；用另一个用户 id 的稿子 PATCH → 404。

### Task 7: 版本、生成、核对 API

**Files:**
- Create: `src/app/api/studio/versions/route.ts`, `src/app/api/studio/generate/route.ts`, `src/app/api/studio/review/route.ts`

- `GET /api/studio/versions?scriptId=` → 先 `ensureFordexaVersion`，返回 `{ versions: { id, kind, n, body, prompt, checks, created_at }[] }` 按 n 升序。
- `POST /api/studio/versions` body `{ versionId }` →「用这版」：把稿子 `body` 设为该版 `body`，`checks` 设为该版 `checks`；返回 `{ ok: true }`。
- `POST /api/studio/generate` body `{ scriptId, prompt?: string }`（`maxDuration = 60`）：
  - 稿子 `code` 为空 → 400「这条不是从灵感库拉的，没有文章可依据」。
  - `ensureFordexaVersion`；`prompt` 未传用 `orgDraftPrompt(orgId)`；截 8000 字。
  - system = `prompt + '\n\n' + FACT_RULES`；user = （公司有 `style_samples` 时先放「下面是他们以前口播的文字稿，照着这个语感写：」+ 样本，与 draft 路由同文案）+ `buildSourceText(...)`.text；温度 1.1、maxTokens 2000（同 draft 路由）。
  - 立刻算 `unsupportedFigures(draft, sourceText)`，插新版本（n = 当前最大 + 1，kind `generated`，`prompt` 快照，`checks = { figures, claims: null, claimsFailed: false, truncated }`）。
  - 返回 `{ version }`。**不在这里调复核**（两次模型调用会超 60 秒），前端拿到后立刻调 review。
- `POST /api/studio/review` body `{ versionId }` 或 `{ scriptId }`（后者核对当前正文）（`maxDuration = 60`）：重算 `figures`；`chatDeepSeek({ system: CLAIM_REVIEW_PROMPT, user: '【口播稿】\n' + body + '\n\n' + sourceText, temperature: 0, maxTokens: 1500 })` → `parseClaimReview`；解析失败或请求失败 → `claims: null, claimsFailed: true`（HTTP 仍 200）。写回对应行的 `checks`，返回 `{ checks }`。Fordexa 原版（n=0）调 review 返回 400。

`checks` 形状（三处一致）：`{ figures: string[]; claims: Claim[] | null; claimsFailed: boolean; truncated: boolean }`

- [ ] **Step 1:** 实现
- [ ] **Step 2:** `npx tsc --noEmit`
- [ ] **Step 3: 手测 Review Focus 1、2、4**
  - App 里从灵感库加一条（只有 code、无版本）→ GET versions 自动出现 n=0；generate 成功出 n=1
  - App 里「自己写一条」→ generate 返回 400 且文案一致
  - 临时把 `parseClaimReview` 输入换成 `'坏掉的'`（或断网）→ review 返回 `claimsFailed: true`，HTTP 200
- [ ] **Step 4:** 用一篇真实文章生成 3 版，人工看：【补充调研】标记出现在合理处；故意在提示词里写「多给几个具体金额」，看复核是否把文章外的金额标出来。把结果贴给 Shawn。

### Task 8: 试听、声音、提示词 API

**Files:**
- Create: `src/app/api/studio/audio/route.ts`, `src/app/api/studio/voice/route.ts`, `src/app/api/studio/prompt/route.ts`

- `POST /api/studio/audio` body `{ scriptId?, versionId?, force? }`（`maxDuration = 60`）：念稿子正文或某一版正文。稿子正文：`audio_hash === scriptHash(body)` 且非 force → 直接返回 `{ url: signedUrl(audio_path) }`；否则 `synthesize(body, (await resolveVoice(uid)).voiceId)` → `putPrivate('audio/<uid>/<scriptId>-<rand>.mp3')` → 删旧文件 → 更新 `audio_path/audio_hash/audio_at`。某一版：存 `audio/<uid>/v-<versionId>.mp3`，按同名覆盖（不落库，存在就直接签名返回，非 force 不重念）。
- `GET /api/studio/voice` → `{ voiceId, from }`；`PUT` body `{ voiceId: string | null }` 校验 `/^[0-9a-f]{32}$/`，写 `profiles.voice_id`（null = 清除回落）；`POST` → 用当前声音念「你好，这是我的声音。」返回 `{ url }`（存 `audio/<uid>/voice-test.mp3`）。
- `GET /api/studio/prompt` → `{ prompt: organizations.draft_prompt ?? '', defaultPrompt: DEFAULT_PROMPT, factRules: FACT_RULES }`；`PUT` body `{ prompt }`（截 8000，空串存 null）写到本人所属公司；无公司 → 400「还没挂公司」。

- [ ] **Step 1:** 实现
- [ ] **Step 2:** `npx tsc --noEmit`
- [ ] **Step 3:** 手测：同一稿子连点两次试听，第二次不调 Fish（看服务端日志/响应耗时）；改正文后再点会重念且旧文件被删；声音 PUT 非法串 → 400。

### Task 9: 工作台外壳与口播库（本周）

**Files:**
- Create: `src/app/studio/layout.tsx`, `src/app/studio/StudioShell.tsx`, `src/app/studio/api.ts`, `src/app/studio/page.tsx`（必要时拆 `WeekView.tsx`、`ScriptRow.tsx`）

**Interfaces — Produces:**
```ts
// api.ts（'use client'）
export async function studioFetch<T>(path: string, init?: RequestInit): Promise<T>; // 带 Bearer，非 2xx 抛 Error(body.error)
```
- `layout.tsx`：`robots: noindex`；不用 `(site)` 的页头页脚；浅色。
- `StudioShell`：取会话；未登录 → 去 `/login?next=/studio`；非管理员（API 403）→ 显示「工作台还没对你开放」。手机（< 768px）底部三个标签 **口播库 / 灵感库 / 我的**，样式照 App 的 `NavigationBar`（见 Global Constraints）；电脑顶部同三项横排。
- 口播库页（照 spec「界面」与草图 A，`.superpowers/brainstorm/*/content/home-layout-v2.html`）：
  - 标题「本周要录」+ 副标题「10月13日–19日 · 还剩 N 条」，右侧「‹ ›」切周；
  - 大卡片 = `groupWeek().next`：过期显示红字「已过期 N 天」，标题 22/700，正文前两行，按钮「▶ 试听」「✓ 已录」，文字按钮「改稿 · 改日期」；
  - 下面按天分组（只列有稿子的天，今天写「今天 · 周五」）；每行：标题（单行省略）、`待核 N`（`checks.figures.length + (checks.claims?.length ?? 0)`，>0 才显示，黄）、`待补调研`（红）、右侧圆形试听键；
  - 「未排期 N 条 ›」展开后每行有「排到…」→ 原生 `<input type="date">`；
  - 点行 → `/studio/s/<id>`。电脑宽度（≥ 1024px）下改为左右两栏：左边是上述列表，右边嵌入稿子页内容（同一组件），点行只切换右栏。
  - 试听键：调 `/api/studio/audio`，全页只有一个 `<audio>` 在播。
  - 「已录」→ PATCH status `recorded`，行淡出。
- [ ] **Step 1:** 实现
- [ ] **Step 2:** `npx tsc --noEmit && npm run build`
- [ ] **Step 3:** 浏览器实测：手机宽度 390（DevTools 设备模式）和 1280 各截一张图给 Shawn；过期、今天、未排期三种都要有数据。

### Task 10: 灵感库 + 拉到我这里

**Files:**
- Create: `src/app/studio/ideas/page.tsx`（必要时 `IdeaPullList.tsx`）

- 列表用 `GET /api/ideas`（带 Bearer，返回全部已发布的父级选题）；顶部搜索框（标题/摘要/标签，前端过滤）。
- 点一条展开（或进二级视图）用 `GET /api/ideas?slug=`：有 `children` 就列出每条子选题，否则就是它自己。每条 `hasScript` 的显示「拉到我这里」按钮。
- 点「拉到我这里」→ `POST /api/studio/pull { code }` → 按钮变「已拉 ✓」，底部轻提示「已拉到口播库 · 排个日期」，点了弹日期选择 → PATCH `record_by`。
- [ ] **Step 1:** 实现
- [ ] **Step 2:** `npx tsc --noEmit`
- [ ] **Step 3:** 实测：拉一条有子选题的文章里的第二条子选题，口播库「未排期」里出现，标题对。

### Task 11: 稿子页（编辑、版本、提示词、核对、试听）

**Files:**
- Create: `src/app/studio/s/[id]/page.tsx`, `VersionTabs.tsx`, `PromptPanel.tsx`, `CheckedBody.tsx`, `ScriptEditor.tsx`

照 spec「3. 改稿、版本与试听」与草图 `regen-compare.html`。
- `ScriptEditor`：标题、正文（textarea）、录完日期、状态；保存走 PATCH；正文下方 `CheckedBody` 只读预览带高亮。
- `CheckedBody({ body, checks })`：`checks.figures` 每个片段在正文中黄底；`checks.claims` 每条按 `sentence` 子串匹配黄底，匹配不到的列在下方「另有 N 处没在原文找到依据」；`researchMarks` 红底。顶部一行说明：「黄色 = 在文章里没找到依据，请自己确认；这是辅助提示，不保证找全。」`checks.claimsFailed` → 「复核没跑成」+「重试」按钮。
- `VersionTabs`：「Fordexa 原版 · 第 1 版 · 第 2 版…」，手机为横向分段（可横滑），电脑为两栏并排（每栏一个下拉选版本，默认最新两版）。每版有「▶ 试听」「用这版」；当前正文对应的版本标「在用」。
- `PromptPanel`：显示选中版本的 `prompt`（Fordexa 原版显示当前公司提示词）可编辑；上方「比上一版改了 N 处」（`changeCount`），改动行绿底（`diffLines`）；按钮「再生成一次」（generate 带 `prompt` → 拿到新版本立即切过去 → 自动调 review，期间显示「核对中…」）和「存为我的提示词」（PUT prompt）。固定事实规则以只读灰字折叠显示「系统固定规则（不可改）」。手机为可上拉底部面板（收起只露一行），电脑为右栏常驻。
- 稿子没有 `code` → 不显示生成区，显示「这条是自己写的，没有文章可依据，只能手动改」。
- 编辑器下方「重新复核」→ review `{ scriptId }`。
- [ ] **Step 1:** 实现
- [ ] **Step 2:** `npx tsc --noEmit && npm run build`
- [ ] **Step 3:** 实测：同一稿子生成 3 版 → 改提示词再生成 → 两栏对比 → 用第 2 版 → 回口播库看正文已变、试听念的是第 2 版；手机宽度下面板收放顺畅、按钮都 ≥ 44px。截图给 Shawn。

### Task 12: 我的（声音、写稿提示词）

**Files:**
- Create: `src/app/studio/me/page.tsx`

- 列表卡片照 App「我的」页：行「我的声音」（右侧显示「我的声音」/「公司声音」/「默认声音」）、「写稿提示词」（右侧显示「已自定义」/「默认」）。
- 我的声音：显示当前 ID（`from`）；输入框填 32 位 ID + 保存；「念一句试试」；「上传录音训练」入口（Task 13）。
- 写稿提示词：大 textarea + 「恢复默认」+ 保存；下方只读显示固定规则。
- [ ] **Step 1:** 实现
- [ ] **Step 2:** `npx tsc --noEmit`
- [ ] **Step 3:** 实测：清掉声音 ID → 试听变回默认声音；填回 `8382e1c0…` → 是 Shawn 的声音。

### Task 13: 上传录音训练声音

**Files:**
- Create: `src/app/api/studio/voice/train/route.ts`；Modify: `src/app/studio/me/page.tsx`

- `POST /api/studio/voice/train` body `{ files: { name: string; type: string }[] }` → 1–20 个、`type` 以 `audio/` 开头 → 为每个生成 `training/<uid>/<rand>-<safeName>` 的签名上传地址（`createSignedUploadUrl`），返回 `{ uploads: { path, token, signedUrl }[], slots: { used, limit: 10 } }`（`used` 来自 Fish `GET /model?self=true`，取不到返回 null）。
- 前端用 `supabase.storage.from('studio-private').uploadToSignedUrl(path, token, file)` 直传（不经过 Vercel 函数，避开 4.5MB 上限）；单文件前端限制 20MB。
- `PUT /api/studio/voice/train` body `{ paths: string[], title: string, texts?: string[] }`（`maxDuration = 60`）：校验每个 path 以 `training/<uid>/` 开头 → 下载 → multipart `POST https://api.fish.audio/model`（`type=tts`、`title`、`train_mode=fast`、`visibility=private`、`voices` 多个、可选 `texts`、`enhance_audio_quality=true`）→ 成功取 `_id` 写 `profiles.voice_id` → **删训练文件**（失败也删）→ 返回 `{ voiceId }`；Fish 报错原样中文化返回 502。
- 我的页：选文件（可多选）→ 显示「已用 N / 10 个私有声音」→ 上传进度 → 训练 → 成功后自动「念一句试试」。
- [ ] **Step 1:** 实现
- [ ] **Step 2:** `npx tsc --noEmit`
- [ ] **Step 3:** 实测：Shawn 上传 2 段 15–30 秒录音训练一个测试声音 → 念一句；之后在 Fish 网站确认生成了私有模型；按需把声音 ID 改回 `8382e1c0…`。训练文件在桶里已不存在。

### Task 14: 收尾验证

- [ ] **Step 1:** `npm test && npx tsc --noEmit && npm run build` 全绿，贴输出。
- [ ] **Step 2:** App 回归：在 App 里打开口播库，网页上改过的稿子显示新正文；App 里改一条稿子保存后，网页上 `record_by`、版本都还在。
- [ ] **Step 3:** 派 code-reviewer 子代理审全部改动（重点：每个 `/api/studio/*` 都校验了本人归属；私有桶没漏成公开链接；固定规则确实拼在可编辑提示词之后）。修 CRITICAL/HIGH。
- [ ] **Step 4:** 报告 Shawn：「已改好未提交，等你确认」，附手机/电脑截图和 SQL 文件路径。
