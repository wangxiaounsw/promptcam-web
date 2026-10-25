# 每家公司一个 agent：Notion 登记 + 提示词同步 + 按名字叫 agent

日期：2026-10-25
状态：草稿，待审阅、待 Shawn 确认
相关：
- Notion「🤖 Subagents」库（2026-03-27 Skill Hub 时建，至今是空的）：https://app.notion.com/p/83e3f9f9b5794a0193d042aae6459cc2
- Notion「📚 Skills」库：`collection://4ae5d303-50d4-4e81-8e87-dd2cff0e57f6`
- Notion「Fordexa口播助手 / 提示词」库：`collection://6901b841-0856-4e7f-a24b-140abeab669d`
- Supabase 提示词表：`supabase/migrations/20261017b_prompts.sql`、`src/lib/prompts.ts`、`src/lib/prompt-pick.ts`
- 公共稿流水线设计（2026-10-19，另一个项目，本期不做）：Notion「设计 · 从话题到文章和口播」https://app.notion.com/p/3fec3a585c6581438864f0b125a11465

## 为什么做

Shawn 要给多家公司（Fordexa 公共稿、王小墨＝他自己、Vtax，以后更多）持续出文章、口播和视频。每家的风格、出镜人、能用的工具都不一样。现在这些信息散在提示词库、skill、daily summary 和 Shawn 脑子里，每次干活都要重新交代一遍。

他要的是：**每个人 / 每家公司一个 agent，登记在 Notion 里**。agent 是谁、为谁写、会哪些 skill、用哪几条提示词，都能在 Notion 一眼看到、随手改；改完下一次叫这个 agent 就按新的来，Notion 页面历史就是版本记录。

另一个约束来自客户：Shawn 希望客户（如 Vtax 周会计）以后能在网站工作台 `/studio` 自己调口播风格，不用每次都等他出现。客户在网站上存的提示词在 Supabase。所以提示词的**正本在 Supabase**，Notion 里放副本，两边靠同步保持一致。

Shawn 的原话里的两条规矩：
- 前期基本是 Shawn 在调提示词，他想在 Notion 里调，因为随时能看到。
- **客户改过的，Shawn 不再动**——两人意见可能不一致，他不想覆盖客户的提示词。

## 目标

1. **Subagents 库建起来**：每个人 / 公司一行，页面正文写 agent 的描述，`Skills` 列链接它会用的 skill，新加的列链接它用的提示词。首批三行：Fordexa 公共稿、王小墨、Vtax。
2. **Notion 提示词库每条存两列**：「Shawn 调的版本」和「网站当前版本」，后者带同步日期。
3. **同步**：
   - 每天固定时间把 Supabase 里的当前版本抓回 Notion「网站当前版本」列（只读回来，不往网站写）。
   - 叫 agent 之前做一次完整同步：Shawn 在 Notion 改了、客户没接手 → 写进 Supabase 成为新一版。
   - 客户接手后，只从 Supabase 往 Notion 同步，Shawn 的改动不写进去，只提示。
4. **按名字叫 agent**：Shawn 说「让 Vtax agent 写 PAYG 的口播」，Claude 先同步，再读 Notion 里这个 agent 的描述、skill 和提示词，起一个 subagent 干活。
5. **写文章的提示词也进 Supabase**，和 10-17 搬进去的写口播一样，规则统一。
6. **做视频的提示词不同步**（Shawn 2026-10-25 定）：它是一份做视频的操作手册（品牌色、组件、文件路径、流程），网站不用，但 Shawn 常改。留在 Notion 提示词库，写在页面正文里（保留标题排版），叫 agent 时直接从 Notion 读正文。

## 不做

- 不做公共稿流水线（调研 / 写稿 / 审稿 agent、截图、数字核对）。那是 10-19 设计的另一个项目，排在本项目之后，做好后作为 skill 挂到「Fordexa 公共稿」agent 上。
- 不做「客户改稿后自动归纳成风格规则」。等 Vtax 真开始自己改稿、有数据了再做。
- 不改网站工作台的界面。客户在工作台里怎么改提示词保持现状（目前只用写口播一步）。
- 不改 App。
- 不把 skill 的正文搬进 Notion 运行。skill 照旧装在本机 `~/.claude/skills/`（带脚本），Notion Skills 库是登记处，agent 行只链接「它会哪些」。
- 不自动发布，不自动起草。叫 agent 永远由 Shawn 开口。

## 反目标（做出来也算失败）

- 客户在网站上存过自己的提示词，之后被 Shawn 在 Notion 的改动覆盖了。
- 同步把 Shawn 改到一半的 Notion 文字推到了网站（例如定时任务在他编辑时推送）。
- Notion 和 Supabase 不一致却没人知道：agent 用的是 A，网站用的是 B。
- 一次同步写出两条「启用」的提示词（违反 `prompts_one_active`）。
- 叫 agent 时某个链接的 skill 本机没装，agent 却照样开干、靠猜。

## Notion 结构

### 🤖 Subagents 库（已存在，只有 Name、Skills 两列）

加列：

| 列 | 类型 | 说明 |
|---|---|---|
| Name | 标题（已有） | 例：Fordexa 公共稿、王小墨、Vtax |
| Skills | 关联 → Skills（已有） | 这个 agent 会用的 skill |
| 提示词 | 关联 → 提示词库 | 这家公司在各步骤用的提示词（含它会回落到的行业 / 通用那条） |
| 所属公司 | 文本 | 和 Supabase `organizations.name` 一字不差；Fordexa 公共稿留空（= 不限公司） |
| 行业 | 单选 | 会计 / 移民留学 / 贷款 / 房产 / 律师 / 数据 / 通用，和提示词库同一套 |
| 模型 | 单选 | sonnet / opus。默认 opus（写作类），见「模型」 |
| 状态 | 单选 | 启用 / 停用 |
| 版本说明 | 文本 | 这次改了什么、为什么 |

**页面正文 = agent 描述**，固定几块（Shawn 随时改）：
- 我是谁、替谁干活（公司、出镜人、观众）
- 风格要点（几条）
- 硬规矩（不能做的事，如 Vtax：不编第一人称、数字必须能追到 ATO 原文）
- 交付物放哪（Notion 哪个库、本地哪个文件夹）

首批三行的描述由 Claude 从现有材料起草（提示词库、daily summary、`76-小红书视频/CLAUDE.md`、memory），Shawn 改定：

- **Fordexa 公共稿**：客观、不带说话人个人经历的基础版，给所有公司当底稿；只用一手官方来源。规矩取 10-19 设计「3.2 口播」那十条。
- **王小墨**：Shawn 本人出镜；口播要有观点，优先用 Shawn 自己的经历；数据类选题（ABS 等）。
- **Vtax**：Camberwell 华人会计师事务所，周会计（周赟）出镜，「简单易懂」；视频多为现场对话剪辑 + 她的克隆声音 + 动画补段（FX-0003 做法）。

首批 Skills 链接（Claude 起草，Shawn 改）：xhs-research、xhs-cover、xhs-rough-cut、chatgpt-imagegen、fordexa-publish（只装在云端，见「叫 agent」第 4 步）。公共稿 skill 做好后再挂。

### 提示词库（已存在）

加列：

| 列 | 类型 | 说明 |
|---|---|---|
| Shawn 调的版本 | 文本 | Shawn 在 Notion 里改的就是这一列 |
| 网站当前版本 | 文本 | 只由同步写，Shawn 不改 |
| 网站同步于 | 日期（含时间） | 最近一次把网站版本抓回来的时间 |
| 网站版本 ID | 文本 | 最近一次同步看到的 Supabase `prompts.id` |
| 客户已接手 | 复选框 | 只由同步写：网站当前启用的那版是客户（非管理员）存的 |
| 同步提示 | 文本 | 只由同步写：例如「客户 10-30 改过，你的改动没写进去」「两边都改了，等你选」 |
| 同步网站 | 复选框 | 勾 = 和 Supabase 同步（用上面两列）；不勾 = 只在 Notion，全文在页面正文，agent 直接读正文。做视频那几条不勾，其余勾 |

不同步的提示词（做视频）：上面「Shawn 调的版本 / 网站当前版本」等同步列留空，页面正文照旧是全文，Shawn 直接改正文，下次叫 agent 就生效。

现有列（名称、用在哪一步、行业、所属企业、状态、版本说明）保留。页面正文里现在的提示词全文：首次同步时抄进「Shawn 调的版本」（见「首次同步」），**正文保留不动**——Vultr 上 fordexa-pipeline 的 `lib/prompts.py` 按页面正文读精筛 / 拆口播 / 数据选题 / 写口播（2026-10-25 查到）。

**一个范围在 Notion 里只有一行**（现在 15 条正好一范围一条）。历史版本不在 Notion 里另建行：Supabase 每版一行就是历史，Notion 页面历史是第二份。（Claude 定的。）

一条 Notion 提示词对应 Supabase 里一个「范围」，匹配规则和 `savePrompt` 停用旧版的规则一致（Claude 定的）：
- 有「所属企业」的：按 步骤 + 公司 匹配，**不看行业**（公司换了行业也还是同一条）。
- 没有「所属企业」的：按 步骤 + 行业 匹配（行业 = 通用 ↔ `industry is null`）。

提示词全文按 Markdown 纯文本存（`## 标题`、`**加粗**` 原样保留），网站和 agent 读到的是同一串文字。超过 8000 字（工作台和网站的上限）的不推，在「同步提示」里说明。（Claude 定的。）

对照表：

- 步骤：精筛 screen、写文章 write_article、拆口播 split_scripts、写口播 write_script、数据选题 data_topics、做视频 make_video
- 行业：会计 accounting、数据 data，其余照 `industries` 表的 key

## 同步规则

Supabase 是正本。每个范围的状态由四样东西决定：Notion「Shawn 调的版本」(S)、Notion「网站当前版本」(W)、Notion「网站版本 ID」(id₀)、Supabase 当前启用那条 (row，含 id、body、created_by)。

**「客户接手」的判定**：这个范围在 Supabase 里**出现过任何一版**是非管理员（`profiles.is_admin = false`）存的，就算接手。Shawn 从网站后台或从 Notion 同步写进去的，`created_by` 都是 Shawn 的账号，算管理员。

**接手是粘住的**（Claude 按 Shawn「客户改过的，我不再动」定的）：之后 Shawn 在网站上替客户存了一版，也不会自动解除。只有 Shawn 明说「这条交还给我」才解除（解除方式由实现者定，例如记一个解除时间，之后只看这个时间以后的版本）。

**通用 / 行业那几条的保护**（Claude 定的）：没有「所属企业」的提示词是所有没有专属提示词的公司的回落。推这类之前，在对话里列出会受影响的公司，Shawn 说可以才推。

### 定时同步（每天一次，只读回来）

对每条 Notion 提示词：
1. 读 Supabase 当前启用那条。
2. 写 Notion：W = row.body，网站版本 ID = row.id，网站同步于 = 现在，客户已接手 = 按上面判定。
3. **不改 S，不往 Supabase 写。** 如果 S ≠ 新的 W，在「同步提示」里写一句说明（例如「你有改动还没推到网站，下次叫 agent 时会推」或「客户已接手，你的改动不会生效」）。

时间：每天 06:00 墨尔本时间（和官方源探测同一时段）。

### 叫 agent 前的同步（完整同步，可以往网站写）

对这个 agent 链接的每条提示词，按顺序判断：

| 情况 | 判断 | 做什么 |
|---|---|---|
| 1. 都没变 | row.id = id₀ 且 S = W | 什么都不做 |
| 2. 只有网站变了 | row.id ≠ id₀ 且 S = W | 拉回：W = S = row.body，更新 ID、同步时间、接手标记 |
| 3. 只有 Shawn 改了，客户没接手 | row.id = id₀ 且 S ≠ W 且未接手 | 推上去：用 `savePrompt` 的规则在 Supabase 插一条新的启用（旧的停用），`created_by` = Shawn，`note` =「Shawn 在 Notion 调：」+ Notion「版本说明」；然后 W = S，更新 ID 和时间 |
| 4. Shawn 改了，但客户已接手 | S ≠ W 且已接手 | 不写网站。W = row.body（若网站也变了就拉回），S 不动；「同步提示」写「客户已接手，你的改动没写进去」，并在对话里把 S 和 W 的差别摆给 Shawn |
| 5. 两边都改了，客户没接手 | row.id ≠ id₀ 且 S ≠ W 且未接手（网站是 Shawn 自己在后台改的） | 停，不自动合并。把 S、旧 W、新网站版三份的差别摆给 Shawn，让他选哪份或手动合 |

叫 agent 时 agent 用的永远是 Supabase 当前启用那条（同步后的结果）。情况 4、5 不阻止叫 agent：情况 4 用客户版；情况 5 等 Shawn 选完再继续。

Supabase 里还没有这个范围的启用提示词（例如王小墨的两条现在是草稿）：Notion 状态 = 启用且 S 非空时，按情况 3 推上去；Notion 状态是草稿就不推，agent 回落到行业 / 通用那条（和 `pickPrompt` 一样），并在对话里说一句用的是哪条。

### 首次同步（一次性迁移）

- **写口播**：10-17 已搬进 Supabase，Supabase 为准。S = W = Supabase 当前启用那条；Notion 页面正文里的旧全文不再用（Notion 页面历史里留着）。注意：Notion「写口播 · Vtax」10-22 还被编辑过（版本说明到 v4），Supabase 那条是 10-17 的 —— 对照时要特别标出这条的差别，由 Shawn 定用哪份。
- **做视频**：不同步，不推 Supabase，「同步网站」不勾，正文不动。
- **写文章、其它步骤**：现在只在 Notion。把 Notion 页面正文的全文作为 S，按情况 3 推进 Supabase（`status` 照 Notion：启用 → active，草稿 → draft，停用不推），然后 W = S。
- 现状（2026-10-25 查）：Supabase `prompts` 只有 3 条，全是写口播（通用、王小墨、Vtax），`created_by` 都为空，没有客户存过的版本，不存在覆盖客户的风险。
- 做法：先「只看不写」跑一遍，列出每条「Notion 正文 vs Supabase 现有」的对照给 Shawn 过目；Shawn 确认后再正式写。（Claude 定的。）

## 叫 agent

做成一个本地 skill（名字由实现者定，建议 `company-agent`），用 `skill-creator` 登记到 Notion Skills 库。**两种叫法**（Shawn 2026-10-25 同意）：

- **交给它干**：「让 <agent 名> 写 / 出 <什么>」——起 subagent，一口气干完交结果，中途不问 Shawn。适合写文章、写口播、出采访提纲这类一次交付的活。走下面 1–6 步。
- **陪我做**：「用 <agent 名> 的身份做 <什么>」——不起 subagent。主对话做 1–4 步，把描述、提示词、skill 清单加载进当前对话，然后和 Shawn 一步步来回做。适合做视频、挑封面这类每步都要 Shawn 看的活。

步骤：

1. 在 Subagents 库按 Name 找到这一行；找不到或状态 = 停用就停下说明。
2. 对它链接的、勾了「同步网站」的提示词做「叫 agent 前的同步」。
3. 读页面正文（描述）、链接的 skill 列表、同步后的提示词全文、不同步的提示词（做视频）的 Notion 正文。
4. 检查每个链接的 skill 本机是否装了（`~/.claude/skills/<name>/SKILL.md`）。没装的：如果这次任务用不到就提一句继续；用得到就停下，说明缺哪个、去哪装（Notion Skills 库 / `notion-skill-hub`）。fordexa-publish 只在云端，发布这一步照旧由 Shawn 在云端会话做。
5. 用 Agent 工具起一个 subagent（general-purpose，有全部工具），模型按这一行的「模型」列。给它的提示词 = 描述 + 「你会用的 skill：名字 + 本机路径，用到时先读 SKILL.md」+ 各步骤提示词全文 + 这次的任务。不给它别家公司的任何东西（只靠提示词里不放，不另做权限隔离）。
6. subagent 交回后，主对话把结果按描述里「交付物放哪」写好，向 Shawn 报告：做了什么、用的哪几版提示词（Supabase id + 日期）、同步时发生了什么。

## 同步代码放哪（Claude 定的，Shawn 可改）

同一套判断逻辑定时任务和叫 agent 都要用，所以只写一份：

- **放在 promptcam-web**：一个纯函数决定「五种情况」（好写测试），一个同步模块执行读写（Supabase + Notion API），模式为「全部（只读回来）」或「某个 agent（完整同步）」，另有「只看不写」开关。
- **叫 agent 时**：本地 skill 用一个本机命令行脚本直接调这个模块（读 `.env.local`，连的就是线上 Supabase，项目只有一个），**不依赖网站部署**——这样网站代码等 Shawn 确认提交前，同步也能在本机用。
- **定时**：跑在 Vultr（Shawn 2026-10-25 定：Notion token 能读写整个 Notion，不放进网站；也不用对外开接口）。Vultr 上的 promptcam-web 仓库里，claude-user 的 crontab 每小时调 `scripts/agent-sync-cron.sh`，只有悉尼 06 点那次真跑「全部，只读回来」。环境变量在那份仓库的 `.env.local`。
- **Notion token**：用 `~/.claude/keys.csv` 里现成的那个，放进本机和 Vultr 的 `.env.local`；不放 Vercel。

（备选：同步逻辑放在本地 skill 里、用 Notion MCP 写。缺点是定时任务只能在本机开着时跑。）

## 模型

按成本规则（`~/.claude/rules/common/agents.md`）：写作类 agent（三家都是）默认 opus，中文写作质量是这件事的核心；以后做纯检索 / 整理的 agent 用 sonnet。每行「模型」列可改。（Claude 定的。）

## 约束

- Supabase 写入沿用 `savePrompt` 的规则：同一范围先停用旧的再插新的，不能出现两条启用。
- 日期一律按 `Australia/Melbourne`。
- 用户看得到的文字（Notion、skill、对话）用中文白话。
- promptcam-web 的改动按提交规矩：本地验证完先给 Shawn 看，确认后再提交、再推。
- Notion 文本列单段有 2000 字限制，长提示词（Vtax 的写口播已超过）要分段写入同一列；实现第一步先验证能写进、读回来一字不差。验证不通过就停下告诉 Shawn，不要自行改成别的存法。
- 叫 agent 时只读 Notion 里**启用**的 agent 行和它**链接**的提示词，不按名字模糊猜。

## 留给实现者决定

- skill 的名字和内部组织。
- 同步接口的路径、参数格式、密钥变量名。
- 比较 S 和 W 时是否忽略首尾空白、换行符差异（建议忽略首尾空白，统一换行符）。
- 差别怎么摆给 Shawn（按行 diff 即可，工作台已有 `src/lib/studio/prompt-diff`）。
- 首批三个 agent 描述的具体措辞（起草后 Shawn 改）。
