# 风格库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `app.fordexa.com/library` 上做一个公开页面（不收录），列出所有封面、转场、口播效果、素材卡片、版式件。每个都有固定编号，内容从 xhs-video 自动渲染、上传。

**Architecture:**
- xhs-video 里有一份登记表 `library/registry.json`，记「编号 → 来源」。脚本 `scripts/library.mjs` 按登记表检查能不能进库，渲染缺的媒体，写 `manifest.json`，输出到 `tmp/library/`。
- promptcam-web 的 `scripts/library-upload.mjs` 把这个文件夹上传到 Supabase 的公开桶 `style-library`。顺序是：先传新文件，再传 manifest，最后删掉不再用的旧文件。
- 页面 `src/app/library/page.tsx` 在服务端读桶里的 manifest（`revalidate: 300`），交给客户端网格显示。

**Tech Stack:**
- xhs-video：Remotion 4.0.391、esbuild、node:test
- promptcam-web：Next.js 15 app router、@supabase/supabase-js、node:test（`npm test`）

**Spec:** `docs/superpowers/specs/2026-11-04-style-library-design.md`（这个仓库里）

## Global Constraints

**流程**
- 两个仓库都要等 Shawn 说「提交」才能 commit。每个任务最后的 commit 步骤，意思是「暂存好改动，等 Shawn 确认」。
- 桶的迁移先给 Shawn 看，再执行。上传先跑 `--dry-run` 给 Shawn 看，再真传。

**渲染**
- 渲染并发 ≤2，`scale: 0.5`。
- 封面出 jpeg，质量 85。
- 动效出 h264，`crf: 26`，静音；另出一张 70% 处的定格图做 poster，质量 80。

**编号**
- 格式是「前缀 + 两位数字」，超过 99 自动变三位。
- 分组和前缀：模板封面 K、实拍封面 P、转场 T、口播效果 E、素材卡片 M、版式件 L。页面按这个顺序显示。
- 编号永不复用。下架用 `retired: true`，不删行。

**能不能进库**
- 按组件 id 取 `组件评分.jsonl` 里文件的最后一行：`keep` 能进；`fix`、`drop` 不能进；没评过的能进。

**品牌**
- 封面来源用到非王小墨品牌的人物或照片包，一律拒绝。目前是 `brands/vtax.json` 里的 `zhouyun*`。

**素材卡片（M）的 id**
- `d-caption-box`、`d-keycard`、`d-flow`、`d-scenes`、`d-phone`、`d-real`、`d-shortcut`、`d-quota`

**不进库的**
- `d-app`、`d-end`、第 1 轮（手绘）、第 2 轮（风格选型）
- `tr-cut`、`tr-band`（最新结论是 drop）

**页面**
- 不收录：metadata 设 `robots: { index: false, follow: false }`，`robots.ts` disallow `/library`，不进 sitemap，不加任何链接指向它。
- 没有工作台导航，底部一行「Fordexa」。
- 画面里不出现网址。
- 页面上的文字一律中文。

## Review Focus

1. 登记表里某个编号的来源 id 在代码里已经找不到了：渲染脚本要停下来，报出是哪个编号、哪个 id，不能跳过。测试在 Task 1：`resolveSources missing id`。
2. 某个组件先评 keep、后来评 drop，最后一行是 drop：登记的时候要拒绝。测试在 Task 1：`eligibility uses last line by id`。
3. 有人手改登记表，造成编号重复，或者把已下架的编号挪给别的选项：解析时要报错。测试在 Task 1：`parseRegistry rejects duplicate codes`；另外比对上一次的 manifest：`assertStable`。
4. 上传中途断网：页面要继续显示旧版本，不能变成一半新一半旧，也不能出现 404。测试在 Task 6：`planUpload orders files before manifest before deletes`。
5. 桶里没有 manifest，或者 manifest 坏了：页面要显示「风格库暂时打不开」，不能 500。测试在 Task 7：`parseManifest rejects bad input`。

---

### Task 1: 登记表的纯逻辑（xhs-video）

**Files:**
- Create: `scripts/library-lib.mjs`
- Test: `tests/library-lib.test.mjs`

**Interfaces:**
- Produces（全部从 `scripts/library-lib.mjs` 导出）：
  - `GROUPS = [{ group: "模板封面", prefix: "K" }, { group: "实拍封面", prefix: "P" }, { group: "转场", prefix: "T" }, { group: "口播效果", prefix: "E" }, { group: "素材卡片", prefix: "M" }, { group: "版式件", prefix: "L" }]`
  - `type Source = { type: "kit" | "photo", key: string } | { type: "catalog", id: string }`
  - `type RegEntry = { code, group, source: Source, origin: string, added: "YYYY-MM-DD", retired?: boolean, name?: string, purpose?: string }`
  - `parseRegistry(json): RegEntry[]`：报错的情况有编号重复、前缀和分组对不上、编号格式不对、缺字段。
  - `formatCode(prefix, n): string`：例如 `formatCode("K", 3)` 得到 `"K03"`，`formatCode("K", 100)` 得到 `"K100"`。
  - `nextCode(entries, prefix): string`：取这个前缀已用过的最大号再加 1，已下架的编号也算用过。
  - `latestVerdictById(text: string): Map<id, verdict>`：逐行读，后面的行覆盖前面的，不看是第几轮。坏行跳过。
  - `checkEligible(entry, verdicts): string | null`：不合格返回原因，合格返回 null。
  - `forbiddenAssets(brands: object[]): Set<string>`：收集非王小墨品牌的 `kit.person` 和 `photo.photoSet`，以 `-` 切分前的名字（比如 `zhouyun`）也一起收进去。
  - `isClientAsset(spec, forbidden): boolean`：spec 的 `photoSet`、`person` 或 `brand` 只要命中就返回 true。
  - `resolveSources(entries, meta)`：返回 `{ entry, title, purpose, comp, kind }[]`。来源找不到就抛错：`${code}: 找不到来源 ${id}`。
  - `assertStable(prevManifest | null, entries)`：上一次 manifest 里有的编号，这一次要么还在、要么已下架，而且来源不能变。不满足就抛错。

- [ ] **Step 1: Write the failing tests** in `tests/library-lib.test.mjs`
  - `parseRegistry rejects duplicate codes`：两条 `K01` → 抛错，错误信息含 `K01`。
  - `parseRegistry rejects prefix/group mismatch`：`{ code: "T01", group: "模板封面" }` → 抛错。
  - `formatCode pads to two digits`：`K03`、`K100`。
  - `nextCode counts retired codes`：已有 `K01` 和已下架的 `K02` → 返回 `K03`。
  - `eligibility uses last line by id`：jsonl 依次是 `{round:3,id:"tr-cut",verdict:"keep"}`、`{round:5,id:"tr-cut",verdict:"drop"}` → `checkEligible` 返回含 `drop` 的原因。另一条 `fix` 后又 `keep` → 返回 null。没评过 → 返回 null。
  - `forbiddenAssets picks client people`：输入 vtax 和 wangxiaomo 两个品牌 → 结果含 `zhouyun-real`、`zhouyun`，不含 `shawn-real`。
  - `isClientAsset blocks zhouyun photo set`：`{ photoSet: "zhouyun-real" }` → true；`{ photoSet: "shawn-real" }` → false。
  - `resolveSources missing id`：catalog 来源 `c-gone` 不在 meta 里 → 抛错，错误信息含编号和 `c-gone`。
  - `assertStable catches a moved code`：上一次的 manifest 里 `K01` 的来源是 `kit:bignum-tfn`，这一次是 `kit:bars-first-home` → 抛错。

- [ ] **Step 2: Run** `npm test`。Expected：新测试 FAIL（`Cannot find module`）。

- [ ] **Step 3: Implement** `scripts/library-lib.mjs`。只用 node 内置模块，纯函数；不读文件，文件由调用方读好了传进来。

- [ ] **Step 4: Run** `npm test`。Expected：全部 PASS。

- [ ] **Step 5: Commit**（等 Shawn 说提交）`feat: 风格库登记表的校验逻辑`

### Task 2: 版式件样片 + 补 4 种封面样张（xhs-video）

**Files:**
- Create: `src/catalog-layouts.tsx`（导出 `CATALOG_L: Entry[]`）
- Modify: `src/Root.tsx`：加 `<Folder name="版式件">{comps(CATALOG_L)}</Folder>`
- Modify: `src/covers/samples.ts`：加 4 个 key：`steps-mes`、`list-tax-docs`、`window-citizenship`、`table-power`

**Interfaces:**
- Produces：
  - composition id 是 `c-l-<name>`，`Entry.id` 是 `l-<name>`，name 用下面这些：`bars`（BarRows）、`columns`（Columns）、`trend`（TrendLine）、`bigstat`（BigStat）、`iconlist`（IconList）、`people`（PeopleRow）、`tiles`（Tiles）、`shotseq`（ShotSeq）、`pagestage`（PageStage）、`tag`（Tag 中文翻译卡）。
  - 每个 Entry 都要填 `group: "版式件"`、中文 `name`、一句中文 `purpose`，写法照 `CATALOG_R7`。
  - kit 封面的 key 是上面 4 个。

- [ ] **Step 1:** 每个版式件写一个样片。
  - 照 `CATALOG_R7` 的 `OnSpeaker` / `SplitA` 写法，人像用 `samples/person.mp4`。
  - 数据和文字取自 `src/videos/*` 里第一次用到这个组件的那期（用 `grep -rl <组件名> src/videos` 找），数字旁边标「示意」。
  - 截图类（`shotseq`、`pagestage`、`tag`）用那期 `public/videos/<id>/` 里已有的截图。
  - 每段 90–240 帧。

- [ ] **Step 2:** 补 4 张 kit 样张，`draft: true`，人物和配色照 `wangxiaomo.json`。
  - `steps`：MES 申请步骤，内容取 `76-小红书视频/FX-0019 MES是什么/FX-0019.md`
  - `list`：报税要准备的东西，取 `FX-0024 报税截止/FX-0024.md`
  - `window`：入籍居住要求「4 年里境外不超过 12 个月」，字段照 `spec.ts` 的 window kind
  - `table`：电费参考价，取 `FX-0038 电费参考价/FX-0038.md`
  - 数字从这些 md 里抄，不要自己编。

- [ ] **Step 3: Verify**
  - Run：`node scripts/stills.mjs c-l-bars:60,c-l-pagestage:120`，再把另外 8 个 `c-l-*` 和 4 个 `kit-*` 新 key 都过一遍。
  - Expected：`tmp/stills/` 下出图，没有报错。用 Read 打开每张图看一眼：文字没出画面，没有空白面板。
  - Run：`npm run lint`。Expected：没有错误。

- [ ] **Step 4: Commit**（等 Shawn 说提交）`feat: 版式件样片和 4 种封面版式样张`

### Task 3: 元数据导出 + 渲染脚本 + 初始登记表（xhs-video）

**Files:**
- Create: `src/library/meta.ts`：esbuild 的打包入口，打印 JSON。
  - catalog 部分：`CATALOG_R3`、`CATALOG`（第 4 轮）、`CATALOG_R7`、`CATALOG_L`，每条取 `id/name/purpose/frames`。
  - 封面部分：`SAMPLES`、`PHOTO_SAMPLES`、`PHOTO_FONT_SAMPLES`。
- Create: `scripts/library.mjs`
- Create: `library/registry.json`
- Modify: `package.json`：加 `"library": "node scripts/library.mjs"`
- Modify: 76-小红书视频的 `CLAUDE.md`：在常用命令里加一行 `npm run library`。

**Interfaces:**
- Consumes：Task 1 的全部导出；Task 2 的 composition id。
- Produces：
  - 输出目录 `tmp/library/`。
  - `tmp/library/manifest.json`：`{ version: 1, generated: ISO, items: [{ code, group, kind: "cover" | "video", name, purpose, origin, file, poster?, width, height }] }`。`width`/`height` 是渲染后的像素尺寸。
  - 文件名是 `<code>-<8 位 sha1>.<ext>`。hash 对渲染出来的文件内容取。这样每次重渲都会换文件名，CDN 不会给出旧缓存。
  - Task 6 读这个目录。

- [ ] **Step 1:** 写 `scripts/library.mjs`，命令行用法：`node scripts/library.mjs [--codes K01,T02] [--dry-run]`。按顺序做这些事：
  1. 用 esbuild 把 `src/library/meta.ts` 打包到 `tmp/library/meta.cjs` 并运行，拿到 meta。参数照草稿 `tmp/library-draft/export.mjs` 前面那段。
  2. 读 `library/registry.json` → `parseRegistry`。
  3. 读 `组件评分.jsonl`，路径用 `scripts/review.mjs` 的 `FEEDBACK_FILE` → `latestVerdictById`，对每条没下架的执行 `checkEligible`。
  4. 读 `src/covers/brands/*.json` → `forbiddenAssets`，对封面来源执行 `isClientAsset`。
  5. 读上一次的 `tmp/library/manifest.json`（有的话）→ `assertStable`。
  6. `resolveSources`。

  上面任何一步不通过，就把所有问题一起列出来，exit 1。

  通过以后，渲染「输出目录里没有对应文件」的条目和 `--codes` 指定的条目。旧的同编号文件删掉。最后写 manifest，已下架的不写进去。`--dry-run` 只打印要渲染哪些。

- [ ] **Step 2:** 写初始 `library/registry.json`。
  - 按 K → P → T → E → M → L 的顺序排。
    - K：`samples.ts` 里的 key，按文件顺序，含 Task 2 新加的。
    - P：`photoSamples.ts` 里全部 16 个 key。
    - T：`CATALOG_R3` 去掉 `tr-cut`、`tr-band`。
    - E：`CATALOG_R7` 全部。
    - M：Global Constraints 里那 8 个 id。
    - L：`CATALOG_L` 全部。
  - `origin`：
    - catalog 来源写「谛听视频（第 N 轮评审）」；
    - 版式件写最先用到它的那期 FX 编号；
    - 封面写「封面模板 2026-10-31」。
  - `added` 一律写 `2026-11-04`。
  - kit 封面的 `name` 用版式中文名覆盖，名字表照草稿 `KIND`，其中 `map-crime` 写「地图」。

- [ ] **Step 3: Run** `node scripts/library.mjs --dry-run`
  - Expected：列出全部条目，没有报错，没有 `tr-cut` 和 `tr-band`。
- [ ] **Step 4: Run** 一次故意写错的检查：在登记表里临时加一条 `{ code: "T99", source: { type: "catalog", id: "tr-band" } }`，再跑 `--dry-run`。
  - Expected：exit 1，报错里有 `T99` 和 `drop`。
  - 检查完把这条删掉。
- [ ] **Step 5: Run** `npm run library`
  - Expected：`tmp/library/` 下每个编号都有文件，`manifest.json` 里的条目数等于没下架的条目数。
  - 用 Read 抽看 3 张 jpg。
- [ ] **Step 6: Run** `npm test && npm run lint`。Expected：PASS。
- [ ] **Step 7: Commit**（等 Shawn 说提交）`feat: npm run library 按登记表渲染风格库`

### Task 4: 公开桶迁移（promptcam-web）

**Files:**
- Create: `supabase/migrations/20261104_style_library.sql`

**做什么**
- 建公开桶 `style-library`：public = true，限制 15 MB，只允许 `image/jpeg` 和 `video/mp4`。
- 写法照 `20261019_studio_companies.sql:59` 的 `insert into storage.buckets`，带 `on conflict do nothing`。
- 不加任何 RLS 写策略。写入只用 service key。
- manifest 是 `application/json`，所以允许的类型里也要加上它。

- [ ] **Step 1:** 写好迁移，把 SQL 给 Shawn 看。
- [ ] **Step 2:** Shawn 同意后在 Supabase 执行。
  - Run：`node --env-file=.env.local -e "..."`，用 `storage.getBucket('style-library')`。
  - Expected：`public: true`。
- [ ] **Step 3: Commit**（等 Shawn 说提交）`feat: 风格库公开桶`

### Task 5: 页面数据层（promptcam-web）

**Files:**
- Create: `src/lib/library.ts`
- Test: `src/lib/library.test.ts`

**Interfaces:**
- Produces：
  - `LIBRARY_BUCKET = 'style-library'`
  - `GROUP_ORDER = ['模板封面', '实拍封面', '转场', '口播效果', '素材卡片', '版式件']`
  - `type LibraryItem = { code, group, kind: 'cover' | 'video', name, purpose, origin, file, poster?, width, height }`
  - `parseManifest(raw: unknown): { ok: true, items: LibraryItem[] } | { ok: false, reason: string }`：只接受 `version === 1`。`items` 必须是数组，每项字段齐全，`file` 不能含 `/` 或 `..`。不认识的分组丢掉，并把丢掉的分组名写进 reason（不影响其他项）。结果按 `GROUP_ORDER` 和编号排好序。
  - `mediaUrl(file: string): string`：返回 `${SUPABASE_URL}/storage/v1/object/public/style-library/${file}`。
  - `fetchLibrary(): Promise<ReturnType<typeof parseManifest>>`：用 `fetch(mediaUrl('manifest.json'), { next: { revalidate: 300 } })`。非 200 或者抛错时，返回 `{ ok: false }`，不能 throw。

- [ ] **Step 1: Write failing tests**
  - `parseManifest rejects bad input`：输入 `null`、`{version:2}`、`items` 不是数组、`file: "../x.jpg"`，都返回 `ok: false`。
  - `parseManifest sorts by group then code`：输入顺序是 `T01, K02, K01` → 输出 `K01, K02, T01`。
  - `mediaUrl builds public path`。
- [ ] **Step 2: Run** `npm test`。Expected：FAIL。
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `npm test`。Expected：PASS。
- [ ] **Step 5: Commit**（等 Shawn 说提交）`feat: 风格库 manifest 解析`

### Task 6: 上传脚本（promptcam-web）

**Files:**
- Create: `scripts/library-upload-lib.mjs`
- Test: `scripts/library-upload-lib.test.mjs`
- Create: `scripts/library-upload.mjs`

**Interfaces:**
- Consumes：
  - Task 3 的输出目录格式；
  - Task 5 的 `parseManifest`（脚本里 import `../src/lib/library.ts`，写法照 `showcase-import.mjs` import `.ts` 的方式）。
- Produces：
  - `planUpload(local: LibraryItem[], remote: LibraryItem[] | null): { steps: Step[], added: string[], replaced: string[], retired: string[] }`
    - `Step` 是 `{ op: 'put' | 'delete', path: string }`。
    - 顺序固定：先 put 所有本地有、远端没有的文件（主文件和 poster），再 put `manifest.json`，最后 delete 远端有、本地 manifest 不再引用的文件。
    - `added`、`replaced`、`retired` 是编号列表。replaced 指同一个编号换了文件。

- [ ] **Step 1: Write failing tests**
  - `planUpload orders files before manifest before deletes`：最后一个 put 是 `manifest.json`，所有 delete 都排在它后面。
  - `planUpload skips unchanged files`：两边同名的文件不出现在 steps 里。
  - `planUpload reports retired codes`：远端有 `T05`、本地没有 → `retired` 含 `T05`，它的文件出现在 delete 里。
  - `planUpload first upload`：`remote = null` → 只有 put，manifest 在最后。
- [ ] **Step 2: Run** `npm test`。Expected：FAIL。
- [ ] **Step 3: Implement** `planUpload`。
- [ ] **Step 4:** 写 `scripts/library-upload.mjs`。
  - 用法：`node --env-file=.env.local scripts/library-upload.mjs <xhs-video/tmp/library> [--dry-run]`。
  - 读本地 manifest，下载远端 manifest（没有就当 null），两边都过 `parseManifest`。
  - 打印「新增 / 换图 / 下架」的编号和名字。
  - `--dry-run` 到这里就退出。
  - 真传时按 steps 依次执行，每步打印一行。contentType 按扩展名定。
  - 媒体文件 `cacheControl: '31536000'`（文件名带 hash，所以可以长缓存），manifest 用 `cacheControl: '60'`。
  - 任何一步失败就停下，打印已经做到哪一步。
- [ ] **Step 5: Run** `npm test`。Expected：PASS。
- [ ] **Step 6:** 跑 `--dry-run` 给 Shawn 看。他同意后去掉 `--dry-run` 真传一次。
  - Expected：`curl -s <mediaUrl('manifest.json')>` 返回的 JSON 里，条目数和本地一致。
- [ ] **Step 7: Commit**（等 Shawn 说提交）`feat: 风格库上传脚本`

### Task 7: /library 页面 + 不收录 + 清掉草稿（promptcam-web）

**Files:**
- Create: `src/app/library/page.tsx`
  - 服务端组件，`fetchLibrary()`；
  - metadata：`title: '风格库 · Fordexa'`，`robots: { index: false, follow: false, nocache: true }`。
- Create: `src/app/library/LibraryGrid.tsx`
  - 客户端组件，外观照草稿 `src/app/studio/library/page.tsx`：分组筛选、网格、点一下复制编号、视频 `autoPlay muted loop playsInline`。
  - 草稿用 `showToast`，那是工作台的东西；这里换成卡片上显示 1.5 秒「已复制」。
  - 用 `width`/`height` 设 `aspect-ratio`。
- Modify: `src/app/robots.ts`：disallow 里加 `/library`。
- Test: `src/app/robots.test.ts`（没有就新建）。
- Delete: `src/app/studio/library/`、`public/library-draft/`、xhs-video 的 `tmp/library-draft/`。

**Interfaces:**
- Consumes：Task 5 的 `fetchLibrary`、`mediaUrl`、`LibraryItem`、`GROUP_ORDER`。

- [ ] **Step 1: Write failing test** `robots disallows library`：`robots().rules` 的 disallow 里有 `'/library'`。
- [ ] **Step 2: Run** `npm test`。Expected：FAIL。
- [ ] **Step 3: Implement**
  - 改好 robots。
  - 写页面：`ok: false` 时只显示一行「风格库暂时打不开，过几分钟再试。」，不能 500。
  - 页面最底下一行「Fordexa」。
  - 用 `src/app/layout.tsx` 根布局，不套 `(site)` 的页头页脚，也不套工作台外壳。
- [ ] **Step 4: Run** `npm test` 和 `npx tsc --noEmit`。Expected：PASS，没有类型错误。
- [ ] **Step 5: Verify in browser**
  - `npx next dev -p 3020`，打开 `http://localhost:3020/library`，不用登录。
  - 分别在 1280 宽和 390 宽下截图：手机两列，没有横向滚动。
  - 视频在播。点 K01 后显示「已复制」。
  - `curl -s http://localhost:3020/library | grep -o '<meta name="robots"[^>]*>'`，应该含 `noindex, nofollow`。
  - 临时把 `LIBRARY_BUCKET` 改成不存在的桶，页面应显示那行提示，不能 500。验证完改回来。
- [ ] **Step 6:** 删掉草稿文件。确认 `git status` 里没有 `public/library-draft`。
- [ ] **Step 7: Commit**（等 Shawn 说提交）`feat: 风格库页面 /library（不收录）`

### Task 8: 记下来

**Files:**
- Modify: xhs-video 的 `CLAUDE.md`（没有的话就写 76-小红书视频的 `CLAUDE.md`），加一段「风格库」：
  - 登记表在哪；
  - 加一个新选项的三步：登记表加一行 → `npm run library` → `library-upload.mjs --dry-run`，然后真传；
  - 编号不复用；
  - 线上地址 `app.fordexa.com/library`。
- Create memory：`style-library.md`，写「做封面、动画时先打开风格库，Shawn 报编号，照编号做」，并在 `MEMORY.md` 加一行。

- [ ] **Step 1:** 写文档和 memory。
- [ ] **Step 2: Commit**（等 Shawn 说提交）`docs: 风格库的用法`
