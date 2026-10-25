// Notion 提示词库 ↔ 网站提示词（Supabase prompts）同步。叫 agent 前由 company-agent skill 调。
//   node --env-file=.env.local scripts/agent-sync.mjs --agent <名字> [--dry-run]                    叫 agent 前的完整同步
//        [--yes-general <页id,页id>]   这几条没有所属企业的也推（不带 id = 全推，少用）
//        [--accept-notion <页id,…>]    两边都改了时，这几条用 Notion 版推上去
//        [--accept-site <页id,…>]      两边都改了时，这几条用网站版拉回 Notion
//   node --env-file=.env.local scripts/agent-sync.mjs --pull [--dry-run]                           只把网站版本抓回 Notion
//   node --env-file=.env.local scripts/agent-sync.mjs --release <提示词页 id>                       「这条交还给我」：解除客户接手
// stdout 是一份 JSON（runSync 的返回），stderr 是中文摘要。写的是线上库，拿不准先 --dry-run。
import { createClient } from '@supabase/supabase-js';
import { NotionApi } from '../src/lib/agents/notion-api.ts';
import { COL, runSync, supabaseStore } from '../src/lib/agents/sync.ts';

const SHAWN_ID = '3c178da0-bebe-46a3-b1ab-1977ffd36226';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
/** 选项后面的值；下一个也是选项（--xxx）就当没给值 */
const value = (name) => {
  const i = args.indexOf(name);
  const next = i >= 0 ? args[i + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
};
const ids = (name) => value(name)?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];

const missing = ['NOTION_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`缺环境变量：${missing.join('、')}（用 --env-file=.env.local）`);
  process.exit(2);
}

const notion = new NotionApi(process.env.NOTION_TOKEN);

const release = value('--release');
if (release && flag('--dry-run')) {
  console.error('--release 会直接写 Notion，不能和 --dry-run 一起用');
  process.exit(2);
}
if (release) {
  await notion.updateProps(release, { [COL.releasedAt]: { date: { start: new Date().toISOString() } } });
  console.error(`已解除客户接手：${release}。下次叫 agent 时你在 Notion 的改动会推到网站。`);
  process.exit(0);
}

const agent = value('--agent');
if (!agent && !flag('--pull')) {
  console.error('用法：--agent <名字> 或 --pull，见文件头');
  process.exit(2);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const result = await runSync(
  { notion, store: supabaseStore(db), now: () => new Date(), shawnId: SHAWN_ID },
  {
    mode: agent ? 'full' : 'pull',
    agent,
    dryRun: flag('--dry-run'),
    yesGeneral: flag('--yes-general') && ids('--yes-general').length === 0 ? true : ids('--yes-general'),
    acceptNotion: ids('--accept-notion'),
    acceptSite: ids('--accept-site'),
  },
);

console.log(JSON.stringify(result, null, 2));
console.error(`${flag('--dry-run') ? '【只看不写】' : ''}${agent ? `agent「${agent}」` : '全部'}：${result.items.length} 条`);
for (const it of result.items) console.error(`- ${it.name} · ${it.action}${it.note ? ` · ${it.note}` : ''} · 页 ${it.page}`);
for (const [name, list] of Object.entries(result.affectedOrgs ?? {})) {
  const page = result.items.find((it) => it.name === name)?.page;
  console.error(`  「${name}」会影响：${list.length ? list.join('、') : '（没有公司回落到它）'}——确认后加 --yes-general ${page} 重跑`);
}
if (result.items.some((it) => it.action === 'error')) process.exitCode = 1;
