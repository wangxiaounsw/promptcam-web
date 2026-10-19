# 口播工作台第二期：按公司共享 + 管理员切换公司 + Fordexa 稿占用 + 反馈 + 头像

日期：2026-10-19
状态：草稿，待审阅、待 Shawn 确认
前一期：`docs/superpowers/specs/2026-10-17-script-studio-design.md`（工作台第一期，已上线，只对管理员开放）

## 为什么做

Shawn 的客户（律师、会计、移民中介这类企业）花钱就是为了把琐事交出去：选什么话题、口播稿写成什么样、哪天录，都由 Shawn 来定。所以 Shawn 要能：

1. **随时看到每家企业的日程**，知道它这周要录什么、录完没有；
2. **替企业排一份内容日历**：哪一天讲哪个话题、口播稿是什么。企业照着录，想改也可以自己改；
3. **看得出每一处是谁动的**：哪条是 Shawn 排的、哪条是企业自己加的，谁改了日期、谁改了正文。

同时要防止企业之间「打架」：Fordexa 写好的同一份口播稿不能被两家企业用。

另外两个小功能：工作台里遇到问题能直接带截图反馈给 Shawn；每个人能上传头像。

**先把网页版做好，App 以后再改成和网页一致。** 这一期不改 App。

## 目标

1. **工作台向企业开放**：已开通企业（`organizations.is_active = true`）的成员用邮箱登录网页（App 里绑定的邮箱 + 密码），进工作台。
2. **按公司共享**：一家公司一份口播库、一份日历。同公司的所有成员能看、能改这家公司的全部稿子；每条稿子标出是谁放进来的。只能看自己公司的，别家的一律看不到。
3. **管理员切换公司**：管理员（`profiles.is_admin`）在工作台顶部有一个公司切换按钮，可切到任意公司，在那家公司里做一切操作：拉选题、排日期、生成、改稿、试听。默认是自己所在的公司（王小墨）。
4. **修改记录**：稿子的新增、删除，以及标题、正文、要录完日期、状态的每次修改，都记一条：谁、什么时候、改了什么、改前改后。App 里的修改也要记到（见「修改记录」一节）。
5. **Fordexa 稿占用**：Fordexa 写的一份口播稿（`idea_bank.script`）全站只给一家公司用，不分行业。选题和文章对所有公司开放。
6. **Bug 反馈**：工作台里能提交问题描述 + 最多 4 张截图，马上发邮件给 Shawn（截图作附件），后台能看、能标已处理。
7. **头像**：每个人能上传头像，在工作台、后台、日历和修改记录里显示。

## 不做

- **不改 App**。App 的口播库、灵感库这一期都保持现状。
- **数据库权限（RLS）这一期不放开**。App 现在读 `scripts` 不带条件、全靠 RLS 只给本人的行；网页工作台的接口都走 service key、在服务端核对权限。所以「按公司共享」只在网页接口里做，App 现在的行为一点不变。等 App 改版时再统一放开 RLS。
- **排稿后不发邮件**。Shawn 自己用微信告诉客户。
- 不做每人一份的日历——一家公司一份。
- 不做 App 灵感库里的「已占用」显示（App 改版时再做）。

## 反目标（做出来也算失败）

- **一家公司看到了另一家公司的稿子**，或能改别家的稿子。这是这一期最不能出的错——每个接口都要按公司核对。
- **管理员以为在改自己的，其实在改客户的**（或反过来）。切到别家公司时界面必须一直、明显地显示「你正在看：某某公司」。
- **App 里保存一次，稿子就换了主人或换了公司**（原因见「App 保存会改主人」）。
- **同一份 Fordexa 稿被两家公司用了**，或者被占用后，AI 照着那份原稿改写，写出来还是那份稿子。
- 修改记录漏掉 App 里的改动，或者网页上的改动记成了「未知」。

## 现状（建造者需要知道的）

- 表 `scripts`：`id, user_id, title, body, source('fordexa'|'self'), status('ready'|'recorded'|'archived'), sort_order, created_at, updated_at, code, record_by, audio_path, audio_hash, audio_at, checks`。`code` 关联 `idea_bank.code`（这条稿子来自哪个选题）。
- 表 `profiles`：`id, display_name, industry, is_fordexa_client, live_seconds_remaining, created_at, is_admin, org_id, voice_id`。
- 表 `organizations`：`id, name, industry, is_active, note, created_at, style_prompt, style_samples, email_domains, voice_id`。
- 表 `script_versions`（每条稿子的版本：n=0 是 Fordexa 原版，1、2、3… 是生成的）、`prompts`（提示词库，按公司 → 行业 → 通用取）。
- 现有数据（2026-10-19）：6 家公司、6 个账号（4 个有公司）、17 条稿子（9 条 fordexa）。绝大多数公司只有一个账号（开通邮件里写的是「同事用同一家公司的邮箱注册」）。
- 服务端公共件 `src/lib/studio/server.ts`：`requireStudioUser`（现在只放管理员）、`ownScript`（按 `user_id` 核对）、`ideaByCode`、`ensureFordexaVersion`、`sourceForScript`。
- `src/lib/studio/fact-rules.ts` 的 `buildSourceText` 给 AI 的材料里有【Fordexa 原稿】一段。
- 声音按 个人 → 公司 → 默认 取（`src/lib/voice.ts` 的 `resolveVoice`）。试听音频存私有桶 `studio-private`，路径 `audio/<uid>/…`，`ownsPreviewPath(path, uid)` 按 uid 核对。
- 发信 `src/lib/mail.ts`：Resend，`MAIL_FROM` / `MAIL_ADMIN` / `RESEND_API_KEY`，没配就静默跳过。现在的 `send()` 不支持附件。
- App（Flutter 仓库 `prompter`，`lib/services/script_store.dart`）：
  - 读：`from('scripts').select().neq('status','archived')`，不带 user 条件，靠 RLS。
  - 存：`upsert`，**行里强制写 `user_id = 当前用户`**，只发 `id/title/body/source/status/sort_order/code/user_id`。
  - 灵感库「加到口播库」直接往 `scripts` 插 `source='fordexa'` + `code`。
  - 灵感库直接读 `idea_bank.script`（所以 App 用户这一期仍能在 App 里看到 Fordexa 原稿全文——已知缺口，App 改版时补）。
- 数据库迁移 SQL 由 Shawn 在 Supabase SQL Editor 里手动跑（前一期的做法），跑完告诉 Claude。

## 设计

### 1. 稿子归属到公司

`scripts` 加两列：

- `org_id uuid`（references `organizations`）：这条稿子属于哪家公司。
- `created_by uuid`（references `profiles`）：谁放进来的（日历上显示「谁放的」）。

规则：

- **回填**：已有稿子 `org_id` = 稿子主人（`user_id`）当前的 `org_id`；`created_by` = `user_id`。没有公司的人的稿子 `org_id` 留空（这类人进不了工作台，见第 3 节，不影响）。
- **新增时**（数据库 BEFORE INSERT 触发器）：`org_id` 没给就取 `user_id` 的公司；`created_by` 没给就取 `auth.uid()`，再没有就取 `user_id`。这样 App 插进来的行也自动带上公司和「谁放的」。
- **App 保存会改主人**：App 每次保存都写 `user_id = 当前用户`。这一期 RLS 不放开，App 只能改自己的行，所以现在不会出事；但为了以后放开时不出事，**现在就加 BEFORE UPDATE 触发器：`user_id`、`org_id`、`created_by` 改了也不生效，保持原值**。（管理员如果需要把稿子挪到别家公司，这一期不做。）

### 2. 「这家公司的稿子」归谁的 App

这一期 App 只显示 `user_id = 本人` 的行。所以管理员在某家公司里新建一条稿子（拉选题、新建），`user_id` 要写成**这家公司的一个成员**，这样那个成员在 App 里才看得到：

- 取这家公司**最早注册的成员**作为「主账号」。（Claude 的判断：绝大多数公司只有一个账号。）
- 公司没有任何成员时，不能在这家公司里新建稿子，界面提示「这家公司还没有人登录过」。
- 公司成员自己在网页上新建的稿子，`user_id` = 他自己。
- 网页上同公司的人都能看到全部稿子（不管 `user_id` 是谁），只是 App 里暂时各看各的——App 改版时放开 RLS 就一致了。

### 3. 谁能进工作台、看到什么

`requireStudioUser` 改成返回「当前用户 + 当前在看的公司」：

- **管理员**：能进。在看的公司由请求带上（比如请求头 `x-studio-org: <orgId>`），服务端核对：是管理员才认，任意公司都可以；不带就用他自己的 `org_id`。
- **企业成员**：`profiles.org_id` 指向一家 `is_active = true` 的公司才能进。在看的公司**永远是他自己的公司**，请求里带了别的也忽略。
- 其他人（没公司、公司未开通）：进不了，显示现在的「暂未开放」页。

所有 `/api/studio/*` 里原来 `ownScript(user.id, id)` 的地方，改成「这条稿子的 `org_id` = 当前在看的公司」。版本、试听、复核、生成、「用这版」全部按这个核对。

**跟着「在看的公司」走的东西**（管理员切到 Vtax 时，做出来的就是 Vtax 风格、Vtax 声音）：

- 生成用的提示词：在看的公司的（`scriptPrompt(在看的公司)`）。
- 「我的」页里的提示词卡：改的是在看的公司的提示词（企业成员可以改自己公司的提示词，前一期就定了「公司的那份他们可以自己调整」）。
- 试听声音：
  - 企业成员：个人声音 → 公司声音 → 默认（同现在）。
  - 管理员在别家公司：那家公司的声音 → 默认（**不用** Shawn 的个人声音）。
  - 管理员在自己公司：同现在。
- 试听音频的存放路径和归属核对要改成按公司（或按稿子）而不是按 uid——同公司的人要能听同一份试听。具体路径格式留给建造者，但 `ownsPreviewPath` 这类「这个文件是不是本公司的」检查必须保留（前一期审查修过「信任了 audio_path」的问题）。

**「我的」页里不跟着公司走的**：头像、名字、个人声音、声音训练——这些永远是登录的那个人自己的。

### 4. 切换按钮（管理员）

- 电脑：工作台顶栏左侧「口播工作台」旁边，一个下拉：当前公司名 ▾，列出所有公司（标出未开通的）。
- 手机：工作台每页顶部一条窄栏，显示当前公司名，点开选。企业成员看不到这个。
- **切到不是自己公司时**，这条栏换成醒目的颜色，写「你正在看：Vtax 的口播库」，所有页面都在。
- 选择记在浏览器里（localStorage，读写包 try/catch），下次打开还是这家；读不到就回到自己的公司。
- 切换后，口播库、灵感库（占用状态按这家公司算）、我的（提示词）都按新公司刷新；正在看的稿子页如果不属于新公司，回到口播库。

### 5. 日历上的「谁放的」

周视图和稿子页上，每条稿子显示放进来的人的头像（小圆）+ 名字。名字用 `profiles.display_name`，没有就用邮箱 @ 前面那段。

### 6. 修改记录

新表 `script_changes`：`id, script_id, org_id, actor_id, at, action('create'|'update'|'delete'), field('title'|'body'|'record_by'|'status'|null), old_value text, new_value text`。一次 UPDATE 改了几个字段就记几行。只记 `title / body / record_by / status` 和新增、删除；试听音频、`checks`、排序不记。

**用数据库触发器记**（AFTER INSERT / UPDATE / DELETE on `scripts`），这样 App 里的改动也记得到。「谁」的取法：

- App 的写入带用户令牌：`auth.uid()` 就是改的人。
- 网页接口用 service key，`auth.uid()` 为空。所以 `scripts` 再加一列 `edited_by uuid`：网页接口每次写 `scripts`（新增、更新）都**必须同时写 `edited_by = 当前登录的人`**（管理员替别家改时写的是管理员）；触发器取 `coalesce(auth.uid(), NEW.edited_by)`。删除时取不到 NEW：网页删除前先把 `edited_by` 更新成当前人，或者由接口自己写一条 delete 记录——留给建造者，但删除必须记得到是谁。
- 两样都取不到就记 `actor_id = null`，界面显示「系统」。

**在哪看**：稿子页里一个「修改记录」折叠区，按时间倒序列出：头像 + 名字 + 时间 + 「把要录完日期从 10/21 改到 10/23」/「改了正文」/「改了标题：旧 → 新」。正文只说「改了正文」，点开能看改前改后的差异（复用 `src/lib/studio/prompt-diff.ts` 的 `diffLines`）。

同公司的人都能看这条稿子的记录；管理员能看所有。

### 7. Fordexa 稿占用

新表 `fordexa_claims`：`code text primary key, org_id uuid, script_id uuid, claimed_by uuid, claimed_at timestamptz`。一个选题编号只能有一行 = 这份 Fordexa 稿归这家公司。

**什么时候占用**：一家公司第一次把带 `code` 的 Fordexa 稿放进自己的库——网页「拉到我这里」、App「加到口播库」（`source='fordexa'` + `code` 的插入）都算。用 `scripts` 的 AFTER INSERT 触发器写（`on conflict do nothing`），所以 App 那条路也自动占用。

**占用后对别家公司**：

- 网页灵感库：这条照常显示，文章、出处能看，标「Fordexa 稿已被使用」；不显示 Fordexa 稿内容；「拉到我这里」仍然可以点，但拉进来的是**正文为空**的稿子（`source='self'`，保留 `code` 以便生成时找文章），不写 n=0 版本。
- 在自己公司的灵感库里，自家占用的标「已在你们的口播库」。
- **生成时**：如果这条稿子的公司不是占用者，给 AI 的材料**去掉【Fordexa 原稿】**，只给标题、文章、出处。`ensureFordexaVersion` 对非占用者不补 n=0。数字核对、AI 复核、【需要联系 Fordexa 补充调研】的规则照常。
- **App 那条路**：数据库 BEFORE INSERT 触发器——如果是 `source='fordexa'` + `code`，且这个 `code` 已被**别的**公司占用，就把 `body` 清空、`source` 改成 `'self'`。（Claude 的判断：这样占用规则在 App 里也守得住，App 用户会看到一条只有标题的空稿子，可以自己写。缺点是 App 灵感库里仍能读到 Fordexa 原稿全文，App 改版时补。）
- 管理员在后台「下发稿子」时（现有 `/api/admin/scripts` POST，不带 `code`）不受影响——那是 Shawn 单独写给某家的稿子，不是灵感库里的 Fordexa 稿。

**永久占用**：那家公司删了这条稿子、或一直没录，占用都不自动解除。后台加「Fordexa 稿占用」列表：选题、哪家公司、哪天、谁占的，每行一个「释放」按钮（Shawn 手动决定）。释放 = 删掉那一行，记一条日志（释放这件事记在服务端日志或一张小表里都行，留给建造者）。

**回填**：已有的 `source='fordexa'` 且带 `code` 的稿子，每个 `code` 取最早那条的公司作为占用者。**注意**：Shawn 第一期测试时用王小墨拉过几条（比如 FX-0002a，拉了两次），回填后这些会被王小墨占着——Shawn 可以在后台列表里释放。

### 8. Bug 反馈

照搬 laurelint 的做法（参考 `C:\Users\habit\Local Sites\laurelint\src\components\bug-report\BugReportButton.tsx`、`src\lib\bug-reports\actions.ts`、`supabase\migrations\20260625_bug_reports.sql`），改成这个项目的写法（API 路由 + `studioFetch`，不是 server action）：

- **入口**：电脑上工作台每页右下角一个「反馈问题」按钮；手机上底部有标签栏和提示词面板，浮动按钮会挡，所以入口放在「我的」页里（一行「反馈问题」），点开是底部弹出的面板。（Claude 的判断。）
- **填写**：问题描述（必填，≤5000 字）+ 最多 4 张截图（png/jpg/webp/gif，单张 ≤6MB）。电脑上可以 Ctrl+V 粘贴截图，手机上从相册选。自动记下当前页面、提交人、在看的公司。
- **存**：新表 `bug_reports`（`id, reporter_id, org_id, page_url, message, image_paths text[], status('open'|'resolved'), resolved_at, resolved_by, created_at`），RLS 打开不加 policy（只走 service key）。截图存私有桶（复用 `studio-private` 下 `bugs/` 前缀，或新建私有桶——留给建造者）。
- **发信**：提交后马上用 Resend 发给 `MAIL_ADMIN`，标题「【反馈】提交人 · 公司（附 N 张截图）」，截图作附件，`reply_to` 设成提交人邮箱（Shawn 直接回信就能问）。`mail.ts` 的 `send()` 要加附件支持。必须 `await` 发信再返回（Vercel 函数返回后会被冻结，laurelint 踩过）；发信失败不影响提交成功。
- **限流**：每人每小时最多 10 条。
- **后台**：`/admin` 加一个「反馈」区：按时间倒序，显示提交人、公司、页面、内容、截图（签名 URL），可标「已处理」/「重新打开」。默认只看未处理的。

### 9. 头像

- `profiles` 加 `avatar_path text`。头像不敏感，存**公开**桶 `avatars`，路径 `<uid>/<随机>.webp`（或 jpg），换头像时删旧的。
- 「我的」页顶部：头像 + 名字。点头像上传（手机上能拍照或从相册选）。上传前在浏览器里裁成居中正方形、缩到 256×256、压缩；服务端再核对类型和大小（≤1MB）。
- 名字：同一处能改 `display_name`（不然「谁放的」「谁改的」只能显示邮箱）。（Claude 的判断。）
- 显示位置：工作台顶栏（电脑）、「我的」页、后台用户列表、日历和稿子页的「谁放的」、修改记录。网站页头的三条杠菜单和电脑端用户菜单也显示（`src/components/MobileMenu.tsx`、`UserMenu.tsx`）。
- 没传过：圆形底色 + 名字第一个字。

### 10. 入口

网站页头三条杠菜单和电脑用户菜单里的「工作台」入口，现在只对管理员显示；改成对能进工作台的人都显示（管理员 + 已开通公司的成员）。「后台」入口仍只给管理员。

## 数据库迁移（一份 SQL，Shawn 手动跑）

1. `scripts` 加 `org_id`、`created_by`、`edited_by`；回填 `org_id`、`created_by`；索引 `scripts(org_id)`。
2. BEFORE INSERT 触发器（补 org_id / created_by；Fordexa 稿被别家占用时清空正文）、BEFORE UPDATE 触发器（锁住 user_id / org_id / created_by）。
3. `script_changes` 表 + AFTER INSERT/UPDATE/DELETE 触发器。触发器函数用 `security definer` 并固定 `search_path`。
4. `fordexa_claims` 表 + 回填 + AFTER INSERT 触发器。
5. `bug_reports` 表。
6. `profiles.avatar_path`；公开桶 `avatars`。
7. 新表都 `enable row level security` 且不加 policy（只走 service key），和前一期 `script_versions` 一致。

触发器要能在 App 的写入（`authenticated` 角色）下正常跑，不能让 App 保存失败。

## 验证

- 单元测试（`node --test`，沿用 `src/**/*.test.ts`）：权限判断（谁能进、在看哪家）、占用判断（是不是占用者、生成材料去不去原稿）、修改记录的文案生成、头像裁剪的尺寸计算等纯函数。
- 用临时脚本（会话令牌只在内存里，同前一期）对真实接口实测：
  - 企业成员看不到别家的稿子、改不了别家的稿子（403/404）；
  - 管理员切到某家后，生成用的是那家的提示词和声音；
  - 被占用的 Fordexa 稿，别家拉进来正文为空、生成材料里没有原稿；
  - 网页上改日期、改正文，修改记录里有正确的人；
  - 用一个普通用户令牌直接写 `scripts`（模拟 App），修改记录里记的是那个人，`user_id` 改不掉，占用规则生效；
  - 反馈能收到邮件、附件在、后台能看到。
- `tsc`、`next build` 通过；手机宽度（390px）下看切换栏、反馈面板、头像上传。
- 测试会写真实数据：用完删掉，或者写明留下了什么（前一期误改过 Shawn 一条稿子的标题，这次测试只用测试账号/测试稿子）。

## 审阅后补充的决定

审阅时提出的问题，按下面定。标「Claude 的判断」的，Shawn 可以改。

1. **App 这一期只是过渡**：网页先做好、App 以后一致，这是 Shawn 定的。所以第 2 节「稿子写在最早注册的成员名下」就是这一期的过渡办法，不放开 RLS。等 App 改版、放开 RLS 时，同公司的人在 App 里也能看到全部稿子，这个规则就不再重要了。
2. **管理员拉稿一律算占用，占给正在看的那家公司**。管理员切到某家去拉稿，本意就是给这家排稿。测试拉的稿子用后台「释放」放回去。不另做「试拉不占用」。（Claude 的判断）
3. **释放只删占用那一行，已有的稿子不动**：第二家公司之前拉的空稿子还是空的，不会自动补上原稿。释放以后，谁先再导入 Fordexa 稿就归谁，第二家也可以重新拉一次。（Claude 的判断）
4. **登录**：网页只支持邮箱 + 密码，账号就是 App 里绑定邮箱的那个。没有公司或公司没开通的人进不了工作台，由 Shawn 在后台现有的用户 / 公司管理里给他设公司。这一期不另做登录方式。（Claude 的判断）
5. **换公司**：稿子算公司的内容，一个人换了公司，他以前的稿子留在原公司。没有公司的人的旧稿子 `org_id` 留空；BEFORE UPDATE 触发器只拦「改了 org_id」，原值为空的允许补上一次。这一期不做「把稿子挪到别家」。（Claude 的判断）
6. **删除**：同公司的任何成员都能删公司里的任何稿子，包括 Shawn 排的。Shawn 说过客户可以自己改，删除靠修改记录兜底。App 现在本来就是硬删除，所以修改记录用 BEFORE DELETE 触发器，从 OLD 里存标题和正文快照，删了也能看到删的是什么、谁删的。`script_changes.script_id` 不加外键，稿子删了记录还在。网页删除前先写 `edited_by`。（Claude 的判断）
7. **提示词的修改**：提示词库（`prompts` 表）前一期已经是每次保存存一个新版本，有 `created_by` 和历史，改坏了能找回来。这一期不另做保护，企业成员和 Shawn 都能改自己在看的那家公司的提示词。

## 留给建造者的

- 试听音频按公司存放的具体路径、旧路径要不要迁移（旧的可以留着，按 hash 判断要不要重念）。
- 截图存哪个桶。
- 释放占用的日志记在哪。
- 网页删除稿子时怎么记下删除人。
- 切换栏、反馈面板、头像上传的具体样式（沿用工作台现有的配色、圆角、按钮高度）。
