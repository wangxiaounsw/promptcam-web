# 发布日历第 3 版（口播库就是日历）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 不再用单独的 `posts` 表：口播稿表 `scripts` 加上发布日期、进度、小红书文案等列，日历就是它按月显示的样子；加「待排」侧栏可以拖着排期，按公司自动算录制截止日，双方权限一样，所有改动都留修改记录。

**Architecture:**
- 日期和进度的联动、`record_by` 重算、和 App 的 `status` 对齐、修改记录，全部写在 `scripts` 的数据库触发器里，网页、App、直接改库三条路都管得住。
- 第 2 版已经暂存的代码（`src/lib/studio/posts*.ts`、`calendar*.ts`、`/api/studio/posts/**`、`src/app/studio/calendar/*`）原地改写，数据源从 `posts` 换成 `scripts`。文件名和接口路径保持不变，少改动。
- 删除 `posts`、`post_notes` 两张表，备注改用新表 `script_notes`。

**Tech Stack:** Next.js 15 / React 19 / Tailwind 4、supabase-js、Postgres 触发器（plpgsql）、node:test。

**Spec:** `docs/superpowers/specs/2026-10-27-content-calendar-design.md`（第 3 版，重点看第 1–3、7、8、10 节）

## Global Constraints

**流程**
- 不 commit、不 push。全部做完后报「已改好未提交，等你确认」。Controller 用 git index 做检查点，助手不碰 index。
- 迁移要改 App 依赖的 `scripts` 触发器，还会删两张表。**Controller 先把 SQL 给 Shawn 看，Shawn 同意后才跑**（用 Supabase MCP `apply_migration`）。
- 本机 3461 端口的 `next start` 是 controller 开的，助手不要关它，也不要跑 `next build`。打包由 controller 来。
- 不往正式库写测试数据，除非任务里明写。触发器的检查一律放在 `BEGIN … ROLLBACK` 里跑。

**数据**
- App 只写 `id/title/body/source/status/sort_order/code/user_id`。所有新列都必须可空或带默认值，App 的 upsert 不能因此失败。
- 网页接口每次 update 都要带 `edited_by: user.id`，触发器靠它知道是谁改的。
- 日历上的每一条 = `scripts` 中 `org_id` 等于当前公司、`publish_on is not null`、`status <> 'archived'` 的行。「待排」= 同样条件但 `publish_on is null`。
- 日期一律按墨尔本时间（`melbourneDay`），日期在代码里传 `'YYYY-MM-DD'` 字符串。

**进度（`stage` 的值和界面文字，照抄）**
- `draft` 草稿 → `refining` 精修中 → `final` 定稿 → `recorded` 已录（`industry = 'data'` 的公司叫「已配音」）→ `cut` 成片 → `published` 已发布。
- 颜色：草稿和精修中是灰色虚线（`#fafafa` 底，`#bbb` 虚线边）；定稿是黄（`#FDE7B0` 底，`#7a4d00` 字）；已录和成片是浅绿（`#DDF3E4` 底，`#14532d` 字）；已发布是紫（`#EDE4FA` 底，`#4c1d95` 字）。热点另加红色标签，和第 2 版一样。
- 「该录了」：视频、`stage = 'final'`、`record_by` 早于今天，格子上显示红字「该录了」。

**权限**
- 管理员和本公司成员能做的事一样。唯一例外：删除修改记录只有管理员可以，否则回 403「只有 Fordexa 能删记录」。

## Review Focus

1. **App 拿旧的本地数据整行写回。** 例如一条已经「成片」的稿子，App 写回了 `status = 'ready'`。期望：`status` 保持 `recorded`，`stage` 不变。→ Task 1 的 SQL 检查。
2. **改发布日期，跨月或跨夏令时。** `record_by` 必须正好是发布日期减去提前天数，比如 11/3 减 5 天是 10/29。另外，改的是别的列时，手动改过的 `record_by` 不能被冲掉。→ Task 1 的 SQL 检查和 Task 2 的 `recordByFor` 测试。
3. **修改记录里「谁改的」不能变成未知。** 网页改发布日期时，`publish_on` 和自动算出的 `record_by` 两条记录都要记到改的人名下。→ Task 1 的 SQL 检查。
4. **口播库草稿很多（上百条）。** 「待排」列表要能搜、有数量上限，页面不能卡。→ Task 3：接口最多返回 300 条并给出总数；Task 5：侧栏搜索。
5. **已发布的条目被拖回「待排」或拖到别的日期。** 期望：拒绝，提示「已发布的不能改日期」，格子留在原地。→ Task 2 的 `validateEdit` 测试和 Task 5 的拖放处理。

---

### Task 1: 迁移（`scripts` 加列、触发器、备注表、删旧表）

**Files:**
- Create: `supabase/migrations/20261029_scripts_calendar.sql`
- Create: `supabase/tests/20261029_scripts_calendar_check.sql`（只是一段 `DO` 块，跑在 `BEGIN … ROLLBACK` 里）

**Interfaces:**
- Produces（后面所有任务都按这些名字读写）：
  - `scripts` 新列：`publish_on date`、`stage text not null default 'draft'`（带 check）、`kind text not null default 'video'`（check `video|image`）、`is_extra boolean not null default false`、`series text`、`episode int`、`media_url text`、`cover_path text`、`xhs_title text not null default ''`、`xhs_body text not null default ''`、`xhs_tags text[] not null default '{}'`、`published_url text`、`published_at timestamptz`、`likes int`、`saves int`、`comments int`、`stats_at timestamptz`、`last_note_at timestamptz`、`last_note_by_admin boolean`、`admin_seen_at timestamptz`、`client_seen_at timestamptz`。
  - 索引：`scripts (org_id, publish_on)`。
  - `organizations.record_lead_days int not null default 5`。
  - 新表 `script_notes(id, script_id → scripts on delete cascade, org_id, author_id, kind check note|system, body, created_at)`，开 RLS、不加策略。
  - `script_changes.field` 的 check 约束放开到这些值：`title, body, record_by, status, publish_on, stage, kind, is_extra, series, episode, media_url, cover_path, xhs_title, xhs_body, xhs_tags, published_url, likes, saves, comments, note`。

- [ ] **Step 1: 写迁移**

开头写注释，引用 spec 第 3 版。全部可以重复跑（`if not exists`；约束先 `drop … if exists` 再 `add`）。按这个顺序：

1. 加列、建 `script_notes` 表、放开 check 约束。
2. 回填老数据：`status = 'recorded'` 或 `finalized_at is not null` 的设成 `stage = 'recorded'`，其余设成 `draft`。只改 `stage = 'draft'` 的行，这样重复跑也不会出错。

   注意顺序：**回填要放在替换触发器之前**，否则回填本身会被记成修改。照第二期迁移的写法做。
3. `create or replace` 三个触发器函数：

   **`scripts_before_insert`**：保留现有逻辑。
   - `publish_on` 不为空、不是图文、`record_by` 为空时，`record_by = publish_on - 公司的 record_lead_days`。
   - 图文的 `record_by` 设成 null。

   **`scripts_before_update`**：保留现有锁定（不能改 `user_id`、`org_id`、`created_by`），再按顺序加上：
   - a. `publish_on` 有变化时：
     - 视频：`record_by = new.publish_on - lead_days`（`publish_on` 为 null 时 `record_by` 也为 null）。
     - 图文：`record_by = null`。
   - b. `kind` 改成 `image` 时：`record_by = null`；如果 `stage = 'recorded'`，退回 `final`。
   - c. `finalized_at` 从 null 变成有值，且 `stage` 在 `recorded` 之前：`stage = 'recorded'`。
   - d. App 把 `status` 改成 `recorded`，且 `stage` 在 `recorded` 之前：`stage = 'recorded'`。
   - e. `status` 从 `recorded` 改成 `ready`：
     - `stage` 是 `cut` 或 `published`：拒绝这次改动，把 `status` 写回 `recorded`。
     - `stage` 是 `recorded`：`stage = 'final'`。
   - f. 网页改了 `stage`（`stage` 有变化，而 `status` 没变）：
     - 新的 `stage` 在 `recorded` 及之后：`status = 'recorded'`。
     - 新的 `stage` 在 `recorded` 之前，且原来的 `status` 是 `recorded`：`status = 'ready'`。

   「之前 / 之后」按这个顺序比：`draft < refining < final < recorded < cut < published`。在 SQL 里写一个 `array_position` 小函数来比。

   **`scripts_log_change`**：保留现有写法，对上面列出的每一列都做「`is distinct from` 就记一条」。
   - 数组和数字转成文字再存。
   - 不记：`updated_at`、`stats_at`、`last_note_*`、`*_seen_at`、`edited_by`。
4. 删旧表：`drop table if exists public.post_notes; drop table if exists public.posts;`。`organizations.post_weekdays` 保留。

- [ ] **Step 2: 写触发器检查脚本 `supabase/tests/20261029_scripts_calendar_check.sql`**

一个 `DO $$ … $$` 块：在王小墨公司下插入临时稿子（`user_id` 用该公司 `orgOwner` 的 id），逐条 `assert`，任何一条不满足就 `raise exception`。要覆盖这些情况：

| 操作 | 期望 |
|---|---|
| 插入 `publish_on = '2026-11-03'` 的视频 | `record_by = '2026-10-29'` |
| `update publish_on = '2026-11-06'` | `record_by = '2026-11-01'`；`script_changes` 里多出 `publish_on` 和 `record_by` 两条，`actor_id` 都等于这次设的 `edited_by` |
| 手动 `update record_by = '2026-11-02'`，再改 `xhs_title` | `record_by` 仍是 `2026-11-02` |
| `update status = 'recorded'`（模拟 App 点已录），stage 原为 `final` | `stage = 'recorded'` |
| `stage = 'cut'` 时 `update status = 'ready'` | `status` 仍是 `recorded`，`stage` 仍是 `cut` |
| `stage = 'recorded'` 时 `update status = 'ready'` | `stage = 'final'` |
| `update stage = 'refining'`，原 `status = 'recorded'` | `status = 'ready'` |
| `update kind = 'image'` | `record_by` 为 null |
| `update publish_on = null` | `record_by` 为 null |

整段由 controller 用 `BEGIN; \i …; ROLLBACK;` 的方式执行：把文件内容包在 `begin; … rollback;` 里，交给 `execute_sql`。

- [ ] **Step 3: 自查**

迁移文件可以重复跑：所有语句都有 `if not exists`、`or replace`、`drop … if exists` 保护。

把要交给 Shawn 看的摘要写进报告：
- 改了哪些触发器；
- 删了哪两张表；
- 回填规则。

助手**不执行**迁移。

---

### Task 2: 纯逻辑改成第 3 版的进度模型

**Files:**
- Modify: `src/lib/studio/posts.ts`、`src/lib/studio/posts.test.ts`
- Modify: `src/lib/studio/posts-publish.ts`（+ 现有测试）
- Modify: `src/lib/studio/calendar.ts`、`src/lib/studio/calendar.test.ts`
- Modify: `src/lib/studio/changes.ts` + 新建 `src/lib/studio/changes.test.ts`（如果原来没有）

**Interfaces:**
- Produces：

```ts
// posts.ts
export type Stage = 'draft' | 'refining' | 'final' | 'recorded' | 'cut' | 'published';
export const STAGES: Stage[]; // 按上面的顺序
export function stagesFor(kind: PostKind): Stage[];                       // 图文去掉 'recorded'
export function stageLabel(stage: Stage, kind: PostKind, industry: string | null): string; // recorded：industry==='data' 时叫「已配音」，否则「已录」
export type Tone = 'todo' | 'final' | 'made' | 'done';                    // 草稿/精修中、定稿、已录/成片、已发布
export function toneOf(stage: Stage): Tone;
export type StageFields = { kind: PostKind; body: string; mediaUrl: string | null };
export function stageMissing(to: Stage, p: StageFields): string[];        // 到 final 及之后、视频：缺「正文」；到 cut 及之后：缺「成片链接」
export function checkStageChange(a: { from: Stage; to: Stage } & StageFields): string | null;
export function validateEdit(input: Record<string, unknown>, current: { stage: Stage } & StageFields & { xhsTitle: string; xhsBody: string }): Result<PostEdit>;
// PostEdit 的键：publish_on, title, kind, is_extra, series, episode, media_url, xhs_title, xhs_body, xhs_tags, stage, likes, saves, comments（+ stats_at）
// posts-publish.ts
export function publishPatch(url: unknown, cur: { stage: Stage; publishOn: string | null }, now: string, today: string): Result<Record<string, unknown>>;
export function unpublishPatch(cur: { stage: Stage; publishedUrl: string | null }): Result<Record<string, unknown>>; // 退回 'cut'
// calendar.ts
export function recordByFor(publishOn: string | null, leadDays: number, kind: PostKind): string | null;
export function recordWarning(p: { kind: PostKind; stage: Stage; recordBy: string | null }, today: string): boolean; // 「该录了」
// stockUntil / dueWarning：把原来的 'ready'（可发布）换成 'cut'（成片 = 做好了）
```

`validateEdit` 的规则（在第 2 版的基础上改）：
- `body` 不在可编辑的键里。正文到稿子页去改。
- `script_id` 去掉。
- 已发布的条目：不能改 `publish_on`，提示「已发布的不能改日期」；不能改 `stage`，提示「要撤回请点「撤回已发布」」。新清空必填字段的规则照搬，必填字段换成「成片链接」，对视频再加上正文。
- 贴了 `media_url`、而进度在 `cut` 之前 → 推到 `cut`。
- 清空 `media_url` 时，如果进度在 `cut` 或之后 → 退回 `final`。
- `kind` 改成 `image`，而 `stage` 是 `recorded` → 退回 `final`（和触发器一致）。

`changes.ts`：`describeChange` 要能描述新字段，例如：
- 「把发布日期从 11/3 改到 11/6」
- 「排到 11/3 发布」
- 「取消了发布日期」
- 「进度：精修中 → 定稿」
- 「改了小红书标题」
- 「贴了成片链接」
- 「标成已发布」
- 「赞 0 → 12000」
- 「加了一条备注」「删了一条备注」

- [ ] **Step 1: 改测试（先红）**

第 2 版的进度测试全部按新的阶段名改写，再加上下面这些：

```ts
test('stageLabel: data industry calls recorded 已配音', () => {
  assert.equal(stageLabel('recorded', 'video', 'data'), '已配音');
  assert.equal(stageLabel('recorded', 'video', 'accounting'), '已录');
});
test('stagesFor: image has no recorded', () => assert.ok(!stagesFor('image').includes('recorded')));
test('toneOf maps to four colours', () =>
  assert.deepEqual(STAGES.map(toneOf), ['todo', 'todo', 'final', 'made', 'made', 'done']));
test('stageMissing: final needs body for video, not for image; cut needs media', () => {
  assert.deepEqual(stageMissing('final', { kind: 'video', body: '', mediaUrl: null }), ['正文']);
  assert.deepEqual(stageMissing('final', { kind: 'image', body: '', mediaUrl: null }), []);
  assert.deepEqual(stageMissing('cut', { kind: 'video', body: 'x', mediaUrl: null }), ['成片链接']);
});
test('recordByFor: 5 days before, crosses month; image → null; no date → null', () => {
  assert.equal(recordByFor('2026-11-03', 5, 'video'), '2026-10-29');
  assert.equal(recordByFor('2026-11-03', 5, 'image'), null);
  assert.equal(recordByFor(null, 5, 'video'), null);
});
test('recordWarning: final video past record_by warns; recorded or image does not', () => {
  assert.equal(recordWarning({ kind: 'video', stage: 'final', recordBy: '2026-10-29' }, '2026-10-30'), true);
  assert.equal(recordWarning({ kind: 'video', stage: 'recorded', recordBy: '2026-10-29' }, '2026-10-30'), false);
  assert.equal(recordWarning({ kind: 'video', stage: 'final', recordBy: '2026-10-30' }, '2026-10-30'), false);
});
test('validateEdit: published refuses date change and drag back (publish_on null)', () => {
  const cur = { stage: 'published' as Stage, kind: 'video' as PostKind, body: 'b', mediaUrl: 'https://1drv.ms/x', xhsTitle: 't', xhsBody: 'b' };
  assert.equal(validateEdit({ publish_on: null }, cur).error, '已发布的不能改日期');
  assert.equal(validateEdit({ publish_on: '2026-11-10' }, cur).error, '已发布的不能改日期');
});
test('unpublishPatch goes back to cut', () =>
  assert.equal((unpublishPatch({ stage: 'published', publishedUrl: 'https://xhslink.com/a' }).value as { stage: string }).stage, 'cut'));
test('describeChange: publish_on and stage in plain words', () => {
  assert.equal(describeChange({ action: 'update', field: 'publish_on', old: '2026-11-03', new: '2026-11-06' }), '把发布日期从 11/3 改到 11/6');
  assert.equal(describeChange({ action: 'update', field: 'publish_on', old: null, new: '2026-11-03' }), '排到 11/3 发布');
  assert.equal(describeChange({ action: 'update', field: 'stage', old: 'refining', new: 'final' }), '进度：精修中 → 定稿');
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `npm test`
Expected: 新测试 FAIL。

- [ ] **Step 3: 实现**

第 2 版的 `stockUntil`、`dueWarning`、`isUnread`、`copyText`、`isXhsUrl`、`cleanMediaUrl`、`parseCount`、`cleanTags`、`parseSeriesLines` 都保留，只改阶段名。

- [ ] **Step 4: 运行，确认通过**

Run: `npm test && npx tsc --noEmit`
Expected: 全部通过。如果 tsc 报错只出现在 Task 3–6 要改的文件里，在报告里列出来，留给后面的任务处理。

---

### Task 3: 数据层和接口改成读写 `scripts`

**Files:**
- Modify: `src/lib/studio/posts-map.ts`(+test)、`src/lib/studio/posts-db.ts`
- Modify: `src/app/api/studio/posts/route.ts`、`posts/series/route.ts`、`posts/[id]/route.ts`、`posts/[id]/cover/route.ts`、`posts/[id]/notes/route.ts`、`src/app/api/studio/org/route.ts`
- Modify: `src/app/api/studio/changes/route.ts`（加公司范围的列表和管理员删除）

**Interfaces:**
- Consumes：Task 1 的列名，Task 2 的所有导出。
- Produces：

```ts
// posts-map.ts
export const POST_COLUMNS: string; // scripts 的列：id, org_id, title, body, status, code, record_by, publish_on, stage, kind, is_extra, series, episode, media_url, cover_path, xhs_title, xhs_body, xhs_tags, published_url, published_at, likes, saves, comments, stats_at, last_note_at, last_note_by_admin, admin_seen_at, client_seen_at, updated_at
export type CalendarPost = { /* 第 2 版字段，去掉 scriptId；加 */ body: string; recordBy: string | null; status: string; code: string | null };
export type DraftItem = { id: string; title: string; kind: PostKind; stage: Stage; updatedAt: string };
export type CalendarData = { /* 第 2 版字段 */ industry: string | null; leadDays: number; drafts: DraftItem[]; draftsTotal: number };
// 去掉 unscheduled（第 2 版的「未排期」由 drafts 取代）
```

接口：
- **`GET /api/studio/posts?month=`**：按 Global Constraints 里的口径，从 `scripts` 读日历条目，再加上 `drafts`。`drafts` 按 `updated_at` 倒序，最多 300 条，`draftsTotal` 是总数。另外返回 `industry`、`leadDays`。
- **`POST /api/studio/posts`（加一条）和 `POST /api/studio/posts/series`**：往 `scripts` 插入新行。
  - `user_id` 照 `src/app/api/studio/pull/route.ts:29` 的规则：本公司用 `user.id`，否则用 `orgOwner(orgId)`。
  - 其他字段：`org_id`、`created_by` 和 `edited_by` 都是 `user.id`，`source='self'`，`status='ready'`，`body=''`，`stage='draft'`，再写入 `publish_on`、`kind`、`is_extra`、`series`、`episode`。
  - 「已有安排的日子」改成查 `scripts`。
- **`PATCH /api/studio/posts/[id]`**：用 `scriptInScope` 找行，校验走 Task 2。update 时一律带上 `edited_by: user.id` 和 `updated_at`。返回的条目里，`record_by` 用触发器算好之后的值（update 后重新 select）。
- **`DELETE`**：已发布的不能删，其余的删整条口播稿。删除会被现有触发器记下。
- **封面上传**：存到 `posts/<orgId>/<scriptId>/`，规则照旧。
- **备注**：改用 `script_notes` 表。写入或删除备注时，再往 `script_changes` 插一条记录：`action='update', field='note', new_value=前 40 字`（删除时写 `old_value`）。`actor_id = user.id`。
- **`PATCH /api/studio/org`**：接收 `{ weekdays?, leadDays? }`。
  - `leadDays` 必须是 0–30 的整数，不合格回 400「提前天数要在 0 到 30 之间」。
  - 改了 `leadDays` 时，给这家公司 `publish_on >= 今天`、`kind='video'`、`stage` 在 `recorded` 之前、`status <> 'archived'` 的行逐条更新 `record_by`，带上 `edited_by`。新值用 `recordByFor` 算。
- **`GET /api/studio/changes`**：
  - 保留 `?scriptId=`。
  - 新增 `?scope=org&limit=100`：返回这家公司最近的改动，每条带 `scriptId` 和稿子标题。
  - 新增 `DELETE ?id=`：只有管理员能删，删除时按 `org_id` 核对；非管理员回 403「只有 Fordexa 能删记录」。
- **权限**：删掉第 2 版所有「只有 Fordexa 能改」的管理员检查，**只保留**删除修改记录这一处。

- [ ] **Step 1: 先改 `posts-map.ts` 的纯函数测试（`toCalendarPost` 的映射、`validateNewPost`、`validateLeadDays`），确认它们失败**

```ts
test('validateLeadDays: 0..30 integers only', () => {
  assert.equal(validateLeadDays(5).value, 5);
  assert.equal(validateLeadDays(31).error, '提前天数要在 0 到 30 之间');
  assert.equal(validateLeadDays('5').error, '提前天数要在 0 到 30 之间');
});
```

- [ ] **Step 2: 实现映射和接口**

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit && npm test`
Expected: 没有错误。页面组件（Task 4、5）里的类型错误可以在报告里列出来，留给后面处理。

---

### Task 4: 面板和格子改成第 3 版

**Files:**
- Modify: `src/app/studio/calendar/{PostPanel,PanelHeader,StageBar,PostChip,PublishActions,XhsFields,MonthGrid,AgendaList,page}.tsx`
- Modify: `src/app/studio/calendar/ScriptSection.tsx`：改成显示正文、试听键和「去精修 ↗」链接到 `/studio/s/<id>`，去掉关联下拉框
- Create: `src/app/studio/calendar/ChangeList.tsx`：面板里折叠的「修改记录」；管理员每条后面有「删」，删之前在面板里二次确认
- Delete: `src/app/studio/calendar/Unscheduled.tsx`（被 Task 5 的侧栏取代）

**Interfaces:**
- Consumes：Task 2（`stagesFor`、`stageLabel`、`toneOf`、`recordWarning`），Task 3（`CalendarData`、`CalendarPost`，以及 `/api/studio/changes?scriptId=` 和它的 DELETE）。
- Produces：`ChangeList({ scriptId, isAdmin })`，Task 5 的公司范围记录也复用它的单行组件 `ChangeRow`（同一文件导出）。

要点：
- 所有编辑控件对双方都显示，原来的 `isAdmin` 判断只用来控制「删记录」。
- 格子颜色和「该录了」按 Global Constraints。
- 「已录」的文字通过 `data.industry` 决定（`stageLabel` 的第 3 个参数）。
- 面板头显示「发布日期 · 要录完 M/D」（视频才显示后半句）。

- [ ] **Step 1: 改组件**
- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit && npm test`
Expected: 通过。

---

### Task 5: 待排侧栏、拖放、公司设置、公司修改记录

**Files:**
- Create: `src/app/studio/calendar/DraftsRail.tsx`：侧栏，包括搜索框、条目列表、每条的「排到…」日期按钮、「还有 N 条没显示」
- Create: `src/lib/studio/dnd.ts` + `dnd.test.ts`：纯函数 `dropPatch(source: 'draft' | 'calendar', target: { day: string } | 'rail', post: { stage: Stage; publishOn: string | null }): Result<{ publish_on: string | null }>`
- Modify: `MonthGrid.tsx`（格子接受放下、条目可以拖起）、`AdminToolbar.tsx`（改名 `CalendarToolbar.tsx`，对双方显示；固定发布日旁边加「提前 [5] 天录完」数字输入，失焦保存）、`page.tsx`（电脑上侧栏放月历右边；手机上月历上方一个「待排 N 条」按钮，点开是底部列表）
- Create: `src/app/studio/calendar/OrgChanges.tsx`：日历页上「修改记录」按钮打开的抽屉，调用 `?scope=org`，每条点了就打开那一条的面板（复用 `ChangeRow`）

**Interfaces:**
- Consumes：Task 3 的 `drafts`、`draftsTotal`、`leadDays`、`PATCH /api/studio/org { leadDays }`，Task 4 的 `ChangeRow`。

拖放用原生 HTML5 Drag and Drop（`draggable`、`onDragStart` 用 `dataTransfer.setData('text/plain', id)`、`onDragOver` 里 `preventDefault`、`onDrop`）。放下后先用 `dropPatch` 判断：
- 返回 error：toast 原话，格子不动。
- 通过：PATCH `{ edit: { publish_on } }`，成功后 `reload()`。

- [ ] **Step 1: 写 `dnd.test.ts`（先红）**

```ts
test('dropPatch: draft onto a day schedules it', () =>
  assert.deepEqual(dropPatch('draft', { day: '2026-11-03' }, { stage: 'draft', publishOn: null }).value, { publish_on: '2026-11-03' }));
test('dropPatch: calendar item back to rail clears the date', () =>
  assert.deepEqual(dropPatch('calendar', 'rail', { stage: 'final', publishOn: '2026-11-03' }).value, { publish_on: null }));
test('dropPatch: published cannot move or go back', () => {
  assert.equal(dropPatch('calendar', 'rail', { stage: 'published', publishOn: '2026-11-03' }).error, '已发布的不能改日期');
  assert.equal(dropPatch('calendar', { day: '2026-11-04' }, { stage: 'published', publishOn: '2026-11-03' }).error, '已发布的不能改日期');
});
test('dropPatch: dropping on the same day is a no-op error', () =>
  assert.equal(dropPatch('calendar', { day: '2026-11-03' }, { stage: 'final', publishOn: '2026-11-03' }).error, ''));
```

空字符串 error 表示什么都不做，也不弹 toast。

- [ ] **Step 2: 实现 `dropPatch`，测试转绿**
- [ ] **Step 3: 实现侧栏、拖放、设置、公司修改记录**
- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit && npm test`
Expected: 通过。

---

### Task 6: 口播库页面显示排期和进度

**Files:**
- Modify: `src/app/api/studio/scripts/route.ts`（GET 多返回 `publish_on`、`stage`、`kind`；PATCH 不变，排期统一走 `/api/studio/posts/[id]`）
- Modify: `src/app/studio/api.ts`（`StudioScript` 加 `publish_on`、`stage`、`kind`）
- Modify: `src/app/studio/WeekView.tsx`：每行加「发布 M/D」或「未排期」，以及进度小标签
- Modify: `src/app/studio/s/[id]/ScriptPanel.tsx`：加「发布日期」日期选择（PATCH `/api/studio/posts/<id>` `{ edit: { publish_on } }`）和只读的进度标签，旁边链接「在日历里看 ↗」（`/studio/calendar?post=<id>`）

**Interfaces:**
- Consumes：Task 2 的 `stageLabel`、`toneOf`，Task 3 的 PATCH 接口。

- [ ] **Step 1: 改接口和组件**
- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit && npm test`
Expected: 通过。

---

### Task 7: 跑迁移、整体验证（controller）

- [ ] **Step 1**：把 Task 1 的迁移摘要和 SQL 交给 Shawn，等他同意。
- [ ] **Step 2**：`apply_migration`。然后用 `execute_sql` 跑 `begin; <检查脚本>; rollback;`。Expected：没有异常。
- [ ] **Step 3**：`npx tsc --noEmit && npm test && npx next build`，然后重启 3461 端口的服务。
- [ ] **Step 4**：在浏览器里走一遍（王小墨，管理员账号）：
  1. 从灵感库拉一条，它出现在「待排」里。
  2. 把它拖到下周二。格子显示「草稿」，面板里显示「要录完」是往前推 5 天的日子。
  3. 拖到周五，「要录完」跟着变。
  4. 点「定稿」：正文为空时有提示。
  5. 把「提前天数」改成 3，「要录完」跟着变。
  6. 贴成片链接，进度到「成片」。
  7. 贴发布链接，格子变紫。
  8. 把它拖回侧栏：被拒绝。
  9. 面板里的修改记录列出了上面每一步，日历页的公司修改记录也有。
  10. 删除一条修改记录（管理员可以删）。
  11. 口播库页面显示这条的发布日期和进度。
- [ ] **Step 5**：用 SQL 模拟 App 写回旧状态（`update scripts set status='ready', edited_by=null where id=…` 放在事务里）。确认已「成片」的条目不受影响，然后回滚。
- [ ] **Step 6**：最终整体审查（最强模型），修一轮，复审。报「已改好未提交」，列出替 Shawn 做的决定。
