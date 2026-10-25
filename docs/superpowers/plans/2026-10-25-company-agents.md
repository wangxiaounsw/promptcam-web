# 每家公司一个 agent：实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notion「🤖 Subagents」库登记每家公司的 agent；Notion 提示词库和 Supabase `prompts` 表按规则同步（每天只读回来 + 叫 agent 前完整同步）；本地 skill `company-agent` 按名字叫 agent。

**Architecture:** 同步逻辑写在 promptcam-web 的 `src/lib/agents/`：纯函数判断五种情况，`runSync` 通过注入的 Notion / Supabase 依赖执行读写。本机命令行 `scripts/agent-sync.mjs` 和 Vultr 上的定时脚本调同一个 `runSync`（2026-10-25 改：原 Vercel Cron 接口删掉，见 spec「定时」）。Notion 结构改动、首批 agent、首次同步用 Notion MCP 手工做；skill 装在 `~/.claude/skills/company-agent/`。

**Tech Stack:** Next.js 15 / Node 24（原生跑 .ts、`node:test`）、`@supabase/supabase-js`、Notion REST API（`fetch`，`Notion-Version: 2025-09-03`，不加依赖）、Notion MCP、Vultr crontab。

**Spec:** `docs/superpowers/specs/2026-10-25-company-agents-design.md`。执行前通读。

## Global Constraints

- **提交规矩**：任何 commit / push 前，本地跑完 `npm test` 和 `npx tsc --noEmit`，向 Shawn 报告「已改好未提交，等你确认」，**停下**。计划里没有提交步骤，最后一个 Task 统一处理。
- Supabase 是正本。写 `prompts` 必须先停用同范围旧的启用版、再插新的启用版（`prompts_one_active` 唯一索引）。
- 客户接手 = 该范围出现过 `created_by` 非空且不是管理员（`profiles.is_admin = false`）的版本，且晚于「接手解除于」。`created_by` 为空的（10-17 迁移的）算管理员。
- 定时同步只读回来：不改「Shawn 调的版本」，不写 Supabase。
- 没有「所属企业」的提示词推之前必须 Shawn 确认（命令行 `--yes-general`）。
- 超过 8000 字（`src/app/api/studio/prompt/route.ts` 的 `LIMIT`）不推。
- 比较 S 和 W 时：去首尾空白、`\r\n` → `\n`。
- 做视频（`make_video`）不同步：「同步网站」不勾的行，`runSync` 一律跳过。
- Shawn 账号 profile id：`3c178da0-bebe-46a3-b1ab-1977ffd36226`（推送时作 `created_by`）。
- 日期按 `Australia/Melbourne`；用户可见文字中文白话。
- `~/.claude/skills/company-agent/` 不在 git 里。

## Notion / Supabase ID

| 东西 | ID |
|---|---|
| 🤖 Subagents data source | `collection://5578de7f-5517-479f-a69e-8da6b1909b8b` |
| 📚 Skills data source | `collection://4ae5d303-50d4-4e81-8e87-dd2cff0e57f6` |
| 提示词 data source | `collection://6901b841-0856-4e7f-a24b-140abeab669d` |
| Supabase 项目 | `nmgzcdeavkahegrbcrix` |

对照（Notion → Supabase）：
- 步骤：精筛 `screen`、写文章 `write_article`、拆口播 `split_scripts`、写口播 `write_script`、数据选题 `data_topics`、做视频 `make_video`
- 行业：会计 `accounting`、移民留学 `migration`、贷款 `mortgage`、房产 `property`、律师 `legal`、数据 `data`、通用 `null`
- 状态：启用 `active`、草稿 `draft`、停用 → 不推

## Review Focus

1. **Notion 富文本被切成多段**（>2000 字、或中间有加粗）：读回来要拼成一字不差的原文，否则 S≠W 被误判成「Shawn 改了」→ Task 2 测试 `round-trips 4500 chars` 和 `joins segments`。
2. **公司名对不上**（Notion「所属企业」写 `vtax`、或 Supabase 里同时有 `fordexa` 和 `Fordexa`）：应报「找不到公司 / 公司名不唯一」并跳过这条，不能当成通用提示词推 → Task 1 测试 `org name not found` / `org name ambiguous`。
3. **dry-run 不能写任何东西**（Notion 和 Supabase 都不写）：Shawn 看对照表时库已被改就失去意义 → Task 4 测试 `dry run writes nothing`。
4. **网站有启用版、Notion S 还是空的**（新建的 Notion 行还没填）：应拉回网站版，不能把空串推上去覆盖 → Task 3 测试 `empty shawn pulls`。
5. **推送失败一半**（停用旧版成功、插新版失败）：不能留下零条启用；要报错并说明这个范围现在没有启用版 → Task 4 测试 `insert failure reported`。

---

### Task 1: 范围对照（Notion 行 → Supabase 范围）

**Files:**
- Create: `src/lib/agents/scope.ts`
- Test: `src/lib/agents/scope.test.ts`

**Interfaces:**
- Produces:
  - `type Scope = { step: PromptStep; orgId: string | null; industry: string | null }`（`PromptStep` 来自 `src/lib/prompt-pick.ts`）
  - `type NotionPromptMeta = { step: string; industry: string; company: string | null; status: string }`（中文原值）
  - `resolveScope(meta: NotionPromptMeta, orgs: { id: string; name: string; industry: string | null }[]): { ok: true; scope: Scope; orgIndustry: string | null } | { ok: false; reason: string }`
  - `STEP_KEY: Record<string, PromptStep>`、`INDUSTRY_KEY: Record<string, string | null>`、`statusKey(s: string): 'active' | 'draft' | null`

- [ ] **Step 1: 写失败的测试** `scope.test.ts`

```ts
test('org row ignores industry', () => {
  const r = resolveScope({ step: '写口播', industry: '数据', company: 'Vtax', status: '启用' }, ORGS);
  assert.deepEqual(r, { ok: true, scope: { step: 'write_script', orgId: 'v1', industry: null }, orgIndustry: 'accounting' });
});
test('general row', () => {
  assert.deepEqual(resolveScope({ step: '写文章', industry: '通用', company: null, status: '草稿' }, ORGS),
    { ok: true, scope: { step: 'write_article', orgId: null, industry: null }, orgIndustry: null });
});
test('industry row', () => { /* 写文章 + 会计 + 无公司 → industry 'accounting' */ });
test('org name not found', () => { assert.equal(resolveScope({ ...m, company: 'vtax' }, ORGS).ok, false); });
test('org name ambiguous', () => { /* ORGS 里两条同名 → ok:false, reason 含「不唯一」 */ });
test('unknown step', () => { /* step '剪辑' → ok:false */ });
test('statusKey', () => { assert.equal(statusKey('启用'), 'active'); assert.equal(statusKey('停用'), null); });
```
（`ORGS = [{ id: 'v1', name: 'Vtax', industry: 'accounting' }, …]`；公司名精确匹配，大小写敏感。）

- [ ] **Step 2: 跑测试确认失败** — `npm test` → `scope.test.ts` FAIL（模块不存在）
- [ ] **Step 3: 实现 `scope.ts`**（只 import `../prompt-pick.ts` 的类型，不 import `@/`，脚本要能直接用）
- [ ] **Step 4: 跑测试确认通过** — `npm test` → PASS

---

### Task 2: Notion 富文本读写 + Notion REST 客户端

**Files:**
- Create: `src/lib/agents/rich-text.ts`、`src/lib/agents/notion-api.ts`
- Test: `src/lib/agents/rich-text.test.ts`

**Interfaces:**
- Produces:
  - `toRichText(s: string): { type: 'text'; text: { content: string } }[]`（每段 ≤ 2000 字，按字符切，不切开代理对）
  - `fromRichText(arr: { plain_text: string }[]): string`
  - `normalize(s: string): string`（去首尾空白，`\r\n`→`\n`）
  - `class NotionApi { constructor(token: string); queryAll(dataSourceId: string, filter?: object): Promise<NotionPage[]>; getPage(id: string): Promise<NotionPage>; updateProps(pageId: string, props: Record<string, unknown>): Promise<void> }`
  - `type NotionPage = { id: string; properties: Record<string, any> }`
  - 属性读取帮手：`text(p, name): string`、`select(p, name): string | null`、`checkbox(p, name): boolean`、`date(p, name): string | null`、`relationIds(p, name): string[]`

- [ ] **Step 1: 写失败的测试**

```ts
test('round-trips 4500 chars', () => {
  const s = '口'.repeat(4500);
  const rt = toRichText(s);
  assert.equal(rt.length, 3);
  assert.ok(rt.every((r) => r.text.content.length <= 2000));
  assert.equal(fromRichText(rt.map((r) => ({ plain_text: r.text.content }))), s);
});
test('joins segments', () => { assert.equal(fromRichText([{ plain_text: '你' }, { plain_text: '**好**' }]), '你**好**'); });
test('empty', () => { assert.deepEqual(toRichText(''), []); assert.equal(fromRichText([]), ''); });
test('normalize', () => { assert.equal(normalize('  a\r\nb \n'), 'a\nb'); });
```

- [ ] **Step 2: 跑测试确认失败** — `npm test`
- [ ] **Step 3: 实现 `rich-text.ts`**；实现 `notion-api.ts`：`fetch('https://api.notion.com/v1/...')`，头 `Authorization: Bearer`、`Notion-Version: 2025-09-03`；`queryAll` 用 `POST /v1/data_sources/{id}/query` 并按 `next_cursor` 翻到底（全量，不许只取第一页）；非 2xx 抛错带状态码和 Notion 的 `message`
- [ ] **Step 4: 跑测试确认通过** — `npm test`

---

### Task 3: 五种情况的判断（纯函数）

**Files:**
- Create: `src/lib/agents/decide.ts`
- Test: `src/lib/agents/decide.test.ts`

**Interfaces:**
- Consumes: `normalize`（Task 2）
- Produces:
  - `type Active = { id: string; body: string } | null`
  - `type FullInput = { shawn: string; site: string; siteId: string | null; active: Active; takenOver: boolean; notionStatus: 'active' | 'draft' | null }`
  - `type FullAction = 'none' | 'pull' | 'push' | 'blocked-takeover' | 'conflict' | 'skip-draft' | 'too-long'`
  - `decideFull(i: FullInput): FullAction`
  - `isTakenOver(versions: { created_by: string | null; created_at: string }[], adminIds: Set<string>, releasedAt: string | null): boolean`
  - `pullNote(shawn: string, siteBody: string, takenOver: boolean): string | null`
  - `MAX_PROMPT = 8000`

判断顺序（spec「叫 agent 前的同步」表 + 无启用版）：
1. `active === null`：`notionStatus==='active' && shawn 非空 && !takenOver` → `push`（超长 → `too-long`）；否则 `skip-draft`
2. `shawn` 为空 → `pull`
3. `same = normalize(shawn) === normalize(site)`，`moved = active.id !== siteId`
4. `!moved && same` → `none`；`moved && same` → `pull`
5. `takenOver` → `blocked-takeover`
6. `!moved` → `push`（超长 → `too-long`；Notion 状态是停用即 `notionStatus === null` → `skip-draft`，停用不推）；`moved` → `conflict`

- [ ] **Step 1: 写失败的测试**（每个分支一条，名字照写）

```ts
test('case1 none', () => assert.equal(decideFull({ shawn: 'a', site: 'a\n', siteId: 'r1', active: { id: 'r1', body: 'a' }, takenOver: false, notionStatus: 'active' }), 'none'));
test('case2 site moved pulls', …'pull');
test('case3 shawn edited pushes', …'push');
test('case3 too long', () => /* shawn = 'x'.repeat(8001) */ 'too-long');
test('case4 taken over blocks', …'blocked-takeover');
test('case5 both moved conflict', …'conflict');
test('empty shawn pulls', () => /* shawn '', active 有 → 'pull' */);
test('no active, enabled pushes', …'push');
test('no active, draft skips', …'skip-draft');
test('disabled never pushes', () => /* case3 输入但 notionStatus null → 'skip-draft' */);
test('takeover: null creator is admin', () => assert.equal(isTakenOver([{ created_by: null, created_at: '2026-10-17' }], new Set(), null), false));
test('takeover: client version', () => /* created_by 'c1' 不在 admins → true */);
test('takeover: released after client version', () => /* client 10-20, releasedAt 10-21 → false */);
test('pullNote', () => { assert.equal(pullNote('a', 'a', false), null); assert.match(pullNote('b', 'a', true)!, /客户已接手/); assert.match(pullNote('b', 'a', false)!, /下次叫 agent/); });
```

- [ ] **Step 2: 跑测试确认失败** — `npm test`
- [ ] **Step 3: 实现 `decide.ts`**
- [ ] **Step 4: 跑测试确认通过** — `npm test`

---

### Task 4: 提示词存版本抽出来 + `runSync`

**Files:**
- Create: `src/lib/prompt-store.ts`（不 import `@/`）
- Modify: `src/lib/prompts.ts`（`savePrompt` 改为调 `saveVersion(admin(), …)`，行为不变）
- Create: `src/lib/agents/sync.ts`
- Test: `src/lib/agents/sync.test.ts`

**Interfaces:**
- Consumes: Task 1–3 全部
- Produces:
  - `saveVersion(db: SupabaseClient, v: { step; orgId; industry; name; body; note; userId; status?: 'active' | 'draft' }): Promise<{ id: string; body: string; created_at: string }>`——停用同范围启用版（有公司按公司，无公司按行业）再插入；插入失败抛错 `「<name>」停用了旧版但新版没写进去，这个范围现在没有启用的提示词：<原因>`
  - `type SyncDeps = { notion: Pick<NotionApi, 'queryAll' | 'getPage' | 'updateProps'>; db: SupabaseClient; now: () => Date; shawnId: string }`
  - `type SyncOptions = { mode: 'pull' | 'full'; agent?: string; dryRun: boolean; yesGeneral: boolean }`
  - `type SyncItem = { page: string; name: string; action: FullAction | 'pulled' | 'error' | 'needs-confirm'; note: string | null; diff?: DiffLine[]; activeId: string | null; body: string | null }`
  - `runSync(deps: SyncDeps, opts: SyncOptions): Promise<{ items: SyncItem[]; affectedOrgs?: Record<string, string[]> }>`

行为：
- 读哪些行：`mode='pull'` → 提示词库全部勾了「同步网站」的行；`mode='full'` → Subagents 里 Name = `opts.agent` 且状态 = 启用的那一行，其「提示词」关联里勾了「同步网站」的行（找不到 agent 抛错 `找不到启用的 agent「X」`）。
- 每行：`resolveScope` 失败 → `error` 带原因，继续下一行。读 Supabase 该范围全部版本（算接手）和当前启用版。
- `pull` 模式：写 W、网站版本 ID、网站同步于（ISO 时间）、客户已接手、同步提示 = `pullNote(...)`；action `pulled`。
- `full` 模式按 `decideFull`：`pull` → W = S = active.body；`push` → 无公司且 `!yesGeneral` → `needs-confirm`（并在 `affectedOrgs` 列出没有该步骤专属启用版、会回落到它的公司名），否则 `saveVersion(status = statusKey)`，note =`Shawn 在 Notion 调：` + Notion「版本说明」，然后 W = S、ID、时间；`blocked-takeover` → W = active.body、同步提示 = `客户已接手，你的改动没写进去`，带 `diff = diffLines(W, S)`；`conflict` → 不写，带三方 diff（S vs 新网站版）；`too-long` / `skip-draft` → 写同步提示。
- 每个 item 的 `body` = 同步后 agent 该用的全文（`active.body`，推送后为新版；`skip-draft`/无版本为 `null`），`activeId` 同理。
- `dryRun`：算出全部 action 和 diff，**不调用** `updateProps`、`saveVersion`。
- 管理员集合：一次查 `profiles where is_admin = true`。
- Notion 列名（Task 6 建）：`Shawn 调的版本`、`网站当前版本`、`网站同步于`、`网站版本 ID`、`客户已接手`、`同步提示`、`同步网站`、`接手解除于`。

- [ ] **Step 1: 写失败的测试**（假 notion：内存里的页面表，记录 `updateProps` 调用；假 db：最小链式 fake，记录 update/insert，可设插入失败）

```ts
test('pull mode updates site column only', …)            // S 不变，W/ID/时间/接手写入，db 无 insert
test('full push writes version then columns', …)         // insert 1 次，created_by = shawnId，note 以「Shawn 在 Notion 调：」开头，之后 W = S
test('general push needs confirm', …)                    // 无公司 + yesGeneral false → needs-confirm，db 无写入，affectedOrgs 有值
test('dry run writes nothing', …)                        // push/pull 情况下 updateProps 和 insert 调用数都是 0，items 照样有 action
test('blocked takeover keeps shawn column', …)           // S 不变，W = 客户版，item.diff 非空
test('scope error does not stop others', …)              // 一行公司名错 → error，另一行照常
test('insert failure reported', …)                       // insert 失败 → item.action 'error'，note 含「没有启用的提示词」
test('unsynced rows skipped', …)                         // 「同步网站」不勾的行不出现在 items
```

- [ ] **Step 2: 跑测试确认失败** — `npm test`
- [ ] **Step 3: 实现 `prompt-store.ts`，`prompts.ts` 的 `savePrompt` 改调它**
- [ ] **Step 4: 实现 `sync.ts`**（`diffLines` 来自 `../studio/prompt-diff.ts`）
- [ ] **Step 5: 跑测试和类型检查** — `npm test` 全 PASS；`npx tsc --noEmit` 无错

---

### Task 5: 命令行 + 每日定时接口

**Files:**
- Create: `scripts/agent-sync.mjs`
- Create: `src/app/api/cron/agent-prompts/route.ts`
- Modify: `vercel.json`（加 `"crons": [{ "path": "/api/cron/agent-prompts", "schedule": "0 19 * * *" }]`——19:00 UTC = 墨尔本夏令时 06:00，冬令时 05:00）

**Interfaces:**
- Consumes: `runSync`、`NotionApi`
- Produces:
  - CLI：`node --env-file=.env.local scripts/agent-sync.mjs (--agent <名字> | --pull) [--dry-run] [--yes-general] [--release <提示词页 id>]`，stdout 打印一份 JSON（`runSync` 的返回），stderr 打印中文摘要（每行：名称 · 情况 · 说明）；缺 `NOTION_TOKEN` / `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` 时退出码 2 并说缺哪个。`--release` 把该页「接手解除于」写成现在，不跑同步。
  - 接口：`GET /api/cron/agent-prompts`，`Authorization: Bearer ${CRON_SECRET}` 不对返回 401；对则 `runSync({ mode: 'pull', dryRun: false, yesGeneral: false })`，返回 `{ ok: true, count, errors }`。

- [ ] **Step 1: 写脚本和接口**（脚本照 `scripts/showcase-import.mjs` 的写法：直接 import `../src/lib/agents/sync.ts`）
- [ ] **Step 2: 缺环境变量检查** — 不带 `--env-file` 跑 `node scripts/agent-sync.mjs --pull --dry-run` → 退出码 2，stderr 说缺 `NOTION_TOKEN`
- [ ] **Step 3: 类型检查** — `npx tsc --noEmit` 无错（真跑要等 Task 6 有 token 和列）

---

### Task 6: Notion 结构

**Files:** 无（Notion MCP + `.env.local`）

- [ ] **Step 1: token**：用 `~/.claude/keys.csv` 里已有的 `notion,NOTION_TOKEN`（2026-10-25 验证：对 Subagents、提示词、Skills 三个 data source 都返回 200），写进 `.env.local` 的 `NOTION_TOKEN`，不打印、不进 git。
- [ ] **Step 2: 提示词库加列**（`notion-update-data-source`）：`Shawn 调的版本`(text)、`网站当前版本`(text)、`网站同步于`(date)、`网站版本 ID`(text)、`客户已接手`(checkbox)、`同步提示`(text)、`同步网站`(checkbox)、`接手解除于`(date)。
- [ ] **Step 3: Subagents 库加列**：`提示词`(relation → 提示词 data source)、`所属公司`(text)、`行业`(select：会计/移民留学/贷款/房产/律师/数据/通用)、`模型`(select：opus/sonnet)、`状态`(select：启用/停用)、`版本说明`(text)。
- [ ] **Step 4: 勾「同步网站」**：除「做视频 · Vtax」外的 14 条全勾（`notion-query-data-sources` 全量取，不许只看前 N 条）。
- [ ] **Step 5: 验证**：`node --env-file=.env.local scripts/agent-sync.mjs --pull --dry-run` → 14 条都有 action，0 条 error；`做视频 · Vtax` 不在结果里。

---

### Task 7: 首批三个 agent + 首次同步（Shawn 过目后才写库）

**Files:** 无（Notion MCP + 脚本）

- [ ] **Step 1: 起草三行 Subagents**（Fordexa 公共稿 / 王小墨 / Vtax），正文按 spec「Subagents 库」的四块写，材料：提示词库各条正文、daily summary（10-13 Vtax、10-24 FX-0003）、`76-小红书视频/CLAUDE.md`、本项目 memory。列：所属公司（Fordexa 公共稿留空）、行业（通用 / 数据 / 会计）、模型 opus、状态 启用、Skills 关联 xhs-research、xhs-cover、xhs-rough-cut、chatgpt-imagegen、fordexa-publish；提示词关联：该公司专属各条 + 会回落到的行业 / 通用条（Vtax 含「做视频 · Vtax」）。
- [ ] **Step 2: 填 S**：每条勾了「同步网站」的提示词，把页面正文转成 Markdown 纯文本（`<b>x</b>` → `**x**`，列表保持 `- `）写进「Shawn 调的版本」；W、网站版本 ID 先写 Supabase 现有启用版（只有写口播三条有），其余留空。页面正文暂不改。
- [ ] **Step 3: 只看不写** — `node --env-file=.env.local scripts/agent-sync.mjs --agent Vtax --dry-run`，三个 agent 各跑一次。
- [ ] **Step 4: 给 Shawn 过目**：列出每条的 action 和 diff；特别标出「写口播 · Vtax」（Notion v4 vs Supabase 10-17 版）。按 Shawn 的选择处理（要用 Supabase 版就把 S 改成 W）。
- [ ] **Step 5: 正式同步**（Shawn 说可以后）— 去掉 `--dry-run` 跑三次；通用 / 行业条按 Shawn 确认加 `--yes-general`。
- [ ] **Step 6: 验证**：再跑一次 `--agent Vtax --dry-run` → 全部 `none`；Supabase `select step, name, status from prompts where status='active'` 里写文章各条已在。~~提示词页正文第一行改成「提示词全文看上面两列」~~ 取消（2026-10-25）：Vultr 上 fordexa-pipeline 的 lib/prompts.py 按页面正文读精筛 / 拆口播 / 数据选题 / 写口播，正文不能动。

---

### Task 8: skill `company-agent`

**Files:**
- Create: `~/.claude/skills/company-agent/SKILL.md`

**Interfaces:**
- Consumes: `scripts/agent-sync.mjs --agent <名字>` 的 JSON（`items[].body`、`activeId`、`action`、`diff`）

内容（中文白话）：
- 触发：「让 X 写 / 出 …」=交给它干；「用 X 的身份做 …」=陪我做；「叫 X」；「这条交还给我」=跑 `--release`。
- 步骤照 spec「叫 agent」1–6：Notion MCP 读 Subagents 行（Name 精确匹配、状态启用）→ 在 promptcam-web 目录跑同步脚本（`needs-confirm` 时列 `affectedOrgs` 问 Shawn，同意再加 `--yes-general` 重跑；`conflict` / `blocked-takeover` 把 diff 摆给 Shawn）→ 读描述正文 + 不同步提示词（做视频）的 Notion 正文 → 查每个关联 skill 是否在 `~/.claude/skills/<name>/SKILL.md`（fordexa-publish 只在云端，发布一步提醒 Shawn）→ 交给它干：Agent 工具（general-purpose，model 用该行「模型」列），提示词 = 描述 + skill 清单（名字 + 路径 + 「用到时先读 SKILL.md」）+ 各提示词全文 + 任务；陪我做：把同样内容加载进当前对话 → 报告：用了哪几版（Supabase id + 日期）、同步发生了什么。
- 不给 agent 别家公司的内容；不自动发布。

- [ ] **Step 1: 写 SKILL.md**
- [ ] **Step 2: 试叫一次（交给它干）**：「让 Vtax 写一条口播：海外收入要不要在澳洲报税」——确认同步被跑、subagent 拿到 Vtax 描述和写口播 · Vtax 全文、交回口播稿；不写进 Notion 口播稿库（只是试跑），把结果给 Shawn 看。
- [ ] **Step 3: 试叫一次（陪我做）**：「用 Vtax 的身份做视频」——确认主对话报出加载了哪些设定和「做视频 · Vtax」正文，然后停下等 Shawn。
- [ ] **Step 4: 用 `skill-creator` 登记到 Notion Skills 库**，并把它关联到三个 agent 行的 Skills。

---

### Task 9: 上线（全部要 Shawn 确认）

- [ ] **Step 1: 全量验证** — `npm test` 全 PASS；`npx tsc --noEmit` 无错；`npm run build` 成功。
- [ ] **Step 2: 报告 Shawn「已改好未提交，等你确认」并停下**。附：改了哪些文件、spec + 本计划也未提交、Vercel 需要加的环境变量 `NOTION_TOKEN`、`CRON_SECRET`。
- [ ] **Step 3: Shawn 确认后**：提交（conventional commit，`feat:`）、推送；Shawn 在 Vercel 加两个环境变量；部署后用 `curl -H "Authorization: Bearer $CRON_SECRET" https://<域名>/api/cron/agent-prompts` 手动触发一次 → `{ ok: true, errors: [] }`，Notion「网站同步于」更新为当天。
