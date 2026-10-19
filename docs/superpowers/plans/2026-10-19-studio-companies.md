# 工作台第二期（按公司共享 + 切换公司 + Fordexa 稿占用 + 反馈 + 头像）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 工作台向已开通公司的成员开放、按公司共享稿子；管理员能切换到任意公司操作；稿子修改全部留痕；Fordexa 稿全站只给一家；工作台内可带截图反馈；每人可上传头像。

**Architecture:** 数据库一份迁移（Shawn 手动跑）：`scripts` 加 `org_id / created_by / edited_by`，触发器负责补公司、锁主人、记修改、占 Fordexa 稿——这样 App 的直接写入也被覆盖。网页接口仍走 service key，`requireStudioUser` 改为返回「当前在看的公司」，所有稿子核对从「按 user_id」换成「按 org_id」。前端 `studioFetch` 带 `x-studio-org` 请求头，切换公司时整棵工作台重挂载。

**Tech Stack:** Next.js 15 App Router、React 19、Tailwind 4、Supabase（Postgres 触发器、Storage、Auth）、Resend、Node 24 `node --test`。

**Spec:** `docs/superpowers/specs/2026-10-19-studio-companies-design.md`（含「审阅后补充的决定」一节）

## Global Constraints

- **不提交、不推送**：Shawn 的规则——整批做完、本地验证后报告「已改好未提交，等你确认」，他确认后才 commit + push。本计划里没有逐任务的 commit 步骤。
- 不改 App（`prompter` 仓库），不改 `scripts` 的 RLS policy。
- 数据库迁移 SQL 由 Shawn 在 Supabase SQL Editor 里跑；Claude 写好文件后停下等他说「跑完了」。
- 新表一律 `enable row level security` 且不加 policy（只走 service key）。触发器函数 `security definer` + `set search_path = public`。
- 每个网页接口对 `scripts` 的写入（insert / update）都带 `edited_by: <当前登录人 id>`。
- 界面文案用中文；按钮高度、圆角、配色沿用工作台现有 class（`h-11`/`h-14`、`rounded-2xl`、`var(--accent)` 等）。
- localStorage 读写全部 try/catch，读不到就当没存。
- 测试命令：`npm test`（`node --test "src/**/*.test.ts"`）；类型：`npx tsc --noEmit`；构建：`npx next build`。
- 测试会写真实数据库：只用 Shawn 的账号和 App Review Demo 账号，测试新建的稿子 / 占用 / 反馈用完删掉，留下的写进最终报告。绝不改 Shawn 已有稿子的内容。

## Review Focus

1. **App 的 upsert 会先触发 BEFORE INSERT**：App 保存一条已有的稿子走 `INSERT … ON CONFLICT DO UPDATE`，BEFORE INSERT 触发器会先跑一遍；如果在这里清空正文 / 占用，会把老稿子清空。触发器必须先判断「这个 id 已经存在就原样返回」。→ Task 1 验证脚本第 6 项。
2. **浏览器里存着一个无效的公司**（管理员存的公司被删了；或同一台电脑上换成了普通成员登录）：服务端必须回落到自己的公司，不能 403 死循环。→ Task 2 `pickViewingOrg` 测试。
3. **版本的试听 / 复核 / 「用这版」按版本的 `user_id` 核对**：Shawn 在客户公司里生成的版本，客户成员必须能听、能用。三处都要改成「版本所属稿子在当前公司」。→ Task 3 验证第 3 项。
4. **iPhone 相册里的照片是 HEIC**：反馈截图只收 png/jpg/webp/gif，HEIC 要给出明确提示，不能静默丢掉或报 500。→ Task 7 `validateFeedback` 测试。
5. **管理员给一家还没有任何成员的公司拉稿**：要给明确提示「这家公司还没有人登录过」，不能插一条没主人的稿子。→ Task 3 `pull` 验证。

---

### Task 1: 数据库迁移

**Files:**
- Create: `supabase/migrations/20261019_studio_companies.sql`
- Create（不入库，scratchpad）：`db-check.mjs`

**Interfaces:**
- Produces（后面所有任务依赖的表结构）：
  - `scripts.org_id uuid references organizations(id)`, `scripts.created_by uuid references profiles(id)`, `scripts.edited_by uuid`；索引 `scripts(org_id)`
  - `script_changes(id uuid pk default gen_random_uuid(), script_id uuid not null, org_id uuid, actor_id uuid, at timestamptz default now(), action text check in ('create','update','delete'), field text check in ('title','body','record_by','status') or null, old_value text, new_value text)`；索引 `(script_id, at desc)`。`script_id` 不加外键。
  - `fordexa_claims(code text pk, org_id uuid not null, script_id uuid, claimed_by uuid, claimed_at timestamptz default now())`
  - `bug_reports(id uuid pk, reporter_id uuid references profiles(id) on delete set null, org_id uuid, page_url text, message text not null, image_paths text[], status text default 'open' check in ('open','resolved'), resolved_at timestamptz, resolved_by uuid, created_at timestamptz default now())`；索引 `(status, created_at desc)`、`(reporter_id, created_at desc)`
  - `profiles.avatar_path text`
  - 公开桶 `avatars`（`insert into storage.buckets (id, name, public) values ('avatars','avatars',true) on conflict do nothing`）

- [ ] **Step 1: 写迁移 SQL，顺序固定**（先回填、后建触发器，回填才不会被记成修改）：
  1. 加列、建表、建桶、加 `profiles.avatar_path`。
  2. 回填 `scripts.org_id = profiles.org_id`（按 `user_id`），`created_by = user_id`。
  3. 回填 `fordexa_claims`：`source='fordexa' and code is not null and org_id is not null` 的稿子，每个 `code` 取 `created_at` 最早那条的 `(org_id, id, user_id, created_at)`。
  4. 函数 `scripts_before_insert()`：
     ```
     if exists (select 1 from scripts where id = NEW.id) then return NEW; end if;   -- App upsert 已有行
     NEW.org_id := coalesce(NEW.org_id, (select org_id from profiles where id = NEW.user_id));
     NEW.created_by := coalesce(NEW.created_by, auth.uid(), NEW.user_id);
     if NEW.source = 'fordexa' and NEW.code is not null and NEW.org_id is not null then
       insert into fordexa_claims(code, org_id, script_id, claimed_by)
         values (NEW.code, NEW.org_id, NEW.id, coalesce(NEW.edited_by, auth.uid(), NEW.user_id))
         on conflict (code) do nothing;
       if (select org_id from fordexa_claims where code = NEW.code) <> NEW.org_id then
         NEW.body := ''; NEW.source := 'self';
       end if;
     end if;
     return NEW;
     ```
  5. 函数 `scripts_before_update()`：`NEW.user_id := OLD.user_id; NEW.org_id := coalesce(OLD.org_id, NEW.org_id); NEW.created_by := coalesce(OLD.created_by, NEW.created_by); return NEW;`
  6. 函数 `scripts_log_change()`（AFTER INSERT OR UPDATE，及单独的 BEFORE DELETE）：actor = `coalesce(auth.uid(), NEW.edited_by)`（删除时用 `OLD.edited_by`）。INSERT 记一行 `action='create', new_value=NEW.title`；UPDATE 对 `title/body/record_by/status` 中 `IS DISTINCT FROM` 的每一个记一行（`old_value/new_value` 存文本）；DELETE 记一行 `action='delete', old_value = OLD.title || E'\n\n' || OLD.body`。
  7. 建触发器：`before insert` → 4，`before update` → 5，`after insert or update` → 6，`before delete` → 6。
  8. 所有新表 `enable row level security`。
- [ ] **Step 2: 停下，请 Shawn 在 Supabase SQL Editor 跑这份文件**，等他回复跑完。
- [ ] **Step 3: 写 scratchpad `db-check.mjs`**（`node --env-file=.env.local`，用 admin `generate_link` 给账号现签会话，令牌只放内存），用 Shawn 的用户令牌直接打 PostgREST（模拟 App）：
  1. 新建一条 `source='self'` 测试稿 → `org_id` = 王小墨，`created_by` = Shawn，`script_changes` 有一条 create、`actor_id` = Shawn。
  2. 用户令牌 PATCH 改 `title` 和 `record_by` → 两条 update，actor = Shawn。
  3. 用户令牌 PATCH 带 `user_id: <别人>` → `user_id` 没变。
  4. service key PATCH 带 `edited_by: <Shawn>` 改 body → 一条 update，actor = Shawn。
  5. 找一个已被别家占用的 code（没有就用 service key 往 `fordexa_claims` 插一条 App Review Demo 公司的测试占用），用户令牌插 `source='fordexa'` + 那个 code → 落库 `body=''`、`source='self'`。
  6. 用户令牌对第 1 步那条做 App 式 upsert（带 `id`、`source='fordexa'`、被占用的 code、非空 body）→ body 保留原样（Review Focus 1）。
  7. 用户令牌删掉测试稿 → `script_changes` 有 delete，old_value 含标题。
  8. 清理：删测试占用、测试稿、它们的 `script_changes`。
  Expected: 8 项全部打印 OK。
- [ ] **Step 4: 查回填结果**：打印 `fordexa_claims` 全部行（code、公司名、日期），报告里列给 Shawn（王小墨测试时占了哪些）。

---

### Task 2: 服务端「在看的公司」与核对

**Files:**
- Create: `src/lib/studio/scope.ts`, `src/lib/studio/scope.test.ts`
- Modify: `src/lib/studio/server.ts`, `src/lib/studio/preview.ts`, `src/lib/studio/preview.test.ts`, `src/lib/voice.ts`

**Interfaces:**
- Produces（`scope.ts`，纯函数）：
  - `pickViewingOrg(a: { isAdmin: boolean; ownOrgId: string | null; requested: string | null; requestedExists: boolean }): string | null` —— 管理员且请求的公司存在 → 请求的；否则 → 自己的。
  - `canEnterStudio(a: { isAdmin: boolean; ownOrgActive: boolean }): boolean`
  - `canUseFordexa(claimOrgId: string | null, orgId: string | null): boolean` —— 没人占或占用者就是本公司。
- Produces（`preview.ts`）：`previewPathAllowed(path: string | null | undefined, a: { orgId: string; ownerId: string }): boolean` —— 认 `audio/org/<orgId>/` 和旧的 `audio/<ownerId>/`，含 `..` 一律否。替换 `ownsPreviewPath`（全部调用点改掉后删除旧函数）。
- Produces（`server.ts`）：
  - `type StudioUser = { id: string; email: string; isAdmin: boolean; ownOrgId: string | null; orgId: string | null }`（`orgId` = 在看的公司）
  - `requireStudioUser(request)`：读 `profiles.is_admin, org_id, organizations(is_active)`；`canEnterStudio` 不过 → null；请求头 `x-studio-org`（只认 uuid 格式）交给 `pickViewingOrg`（`requestedExists` 查 `organizations`）。
  - `scriptInScope(orgId: string | null, id: string): Promise<ScriptRow | null>`（按 `org_id`）替换 `ownScript`；`ScriptRow` / `SCRIPT_COLUMNS` 加 `org_id, created_by`。
  - `versionInScope(orgId: string | null, versionId: string): Promise<{ version: { id: string; script_id: string; kind: string; body: string; checks: unknown }; script: ScriptRow } | null>`
  - `orgOwner(orgId: string): Promise<string | null>` —— 该公司 `profiles.created_at` 最早的成员。
  - `claimFor(code: string): Promise<{ org_id: string } | null>`
  - `sourceForScript(script)`：内部用 `canUseFordexa(claim, script.org_id)` 决定 `original` 传原稿还是 `null`。
  - `ensureFordexaVersion(script)`：`canUseFordexa` 为假时不补 n=0。
  - `type Person = { id: string; name: string; avatarUrl: string | null; isAdmin: boolean }`；`peopleById(ids: string[]): Promise<Map<string, Person>>` —— `name` = `display_name` → 邮箱 @ 前（`auth.admin.getUserById`）→ `'未命名'`。
- Produces（`voice.ts`）：`resolveStudioVoice(user: StudioUser): Promise<{ voiceId: string; from: VoiceSource }>` —— `user.isAdmin && user.orgId !== user.ownOrgId` 时只看公司声音 → 默认；否则同 `resolveVoice(user.id)`。
- Modify（`fact-rules.ts`）：`SourceInput.original: string | null`；为 null 时不输出【Fordexa 原稿】段。

- [ ] **Step 1: 写测试** `scope.test.ts`：
  ```ts
  test('admin may view any existing org', () => assert.equal(pickViewingOrg({ isAdmin: true, ownOrgId: 'a', requested: 'b', requestedExists: true }), 'b'));
  test('admin falls back when requested org is gone', () => assert.equal(pickViewingOrg({ isAdmin: true, ownOrgId: 'a', requested: 'x', requestedExists: false }), 'a'));
  test('member always sees own org', () => assert.equal(pickViewingOrg({ isAdmin: false, ownOrgId: 'a', requested: 'b', requestedExists: true }), 'a'));
  test('no header → own org', () => assert.equal(pickViewingOrg({ isAdmin: true, ownOrgId: 'a', requested: null, requestedExists: false }), 'a'));
  test('only admins and active-org members enter', () => { assert.equal(canEnterStudio({ isAdmin: false, ownOrgActive: false }), false); assert.equal(canEnterStudio({ isAdmin: false, ownOrgActive: true }), true); assert.equal(canEnterStudio({ isAdmin: true, ownOrgActive: false }), true); });
  test('fordexa script usable when unclaimed or claimed by us', () => { assert.equal(canUseFordexa(null, 'a'), true); assert.equal(canUseFordexa('a', 'a'), true); assert.equal(canUseFordexa('b', 'a'), false); });
  ```
  `preview.test.ts` 加：`audio/org/o1/x.mp3` 对 `{orgId:'o1'}` 为真、对 `o2` 为假；`audio/u1/x.mp3` 对 `ownerId:'u1'` 为真；`audio/org/o1/../o2/x.mp3` 为假；null 为假。`fact-rules.test.ts` 加：`original: null` 时输出不含 `【Fordexa 原稿】`、仍含【选题】【文章】【出处】。
- [ ] **Step 2:** `npm test` → 新测试 FAIL（函数未定义）。
- [ ] **Step 3:** 实现以上 Interfaces。
- [ ] **Step 4:** `npm test` → 全部 PASS；`npx tsc --noEmit` 此时会因调用点未改而报错，留给 Task 3。

---

### Task 3: 工作台接口改为按公司

**Files:**
- Modify: `src/app/api/studio/scripts/route.ts`, `pull/route.ts`, `versions/route.ts`, `generate/route.ts`, `review/route.ts`, `audio/route.ts`, `prompt/route.ts`
- Create: `src/app/api/studio/me/route.ts`, `src/app/api/studio/claims/route.ts`, `src/app/api/studio/changes/route.ts`
- Create: `src/lib/studio/changes.ts`, `src/lib/studio/changes.test.ts`
- Modify: `src/app/api/admin/scripts/route.ts`（POST/PATCH 带 `edited_by`，POST 带 `created_by: 管理员 id`；有 DELETE 的话删前先写 `edited_by`）

**Interfaces:**
- Consumes: Task 2 全部。
- Produces（接口）：
  - `GET /api/studio/me` → `{ me: Person, ownOrgId: string | null, viewing: { id: string; name: string } | null, orgs?: { id: string; name: string; is_active: boolean; members: number }[] }`（`orgs` 只给管理员）。StudioShell 用它做准入（403 = 未开放）。
  - `GET /api/studio/scripts` 每条多 `createdBy: Person | null`；按 `org_id = user.orgId` 取。
  - `POST /api/studio/pull` → `{ id: string; taken: boolean }`。`user_id` = `user.ownOrgId === user.orgId ? user.id : await orgOwner(user.orgId)`，为 null → 400 `这家公司还没有人登录过，没法往它的口播库里放稿子`。被别家占用 → 插 `source='self', body=''`、不写版本、`taken: true`；否则同现在（`source='fordexa'`、版本 0）。都带 `org_id, created_by: user.id, edited_by: user.id`。
  - `GET /api/studio/claims` → `{ claims: Record<string, 'ours' | 'taken'> }`（相对 `user.orgId`）。
  - `GET /api/studio/changes?scriptId=` → `{ changes: { id: string; at: string; action: string; field: string | null; old: string | null; new: string | null; text: string; actor: Person | null }[] }`，新的在前，最多 100 条；先 `scriptInScope` 核对。
  - 试听路径改为 `audio/org/<orgId>/<scriptId>-<rand>.mp3` 与 `audio/org/<orgId>/v-<versionId>-<voiceId>.mp3`；核对用 `previewPathAllowed(path, { orgId: script.org_id, ownerId: script.user_id })`；声音用 `resolveStudioVoice(user)`。
  - 版本相关（audio 的 `versionId`、review 的 `versionId`、versions POST）一律 `versionInScope(user.orgId, id)`，不再 `.eq('user_id', user.id)`。所有 `scripts` 更新的 `.eq('user_id', user.id)` 换成 `.eq('org_id', user.orgId)`。
  - `prompt` 路由不用改逻辑（已用 `user.orgId`，现在就是在看的公司）。
- Produces（`changes.ts`）：`describeChange(c: { action: 'create' | 'update' | 'delete'; field: string | null; old: string | null; new: string | null }): string`

- [ ] **Step 1: 写测试** `changes.test.ts`，文案固定：
  ```ts
  assert.equal(describeChange({ action: 'create', field: null, old: null, new: '标题' }), '新建了这条稿子');
  assert.equal(describeChange({ action: 'delete', field: null, old: '标题\n\n正文', new: null }), '删除了这条稿子');
  assert.equal(describeChange({ action: 'update', field: 'title', old: '旧', new: '新' }), '改了标题：旧 → 新');
  assert.equal(describeChange({ action: 'update', field: 'body', old: 'a', new: 'b' }), '改了正文');
  assert.equal(describeChange({ action: 'update', field: 'record_by', old: null, new: '2026-10-21' }), '排到 10/21 录完');
  assert.equal(describeChange({ action: 'update', field: 'record_by', old: '2026-10-21', new: '2026-10-23' }), '把要录完日期从 10/21 改到 10/23');
  assert.equal(describeChange({ action: 'update', field: 'record_by', old: '2026-10-21', new: null }), '取消了排期（原来 10/21）');
  assert.equal(describeChange({ action: 'update', field: 'status', old: 'ready', new: 'recorded' }), '标成了已录');
  assert.equal(describeChange({ action: 'update', field: 'status', old: 'recorded', new: 'ready' }), '标回了待录');
  assert.equal(describeChange({ action: 'update', field: 'status', old: 'ready', new: 'archived' }), '移出了口播库');
  ```
- [ ] **Step 2:** `npm test` → FAIL。
- [ ] **Step 3:** 实现 `describeChange` 和以上全部接口改动。
- [ ] **Step 4:** `npm test` PASS；`npx tsc --noEmit` 0 错误；`grep -rn "ownScript\|ownsPreviewPath\|eq('user_id', user.id)" src/app/api/studio src/lib/studio` → 无结果（voice / voice/train 改的是 `profiles`，用 `.eq('id', user.id)`，不受影响）。
- [ ] **Step 5: 实测**（dev server `npx next dev -p 3123`，scratchpad 脚本，令牌只放内存）：
  1. Shawn 不带头 `GET /api/studio/me` → viewing = 王小墨，`orgs` 有 6 家。
  2. Shawn 带 `x-studio-org: <App Review Demo>` 拉一个未被占用的选题 → `taken:false`，稿子 `user_id` = 那家最早的成员；用 App Review Demo 账号 `GET /api/studio/scripts` 能看到它，`createdBy.name` 是 Shawn 的名字。
  3. 用 Shawn 的令牌（在那家）生成一版 → 用 App Review Demo 账号对这一版调 `/api/studio/audio`（versionId）、`/api/studio/versions` POST 都 200（Review Focus 3）。
  4. App Review Demo 账号带 `x-studio-org: <王小墨>` 请求 → 仍只看到自己公司；对王小墨一条稿子的 id 调 PATCH → 404。
  5. App Review Demo 账号再拉第 2 步那个选题 → 成功（同公司占用者）；Shawn 切回王小墨拉同一个 → `taken:true`，正文为空、没有版本 0，生成时材料不含【Fordexa 原稿】（在 generate 路由临时 `console.log` 材料头 200 字验证后删掉）。
  6. Shawn 带一家零成员公司的头调 pull → 400 提示语（Review Focus 5）。若没有零成员公司，用 service key 临时建一家，测完删。
  7. `GET /api/studio/changes` 对第 2 步的稿子 → 有 create（Shawn）、生成后「用这版」的 body 修改（actor 正确）。
  8. 清理：删测试稿、对应 `fordexa_claims` 行、版本和试听文件。

---

### Task 4: 前端切换公司与准入

**Files:**
- Modify: `src/app/studio/api.ts`, `src/app/studio/StudioShell.tsx`
- Create: `src/app/studio/OrgSwitcher.tsx`, `src/app/studio/viewing.ts`

**Interfaces:**
- Consumes: `GET /api/studio/me`。
- Produces（`viewing.ts`）：`const VIEWING_KEY = 'studio-org'`；`readViewing(): string | null`；`writeViewing(id: string | null): void`（try/catch）。
- `studioFetch` 和 `studioToken` 之外所有工作台请求（含 `useScriptEditor` 里直接用 `fetch` 的生成流、`ideas/page.tsx` 的 `authedGet`）都带 `x-studio-org: readViewing()`（有值才带）。导出 `studioHeaders(token: string): Record<string, string>` 给这两处复用。
- StudioShell：准入改用 `/api/studio/me`；拿到的 `viewing.id` 与本地存的不一致时 `writeViewing(viewing.id)`（服务端回落时纠正本地）。`children` 包在 `<div key={viewing?.id ?? 'none'}>` 里，切换即整棵重挂载。暴露 `useStudioMe()`（React context：`{ me, viewing, ownOrgId, orgs, switchTo(id) }`）给其他组件。`switchTo` = `writeViewing` + 重新取 `/me` + `router.push('/studio')`。
- 未开放页文案：标题「工作台还没对你开放」，正文「你的账号还没加入已开通的公司。联系 Fordexa 开通后再来。」
- OrgSwitcher（只在 `orgs` 存在时渲染）：
  - 电脑：顶栏「口播工作台」右边一个 `<select>` 样式的下拉，选项「公司名」+ 未开通的加「（未开通）」。
  - 手机：`main` 上方一条 44px 高窄栏，左边「正在看」+ 公司名，右边「切换」，点开是底部弹出列表。
  - `viewing.id !== ownOrgId` 时，窄栏（手机）和顶栏下方一条（电脑）用醒目底色（`bg-[var(--record)]` 一类的现有强调色，文字白色），文字「你正在看：<公司名> 的口播库」。

- [ ] **Step 1:** 实现。
- [ ] **Step 2:** `npx tsc --noEmit` 0 错误。
- [ ] **Step 3: 浏览器实测**（390px 和 1280px）：切到 App Review Demo → 醒目条出现、口播库只剩那家的稿子；刷新后仍在那家；切回 → 醒目条消失。在 DevTools 把 localStorage `studio-org` 改成一个随机 uuid 后刷新 → 回到王小墨、不报错（Review Focus 2）。

---

### Task 5: 「谁放的」和修改记录界面

**Files:**
- Create: `src/app/studio/Avatar.tsx`, `src/app/studio/s/[id]/ChangeLog.tsx`
- Modify: `src/app/studio/api.ts`（`StudioScript.createdBy: Person | null`；导出 `Person` 类型，与服务端同形）, `src/app/studio/WeekView.tsx`, `src/app/studio/s/[id]/ScriptPanel.tsx`

**Interfaces:**
- Consumes: `GET /api/studio/scripts` 的 `createdBy`、`GET /api/studio/changes`、`diffLines`（`src/lib/studio/prompt-diff.ts`）。
- Produces: `<Avatar person={Person | null} size={20 | 28 | 40 | 72} />` —— 有 `avatarUrl` 显示圆图，否则圆形底色 + `name` 第一个字；null 显示「系」。Task 8 复用。
- WeekView 每行标题下的小字行加 `<Avatar size={20}>` + 名字。
- ScriptPanel 底部一个 `<details>`「修改记录」，展开时才请求 `/api/studio/changes`；每行：Avatar 28 + 名字 + 时间（墨尔本时间 `M/D HH:mm`）+ `text`；`field==='body'` 的行可再点开看 `diffLines(old, new)`（样式照 PromptPanel 的改动视图）。

- [ ] **Step 1:** 实现。
- [ ] **Step 2:** `npx tsc --noEmit` 0 错误；浏览器：改一次日期、改一次正文，修改记录里出现两条且人名正确，正文那条能看差异。

---

### Task 6: Fordexa 稿占用（灵感库 + 后台）

**Files:**
- Modify: `src/app/studio/ideas/page.tsx`
- Create: `src/app/api/admin/claims/route.ts`, `src/app/admin/ClaimsSection.tsx`
- Modify: `src/app/admin/page.tsx`（在「合作公司」区后面挂 `<ClaimsSection token={token} />`）

**Interfaces:**
- Consumes: `GET /api/studio/claims`、`POST /api/studio/pull` 的 `taken`。
- Produces: `GET /api/admin/claims` → `{ claims: { code: string; title: string | null; orgName: string | null; claimedBy: string | null; claimedAt: string }[] }`（新的在前）；`DELETE /api/admin/claims?code=` → `{ ok: true }`，删行并 `console.info('[claims] released', { code, by: adminId })`。都用 `requireAdmin`。
- 灵感库每条口播旁：`'ours'` → 灰色「已在你们的口播库」（按钮仍可再拉）；`'taken'` → 黄色 Pill「Fordexa 稿已被使用」，按钮文字改「拉来自己写」；拉完 `taken:true` 的提示「已拉到口播库。Fordexa 稿已被别家使用，正文是空的——在稿子页点生成，按你们的风格写一份」。
- ClaimsSection：列表（编号、标题、公司、谁、日期）+ 每行「释放」按钮（点后行内二次确认「确定释放？」，不用 `window.confirm`）。

- [ ] **Step 1:** 实现。
- [ ] **Step 2:** `npx tsc --noEmit` 0 错误；浏览器：用 Task 3 的方法造一个别家占用 → 灵感库显示黄标、拉下来正文为空；后台列表能看到并释放，释放后灵感库标签消失。清理测试数据。

---

### Task 7: Bug 反馈

**Files:**
- Create: `src/lib/feedback.ts`, `src/lib/feedback.test.ts`
- Modify: `src/lib/mail.ts`（`send()` 支持附件；新增 `mailBugReport`）
- Create: `src/app/api/studio/feedback/route.ts`, `src/app/studio/FeedbackSheet.tsx`
- Modify: `src/app/studio/StudioShell.tsx`（电脑右下角按钮）, `src/app/studio/me/page.tsx`（手机入口一行）
- Create: `src/app/api/admin/feedback/route.ts`, `src/app/admin/FeedbackSection.tsx`；Modify `src/app/admin/page.tsx`（挂在 ClaimsSection 前）

**Interfaces:**
- Produces（`feedback.ts`，纯函数）：
  - `const FEEDBACK_LIMITS = { maxImages: 4, maxImageBytes: 6 * 1024 * 1024, maxMessage: 5000, perHour: 10 }`，`const FEEDBACK_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']`
  - `validateFeedback(input: { message: string; images: { type: string; size: number }[] }): string | null` —— 返回错误文案或 null。
  - `feedbackImageExt(mime: string): 'png' | 'jpg' | 'webp' | 'gif'`
- Produces（`mail.ts`）：`send()` 的 `Mail` 加 `attachments?: { filename: string; content: Buffer }[]`，发给 Resend 时转 `{ filename, content: base64 }`；`mailBugReport(opts: { reporterName: string; reporterEmail: string; orgName: string | null; pageUrl: string | null; message: string; attachments: { filename: string; content: Buffer }[] }): Promise<boolean>` —— 发给 `MAIL_ADMIN`，`reply_to` = 提交人邮箱，标题 ``【反馈】${reporterName}${orgName ? ' · ' + orgName : ''}${n ? `（附 ${n} 张截图）` : ''}``，正文用现有 `shell()`，含提交人、公司、页面、内容，按钮「去后台处理」→ `https://app.fordexa.com/admin`。
- `POST /api/studio/feedback`（multipart：`message`, `pageUrl`, `images[]`）：`requireStudioUser` → `validateFeedback` → 一小时内本人 `bug_reports` ≥ 10 条 → 429 `提交太频繁了，过一会儿再试` → 截图存 `studio-private` 的 `bugs/<uid>/<时间戳>_<i>.<ext>` → 插 `bug_reports`（`org_id` = 在看的公司）→ **await** `mailBugReport`（失败不影响返回）→ `{ ok: true }`。
- `GET /api/admin/feedback?status=open|resolved|all`（默认 open）→ `{ reports: { id; reporterName; orgName; pageUrl; message; status; createdAt; imageUrls: string[] }[] }`（签名 URL 1 小时）；`PATCH /api/admin/feedback` `{ id, status }` → 写 `resolved_at / resolved_by`。
- FeedbackSheet：底部弹出（手机）/ 右下角卡片（电脑），描述框支持 Ctrl+V 粘贴图片，「上传截图（n/4）」按钮（`accept="image/*"`，交给 `validateFeedback` 拦），缩略图可删，显示「会一起发出：当前页面」，提交中禁用，成功 toast「收到了，谢谢！」并关闭。
- FeedbackSection：未处理 / 已处理 切换，每条显示提交人、公司、时间、页面、内容、截图缩略图（点开看大图），按钮「标为已处理」/「重新打开」。

- [ ] **Step 1: 写测试** `feedback.test.ts`：
  ```ts
  assert.equal(validateFeedback({ message: '  ', images: [] }), '先写一下遇到了什么问题');
  assert.equal(validateFeedback({ message: 'x'.repeat(5001), images: [] }), '描述太长了（最多 5000 字）');
  assert.equal(validateFeedback({ message: 'ok', images: Array(5).fill({ type: 'image/png', size: 1 }) }), '最多 4 张截图');
  assert.equal(validateFeedback({ message: 'ok', images: [{ type: 'image/heic', size: 1 }] }), '只支持 png / jpg / webp / gif 截图（iPhone 照片请先截个屏）');
  assert.equal(validateFeedback({ message: 'ok', images: [{ type: 'image/png', size: 6 * 1024 * 1024 + 1 }] }), '单张截图不能超过 6MB');
  assert.equal(validateFeedback({ message: 'ok', images: [{ type: 'image/jpeg', size: 100 }] }), null);
  assert.equal(feedbackImageExt('image/jpeg'), 'jpg');
  ```
- [ ] **Step 2:** `npm test` → FAIL。
- [ ] **Step 3:** 实现以上全部。
- [ ] **Step 4:** `npm test` PASS；`npx tsc --noEmit` 0 错误。
- [ ] **Step 5: 实测**：本地带 2 张截图提交一条 → Shawn 邮箱收到邮件、附件 2 张（本地 `.env.local` 有 Resend 配置时；没有就报告「本地没配发信，线上验证」）；后台能看到、标已处理。删掉测试反馈和截图文件。

---

### Task 8: 头像与名字

**Files:**
- Create: `src/lib/avatar.ts`, `src/lib/avatar.test.ts`, `src/app/studio/me/ProfileCard.tsx`, `src/app/api/studio/profile/route.ts`, `src/app/api/account/route.ts`
- Modify: `src/app/studio/me/page.tsx`, `src/components/useAccount.ts`, `src/components/UserMenu.tsx`, `src/components/MobileMenu.tsx`, `src/app/studio/StudioShell.tsx`（电脑顶栏右侧显示自己的 Avatar 28）, `src/app/api/admin/clients/route.ts`（每个账号加 `avatar_url`）, `src/app/admin/page.tsx`（用户列表显示头像）

**Interfaces:**
- Produces（`avatar.ts`）：
  - `avatarUrl(path: string | null): string | null` —— `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`（服务端用，`server.ts` 的 `peopleById` 改用它）。
  - `squareCrop(w: number, h: number): { sx: number; sy: number; size: number }` —— 居中取最大正方形。
  - `const AVATAR = { px: 256, maxBytes: 1024 * 1024, mime: ['image/jpeg', 'image/png', 'image/webp'] }`
- `POST /api/studio/profile`（multipart `avatar`）：类型 / 大小不合 → 400；存 `avatars/<uid>/<rand>.<ext>`（扩展名按 mime）→ 更新 `profiles.avatar_path` → 删旧文件 → `{ avatarUrl }`。`PATCH /api/studio/profile` `{ name }`：trim 后 1–40 字 → `display_name`。都只改登录人自己（`user.id`），与在看的公司无关。
- `GET /api/account` → `{ isAdmin: boolean; canStudio: boolean; name: string; avatarUrl: string | null }`（`requestUser` + `canEnterStudio`）。
- `useAccount` 改为：拿到 session 后调 `/api/account`；`Account = { email: string | null; isAdmin: boolean; canStudio: boolean; name: string | null; avatarUrl: string | null } | undefined`。
- UserMenu / MobileMenu：「工作台」入口条件改 `canStudio`，「后台」仍 `isAdmin`；邮箱前显示圆头像（20px，没有就首字）。
- ProfileCard（「我的」页最上面）：Avatar 72 + 名字（点了变输入框，失焦保存）；点头像选图（`accept="image/*"`，手机上可拍照/相册），浏览器里 `squareCrop` → canvas 缩到 256 → `toBlob('image/webp', 0.85)`（浏览器不支持 webp 时退回 jpeg）→ 上传。上传中头像上盖一层转圈。

- [ ] **Step 1: 写测试** `avatar.test.ts`：
  ```ts
  assert.deepEqual(squareCrop(400, 300), { sx: 50, sy: 0, size: 300 });
  assert.deepEqual(squareCrop(300, 500), { sx: 0, sy: 100, size: 300 });
  assert.deepEqual(squareCrop(256, 256), { sx: 0, sy: 0, size: 256 });
  assert.equal(avatarUrl(null), null);
  assert.ok(avatarUrl('u1/a.webp')!.endsWith('/storage/v1/object/public/avatars/u1/a.webp'));
  ```
- [ ] **Step 2:** `npm test` → FAIL。
- [ ] **Step 3:** 实现以上全部。
- [ ] **Step 4:** `npm test` PASS；`npx tsc --noEmit` 0 错误。
- [ ] **Step 5: 浏览器实测**（390px）：上传一张横图 → 显示为居中正方形，顶栏 / 三条杠菜单 / 后台用户列表 / 口播库「谁放的」都变成新头像；改名字后「谁放的」跟着变。实测完把 Shawn 的头像、名字恢复成测试前的样子（测试前先记下原值），除非 Shawn 说保留。

---

### Task 9: 收尾验证与报告

- [ ] **Step 1:** `npm test`、`npx tsc --noEmit`、`npx next build` 全部通过（build 前删 `.next` 以免和 dev 冲突，build 后再删一次）。
- [ ] **Step 2:** 用 superpowers:requesting-code-review 对整批改动做一次审查（最强模型，说明原因：权限核对出错 = 客户数据泄露）；修掉 Critical / Important。
- [ ] **Step 3:** 确认测试数据已清理：`scripts`、`script_changes`、`fordexa_claims`、`bug_reports`、`studio-private` 的 `bugs/` 和测试试听文件、`avatars`。
- [ ] **Step 4:** 向 Shawn 报告：做了什么、实测结果、回填出来的占用列表（哪些是王小墨测试时占的、建议释放哪些）、留下的测试数据（如有）、已知缺口（App 灵感库仍显示 Fordexa 原稿全文；App 里看不到同事的稿子）。最后一句「已改好未提交，等你确认」，停下。
