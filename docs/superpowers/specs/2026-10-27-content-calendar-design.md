# 工作台第三期：发布日历（第 3 版：口播库就是日历）

日期：2026-10-27 初稿；10-28 改（去掉网站审片和上传视频）；**10-28 第 3 版：不再单独建日历表，口播库加列，日历是它的月历视图**
状态：草稿，待 Shawn 确认
前几期：`2026-10-17-script-studio-design.md`（工作台）、`2026-10-19-studio-companies-design.md`（按公司共享、修改留痕）、`2026-10-23-showcase-demo-design.md`（主页预览）

## 为什么改成第 3 版

第 2 版做出来以后（单独一张 `posts` 表，和口播稿关联），Shawn 提出：

> 其实是不是在口播稿数据库里加一个日期的列，就可以了？参考 notion 的做法？

> 能不能再加一列已排期，已排期的才出现在日历上？其他的还是草稿状态？我们现在的流程是我写很多文章，然后客户拉到自己的库里，然后排期，精修，定稿后出现在日历上，到时候录一下就可以了。

> 日历更多是一个看板，记录会做哪些工作，而这些工作的来源部分是灵感，部分是口播稿。

> 3 4 5（排期、精修、定稿）前期我做，等熟悉后就客户做，所以我们都需要 access。

> 修改了哪些内容，什么时候修改了都要做好记录并显示，这个是客户动不了的，只有我能碰。

所以：**口播库（`scripts` 表）就是那张表，日历只是它的月历视图**，像 Notion 一个数据库加日期列和日历视图。第 2 版已经做好、测好的月历、面板、按系列铺开、库存条、备注、选月份、提速，界面大部分保留，数据改从 `scripts` 来。第 2 版的改动都还没提交。

## 流程（一条内容的一生）

| 步 | 进度（`stage`） | 在哪 | 谁 |
|---|---|---|---|
| Shawn 写文章，下面挂几条口播 | — | Fordexa 公共库（灵感库） | Shawn |
| 拉到自己的库 | 草稿，没有日期 | 灵感库「拉到我这里」（现有） | 客户或 Shawn |
| 排期 | 草稿，有发布日期 → 上日历 | 日历：从侧栏把草稿拖到某天；或口播库里填日期 | 都可以 |
| 精修 | 精修中 | 稿子页：按风格生成、改稿（现有） | 都可以 |
| 定稿 | 定稿 | 点「定稿」 | 都可以 |
| 录 | 已录 | 客户 App 里录完点「✓ 已录」（现有，写 `status = 'recorded'`） | 客户 |
| 剪辑 | 成片 | Shawn 剪好，贴成片链接 | 都可以 |
| 发小红书 | 已发布 | 贴发布链接，之后补赞、藏、评 | 都可以 |

## 目标

1. **一张表**：`scripts` 加列（见第 1 节）。`publish_on` 空 = 草稿，只在口播库；填了 = 上日历。
2. **日历**：一家公司一本月历，就是这家公司 `publish_on` 不为空的口播稿。第 2 版的月历、手机列表、固定发布日黄框、颜色、库存条、「差 N 天」、选月份、翻月秒开，全部保留。
3. **侧栏「待排」**：日历旁边列出这家公司**没排日期的草稿**（来自口播库，包括刚从灵感库拉来的），每条一小块，拖到某天就是给它填发布日期。手机上拖不了：点一下、选日期。
4. **口播库也能看到排期**：口播库列表每条显示发布日期和进度，像 Notion 表格里的两列；没排的显示「未排期」。
5. **录制截止日自动算**：每家公司设「提前几天录完」，默认 5 天。填或改发布日期时，`record_by`（要录完日期）自动 = 发布日期 − 这个天数。客户 App 的「本周要录」照常按 `record_by` 排，不用改 App。`record_by` 仍可手动改。
6. **双方权限一样**：管理员（Fordexa）和这家公司的成员能做的事一样：排期、精修、定稿、改进度、贴链接、填数据、按系列铺开、加一条、删除、设固定发布日和提前天数。
7. **修改记录**：每一次改动都记下谁、什么时候、改了哪一列、改前改后。在每条的面板里能看，日历页也能按时间看这家公司的全部改动。**客户能看，不能改、不能删；只有管理员能删记录。**
8. 第 2 版的备注照旧：双方都能写，红点提示对方有新备注。

## 不做

- 不改 App。App 照旧读 `scripts`，「本周要录」按 `record_by`。（App 以后要嵌日历时再改，见「以后」。）
- 不自动发小红书，不用小红书后台定时发布。
- 网站不存视频，只存成片链接（OneDrive / Google Drive）。
- 网站上不审片（审片在微信上）。
- 不发邮件、不推送。
- 赞藏评论手动填。
- 不迁移 Notion 里桂冠的发布日历。

## 反目标

- 一家公司看到或改到另一家的口播稿、备注、修改记录。
- 客户改了或删了修改记录。
- 某次修改没留下记录（包括网页、App、接口三条路）。
- 客户 App 的口播库或「本周要录」因为这次改动乱掉（多出来、少了、顺序错了）。
- 已发布的那一条被误删、被挪了日期、链接丢了。
- 发布日期一改，`record_by` 没跟着变，客户按旧日期录。

## 现状（建造者需要知道的）

- 第 2 版的代码都在分支 `feat/content-calendar`，**全部暂存、未提交**：
  - 表 `posts`、`post_notes`（迁移 `supabase/migrations/20261028_post_calendar.sql`，**已在正式库上跑过**）；`organizations.post_weekdays`（王小墨 = `{2,5}`）。
  - 纯逻辑 `src/lib/studio/{posts,posts-publish,posts-map,calendar,calendar-cache,notes}.ts`（有测试）。
  - 数据层 `src/lib/studio/posts-db.ts`；接口 `src/app/api/studio/posts/**`、`src/app/api/studio/org`。
  - 页面 `src/app/studio/calendar/*`。
  - `posts` 里现在只有 3 条测试数据（王小墨：第一集测试、第二集测试、热点测试），可以丢。
- `scripts` 表现有列：`id, user_id, org_id, created_by, edited_by, title, body, source('fordexa'|'self'), status('ready'|'recorded'|'archived'), sort_order, code, record_by, audio_*, checks, finalized_at/_body/_by, created_at, updated_at`。
  - App 读：`status <> 'archived'`，靠 RLS 只给本人的行；存：upsert 只写 `id/title/body/source/status/sort_order/code/user_id`。**新列一律可空或有默认值，App 的 upsert 不能被它们卡住。**
  - 触发器：`scripts_before_insert`（补公司、Fordexa 稿占用）、`scripts_before_update`（锁主人/公司）、`scripts_log_change`（写 `script_changes`，现在只记 `title, body, record_by, status`，`field` 有 check 约束）。
  - 管理员往别家公司放稿子挂在 `orgOwner(orgId)` 名下（App 只显示本人名下的行）。
- 修改记录表 `script_changes(id, script_id, org_id, actor_id, at, action, field, old_value, new_value)`，网页上 `src/app/studio/s/[id]/ChangeLog.tsx` 展示，`src/lib/studio/changes.ts` 负责描述文字。网页接口走 service key，靠 `edited_by` 告诉触发器是谁改的。
- 口播库页面：`src/app/studio/page.tsx` + `WeekView.tsx`（「本周要录」周列表）+ 稿子页 `src/app/studio/s/[id]/*`。接口 `src/app/api/studio/scripts`。
- 灵感库「拉到我这里」：`src/app/api/studio/pull`，拉来的稿子 `record_by` 为空。

## 设计

### 1. `scripts` 加列

| 列 | 说明 |
|---|---|
| `publish_on date` | 发布日期。空 = 草稿（不上日历） |
| `stage text not null default 'draft'` | `draft` 草稿 / `refining` 精修中 / `final` 定稿 / `recorded` 已录 / `cut` 成片 / `published` 已发布 |
| `kind text not null default 'video'` | `video` / `image`（图文） |
| `is_extra bool default false` | 热点 |
| `series text`, `episode int` | 系列名、第几集 |
| `media_url`, `cover_path` | 成片链接、封面 |
| `xhs_title`, `xhs_body`, `xhs_tags text[]` | 小红书文案 |
| `published_url`, `published_at` | 发布链接、时间 |
| `likes`, `saves`, `comments`, `stats_at` | 数据 |
| `last_note_at`, `last_note_by_admin`, `admin_seen_at`, `client_seen_at` | 备注红点（第 2 版的规则不变） |

`organizations` 再加 `record_lead_days int not null default 5`（`post_weekdays` 第 2 版已加）。

备注表：新建 `script_notes`（结构同第 2 版 `post_notes`，`script_id` 外键到 `scripts`，`on delete cascade`）。

**迁移**：
- `posts` / `post_notes` 里只有测试数据，**不迁数据，直接删表**（`drop table if exists`）。
- 老的口播稿：`stage` 回填——`status = 'recorded'` 的回填 `recorded`，其余 `draft`；`publish_on` 留空（都是草稿，不会突然出现在日历上）。

### 2. 进度规则

- 顺序：草稿 → 精修中 → 定稿 → 已录 → 成片 → 已发布。双方都能点进度条上的任意一步（已发布除外：只能走「已发布 · 贴链接」）。
- **和 App 的 `status` 对齐**：
  - App 把 `status` 改成 `recorded`（客户点「✓ 已录」），而 `stage` 还在「已录」之前 → 数据库触发器把 `stage` 设成 `recorded`。
  - 网页把 `stage` 设到「已录」或之后 → 同时把 `status` 设成 `recorded`；退回到「已录」之前 → `status` 设回 `ready`。
  - `status = 'archived'` 的不上日历，也不进侧栏。
- 贴了成片链接、进度在「成片」之前 → 自动到「成片」（第 2 版规则保留）。
- 设成「定稿」及以后要求正文不为空；设成「成片」及以后要求有成片链接；「已发布」要求小红书链接（第 2 版的 `isXhsUrl`）。缺什么提示什么。
- 图文：没有「已录」这一步（进度条不显示），也不要求正文；成片链接 = 放图的文件夹链接。
- 王小墨这类不用自己录的（数据行业，TTS 配音）：「已录」这一步在界面上叫「已配音」（按公司的 `industry = 'data'` 判断）。
- 已发布的不能删、不能改日期；可以撤回到「成片」（记一条修改记录）。第 2 版「清空必填字段时自动退回」的规则，按新的必填项照搬。

### 3. 发布日期与录制截止日

- 发布日期被填上或改动时，`record_by = publish_on − 这家公司的 record_lead_days`（墨尔本日期）。发布日期被清空（移回草稿）时，`record_by` 也清空。
- 之后手动改 `record_by` 可以，不会被覆盖，直到下一次改发布日期。
- 日历格子上：定稿后、`record_by` 已过、还没「已录」的，显示红字「该录了」；第 2 版的「差 N 天 / 过期未发」照旧按发布日期算。
- 公司设置（日历页顶部，和固定发布日放一起）：「提前 [5] 天录完」。

### 4. 日历页

第 2 版的全部保留，数据改从 `scripts` 来。新增：

- **侧栏「待排」**（电脑：月历右边一栏；手机：月历上方一个「待排 N 条」按钮，点开是底部列表）：这家公司 `publish_on` 为空、`status <> 'archived'` 的稿子，按最近修改排；可以按标题搜。
  - 电脑上把一条拖到某天 → 设 `publish_on`（并按第 3 节算 `record_by`）。
  - 每条也有「排到…」按钮（日期选择），手机上用这个。
  - 日历上的一条也能拖回侧栏 = 清空发布日期，回到草稿（已发布的不行）。
  - 电脑上日历里的条目可以拖到另一天 = 改日期。
- 「排一个系列」：每集标题生成新的口播稿（草稿、只有标题、正文空），按固定日排上。生成的行挂在 `orgOwner(orgId)` 名下（和现在管理员往别家放稿子一样），所以会出现在客户 App 的口播库里，正文是空的，等精修。
- 「加一条」：同样生成一条新的口播稿。

### 5. 口播库页面

- 每条显示发布日期（或「未排期」）和进度标签。
- 稿子页（`/studio/s/[id]`）加「发布日期」一项（日期选择）和进度条；其余不变。
- 「本周要录」照旧按 `record_by`。

### 6. 面板

第 2 版的面板保留（进度条、成片链接、小红书文案、封面、复制标题+正文、贴发布链接、赞藏评、备注、复制链接、改短标题/类型/热点）。变化：

- 「口播稿」那一节不再是「关联一条稿子」：面板就是这条稿子，直接显示正文和试听，链接到稿子页去精修。
- 新增「修改记录」一节（折叠），列出这条的全部改动（见第 7 节）。
- 所有按钮对双方都可用。

### 7. 修改记录

- 继续用 `script_changes` + 触发器 `scripts_log_change`，扩展到新列：`publish_on, stage, kind, is_extra, series, episode, media_url, cover_path, xhs_title, xhs_body, xhs_tags, published_url, likes, saves, comments`（`field` 的 check 约束一并放开到这些）。`record_by` 被自动改时也记（actor 同改发布日期的人）。备注的新增、删除也记一条（`field = 'note'`）。
- 不记：红点用的 `last_note_at / admin_seen_at / client_seen_at`、`updated_at`、`stats_at`。
- 显示：面板里这条的记录；日历页一个「修改记录」入口，按时间列出这家公司最近的改动（每条能点到对应的稿子）。描述文字沿用 `describeChange` 的风格，例如「Shawn 把发布日期从 11/3 改成 11/6」。
- 权限：双方都能看；**只有管理员能删某一条记录**；任何人都不能改记录。`script_changes` 只走服务端，RLS 不开策略（现状），删除接口检查 `isAdmin`。

### 8. 权限

| | 管理员 | 公司成员 |
|---|---|---|
| 看日历、口播库、面板、修改记录 | 任意公司（切换） | 只有自己公司 |
| 排期、改进度、改内容、贴链接、填数据、系列、加一条、删除、公司设置 | ✓ | ✓ |
| 写备注、删自己的备注 | ✓ | ✓ |
| 删修改记录 | ✓ | ✗ |

所有接口仍按 `requireStudioUser` 的 `orgId` 核对，一家公司碰不到另一家。

### 9. 第 2 版代码怎么处理

- 保留：月历/手机列表/选月份/库存条/提醒/面板组件、`calendar.ts`、`calendar-cache.ts`、`monthStore`、`posts.ts` 里的校验工具（`isXhsUrl`、`cleanMediaUrl`、`parseCount`、`cleanTags`、`copyText` 等）、`notes.ts`。
- 改写：数据层与接口改成读写 `scripts`（可沿用 `/api/studio/posts` 这组路径名，或改成 `/api/studio/calendar`，建造者定）；进度和校验规则按第 2 节改；`CalendarPost` 类型改成从口播稿映射。
- 删除：`posts` / `post_notes` 表和只为它们存在的代码（如「关联一条稿子」下拉框）。

### 10. 细则（审稿后补，均为我替 Shawn 定的）

**「定稿」和现有的 `finalized_*` 列是两回事**
- `finalized_at / finalized_body / finalized_by` 是 App 里客户录完点「发给 Fordexa」那一刻的快照，用来让写稿提示词进化。网页上的「定稿」按钮**不写**这三列，只改 `stage`。
- App 写了 `finalized_at`（客户发来视频）且 `stage` 在「已录」之前 → 触发器把 `stage` 设成 `recorded`。

**哪些行算 `record_by`**
- 图文（`kind = 'image'`）没有录制：不算 `record_by`，改成图文时把它清空；不显示「该录了」。
- 视频（含热点）照第 3 节算。王小墨（TTS）也照算，只影响 Shawn 自己的 App。

**规则放在哪里：数据库触发器**（网页、App、直接改库三条路都管得住）
- `scripts` 的 BEFORE UPDATE / INSERT 触发器负责：
  - `publish_on` 变了（且不是图文）→ 重算 `record_by = publish_on − 公司的 record_lead_days`；`publish_on` 清空 → `record_by` 清空。只有 `publish_on` 变时才重算，所以手动改的 `record_by` 会保留到下次改发布日期。
  - `status` 和 `stage` 对齐（第 2 节），以及下面这条防旧数据的规则。
- **App 拿旧数据写回来**：App 会把本地的 `status` 整行写回。
  - `status` 从 `recorded` 变回 `ready`、而 `stage` 是「已录」→ `stage` 退回「定稿」（客户在 App 里取消了「已录」，这是正常操作）。
  - `stage` 已经是「成片」或「已发布」→ 不接受把 `status` 改回 `ready`，保持 `recorded`。
  - App 只写 `id/title/body/source/status/sort_order/code/user_id`，碰不到日期、链接、进度这些新列，所以网页上「成片要有链接、已发布要有小红书链接、已发布不能改日期」这些校验放在网页接口里就够了。
- 修改记录仍由 `scripts_log_change` 写。自动重算出来的 `record_by` 也会被它记下，操作人和改发布日期的是同一个人（`auth.uid()`，否则 `edited_by`）。

**日历和待排显示哪些行**
- 这家公司（`org_id`）的全部口播稿，不分是哪个成员名下。这和第二期「一家公司一份口播库」一致。客户 App 仍然只显示本人名下的行，现在绝大多数公司只有一个账号，影响不大。
- `org_id` 为空的老稿子不出现。Fordexa 稿占用规则不变：拉过来的稿子属于拉的那家公司。

**改公司设置时**
- 改「提前几天录完」→ 重算这家公司**今天以后发布、还没到「已录」**的视频的 `record_by`，每条都记修改记录。已录、已发布、过去的不动。
- 改固定发布日 → 已排好的不动，只影响以后「排一个系列」。

**老数据回填**
- `status = 'recorded'` 或 `finalized_at` 不为空 → `stage = 'recorded'`；其余 → `draft`。`publish_on` 一律留空。

**客户直接用 App 的令牌改库**
- RLS 管不到列，客户理论上能直接改自己名下行的新列。按新的权限，这些事客户在网页上本来就能做，而且触发器照样记修改记录，所以不另外拦。

## 以后（这一期不做）

- App 嵌日历；App 只显示视频类、正文不为空的稿子（到时 `scripts` 已有 `kind`、`stage`，直接用）。
- 用 `xhs-research` 自动补赞藏评。
- 已发布的自动进「主页预览」。

## 我替你定的（Shawn 请过目）

1. 老口播稿一律是草稿、没有发布日期，不会自己跑到日历上；已经在 App 里录过的（`status = recorded`）进度回填为「已录」。
2. 进度 6 步：草稿、精修中、定稿、已录（王小墨叫「已配音」）、成片、已发布。
3. App 点「✓ 已录」会自动把进度推到「已录」；网页上退回进度会把 App 的状态也改回「待录」。
4. 改发布日期会重算录制截止日；手动改的录制截止日在下次改发布日期前保留。
5. 「排一个系列」「加一条」生成的是正文为空的口播稿，客户 App 的口播库里会看到这些空稿子（等精修后再录）。
6. 拖回侧栏 = 退回草稿，已发布的不能拖回。
7. 修改记录双方都能看，只有管理员能删；连备注的增删也记。
8. 第 2 版的 `posts`、`post_notes` 表连同 3 条测试数据一起删掉。
9. 网页上的「定稿」和 App 的「发给 Fordexa」是两回事。客户在 App 发来视频，进度自动到「已录」。
10. 图文没有录制截止日。
11. 日期、进度这些联动写在数据库触发器里，App 拿旧数据写回来也不会把进度搞乱。
12. 改「提前几天录完」时，会重算以后要发、还没录的视频。改固定发布日，已经排好的不动。

## 留给建造者

- 拖放用原生 HTML5 拖放还是库；接口路径命名；侧栏搜索的细节。
- 触发器怎么写（一个函数里逐列比较，或循环）。
- 测试：进度规则（含 `status` 对齐）、录制截止日计算、修改记录覆盖新列、客户删记录被拒、跨公司访问被拒、迁移可重复跑。
