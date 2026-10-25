import type { SupabaseClient } from '@supabase/supabase-js';
import { saveVersion, type NewVersion } from '../prompt-store.ts';
import { diffLines, type DiffLine } from '../studio/prompt-diff.ts';
import { decideFull, isTakenOver, pullNote, type FullAction } from './decide.ts';
import { checkbox, date, relationIds, select, text, type NotionApi, type NotionPage } from './notion-api.ts';
import { toRichText } from './rich-text.ts';
import { resolveScope, statusKey, type OrgRow, type Scope } from './scope.ts';

/**
 * Notion 提示词库 ↔ Supabase prompts 的同步（设计：docs/superpowers/specs/2026-10-25-company-agents-design.md）。
 * pull = 每天定时，只把网站版本抓回 Notion；full = 叫某个 agent 前，按五种情况推 / 拉 / 停。
 * Supabase 是正本。本机脚本和 Vercel Cron 都调这里，所以不 import `@/`。
 */

export const PROMPTS_DS = '6901b841-0856-4e7f-a24b-140abeab669d';
export const AGENTS_DS = '5578de7f-5517-479f-a69e-8da6b1909b8b';

export const COL = {
  shawn: 'Shawn 调的版本',
  site: '网站当前版本',
  syncedAt: '网站同步于',
  siteId: '网站版本 ID',
  takenOver: '客户已接手',
  note: '同步提示',
  sync: '同步网站',
  releasedAt: '接手解除于',
} as const;

export type StoredPrompt = {
  id: string;
  step: string;
  org_id: string | null;
  industry: string | null;
  status: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type PromptStore = {
  load(): Promise<{ orgs: OrgRow[]; adminIds: Set<string>; prompts: StoredPrompt[] }>;
  save(v: NewVersion): Promise<{ id: string; body: string; created_at: string }>;
};

export type SyncDeps = {
  notion: Pick<NotionApi, 'queryAll' | 'getPage' | 'updateProps'>;
  store: PromptStore;
  now: () => Date;
  shawnId: string;
};

export type SyncOptions = {
  mode: 'pull' | 'full';
  agent?: string;
  dryRun: boolean;
  /** 没有所属企业的提示词能不能推：true = 全部；页 id 列表 = 只推这几条 */
  yesGeneral: boolean | readonly string[];
  /** 两边都改了（conflict）时，Shawn 选了 Notion 版的页 id：照推 */
  acceptNotion?: readonly string[];
  /** 两边都改了时，Shawn 选了网站版的页 id：拉回覆盖 Notion */
  acceptSite?: readonly string[];
};

export type SyncItem = {
  page: string;
  name: string;
  action: FullAction | 'pulled' | 'error' | 'needs-confirm';
  note: string | null;
  diff?: DiffLine[];
  activeId: string | null;
  body: string | null;
};

export type SyncResult = { items: SyncItem[]; affectedOrgs?: Record<string, string[]> };

const PAGE = 1000;

/** 每存一版多一行，表会一直长；PostgREST 一次最多回 1000 行，所以翻到底，不然最新的启用版和客户版会被漏掉 */
async function allPrompts(db: SupabaseClient): Promise<StoredPrompt[]> {
  const rows: StoredPrompt[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('prompts')
      .select('id, step, org_id, industry, status, body, created_by, created_at')
      .order('created_at')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`读 Supabase 提示词失败：${error.message}`);
    rows.push(...((data ?? []) as StoredPrompt[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export function supabaseStore(db: SupabaseClient): PromptStore {
  return {
    async load() {
      const [orgs, admins, prompts] = await Promise.all([
        db.from('organizations').select('id, name, industry'),
        db.from('profiles').select('id').eq('is_admin', true),
        allPrompts(db),
      ]);
      const failed = [orgs, admins].find((r) => r.error);
      if (failed?.error) throw new Error(`读 Supabase 失败：${failed.error.message}`);
      return {
        orgs: (orgs.data ?? []) as OrgRow[],
        adminIds: new Set(((admins.data ?? []) as { id: string }[]).map((a) => a.id)),
        prompts,
      };
    },
    save: (v) => saveVersion(db, v),
  };
}

const rich = (s: string) => ({ rich_text: toRichText(s) });

function inScope(p: StoredPrompt, s: Scope): boolean {
  if (p.step !== s.step) return false;
  return s.orgId ? p.org_id === s.orgId : p.org_id === null && p.industry === s.industry;
}

/** 推一条没有公司的提示词会影响谁：这一步没有自己专属启用版、会回落到它的公司 */
function fallbackOrgs(scope: Scope, orgs: OrgRow[], prompts: StoredPrompt[]): string[] {
  const live = prompts.filter((p) => p.step === scope.step && p.status === 'active');
  return orgs
    .filter((o) => !live.some((p) => p.org_id === o.id))
    .filter((o) =>
      scope.industry
        ? o.industry === scope.industry
        : !live.some((p) => p.org_id === null && p.industry !== null && p.industry === o.industry),
    )
    .map((o) => o.name);
}

async function promptPages(deps: SyncDeps, opts: SyncOptions): Promise<NotionPage[]> {
  if (opts.mode === 'pull') return (await deps.notion.queryAll(PROMPTS_DS)).filter((p) => checkbox(p, COL.sync));
  const agents = await deps.notion.queryAll(AGENTS_DS);
  const agent = agents.find((a) => text(a, 'Name') === opts.agent && select(a, '状态') === '启用');
  if (!agent) throw new Error(`找不到启用的 agent「${opts.agent ?? ''}」`);
  const pages = await Promise.all(relationIds(agent, '提示词').map((id) => deps.notion.getPage(id)));
  return pages.filter((p) => checkbox(p, COL.sync));
}


const NOTE = {
  blocked: '客户已接手，你的改动没写进去',
  conflict: 'Notion 和网站两边都改了，等你选用哪份',
  tooLong: '超过 8000 字，没推到网站',
  draftUsesSite: '草稿或停用，没推到网站；agent 用网站现有版',
  draftUsesNotion: '草稿，没推到网站；agent 用 Notion 里的草稿',
  disabled: '停用，没推到网站',
  empty: '「Shawn 调的版本」是空的，没推',
  takenOverNoActive: '客户已接手，没推',
} as const;

type RowCtx = {
  deps: SyncDeps;
  opts: SyncOptions;
  orgs: OrgRow[];
  adminIds: Set<string>;
  prompts: StoredPrompt[];
  now: string;
  write: (id: string, props: Record<string, unknown>) => Promise<void>;
};

type RowResult = { item: SyncItem; affected?: string[] };

const listed = (list: boolean | readonly string[] | undefined, id: string) =>
  list === true || (Array.isArray(list) && list.includes(id));

async function syncRow(ctx: RowCtx, page: NotionPage): Promise<RowResult> {
  const { deps, opts } = ctx;
  const name = text(page, '名称');
  const head = { page: page.id, name };
  const resolved = resolveScope(
    {
      step: select(page, '用在哪一步') ?? '',
      industry: select(page, '行业') ?? '通用',
      company: text(page, '所属企业') || null,
      status: select(page, '状态') ?? '',
    },
    ctx.orgs,
  );
  if (!resolved.ok) return { item: { ...head, action: 'error', note: resolved.reason, activeId: null, body: null } };

  const { scope, orgIndustry } = resolved;
  const versions = ctx.prompts.filter((p) => inScope(p, scope));
  const active = versions.filter((p) => p.status === 'active').at(-1) ?? null;
  const takenOver = isTakenOver(versions, ctx.adminIds, date(page, COL.releasedAt));
  const shawn = text(page, COL.shawn);
  const siteId = text(page, COL.siteId) || null;
  const notionStatus = statusKey(select(page, '状态') ?? '');
  const input = {
    shawn,
    base: versions.find((v) => v.id === siteId)?.body ?? '',
    siteId,
    active: active && { id: active.id, body: active.body },
    takenOver,
    notionStatus,
  };
  const current = { activeId: active?.id ?? null, body: active?.body ?? null };
  // 每天的定时同步只写展示用的列；「网站版本 ID」是基准，只有完整同步对齐时才写
  const shown = (body: string, taken: boolean, note: string | null) => ({
    [COL.site]: rich(body),
    [COL.syncedAt]: { date: { start: ctx.now } },
    [COL.takenOver]: { checkbox: taken },
    [COL.note]: rich(note ?? ''),
  });
  const aligned = (body: string, id: string, taken: boolean) => ({ ...shown(body, taken, null), [COL.siteId]: rich(id) });

  if (opts.mode === 'pull') {
    const note = pullNote(input);
    await ctx.write(page.id, shown(active?.body ?? '', takenOver, note));
    return { item: { ...head, action: 'pulled', note, ...current } };
  }

  let action = decideFull(input);
  if (action === 'conflict' && listed(opts.acceptNotion, page.id)) action = notionStatus === 'active' ? 'push' : 'skip-draft';
  if (action === 'conflict' && listed(opts.acceptSite, page.id)) action = 'pull';

  if (action === 'push') {
    const diff = diffLines(active?.body ?? '', shawn);
    if (!scope.orgId && !listed(opts.yesGeneral, page.id)) {
      return {
        item: { ...head, action: 'needs-confirm', note: '没有所属企业，推之前要你确认', diff, ...current },
        affected: fallbackOrgs(scope, ctx.orgs, ctx.prompts),
      };
    }
    if (opts.dryRun) return { item: { ...head, action, note: '会推到网站', diff, ...current } };
    const saved = await deps.store.save({
      step: scope.step,
      orgId: scope.orgId,
      industry: scope.orgId ? orgIndustry : scope.industry,
      name,
      body: shawn,
      note: `Shawn 在 Notion 调：${text(page, '版本说明')}`,
      userId: deps.shawnId,
    });
    await ctx.write(page.id, aligned(saved.body, saved.id, false));
    return { item: { ...head, action, note: '已推到网站', activeId: saved.id, body: saved.body } };
  }
  if (action === 'pull' && active) {
    await ctx.write(page.id, { [COL.shawn]: rich(active.body), ...aligned(active.body, active.id, takenOver) });
    return { item: { ...head, action, note: '已从网站拉回', ...current } };
  }
  if (action === 'blocked-takeover' && active) {
    await ctx.write(page.id, shown(active.body, true, NOTE.blocked));
    return { item: { ...head, action, note: NOTE.blocked, diff: diffLines(active.body, shawn), ...current } };
  }
  if (action === 'conflict' && active) {
    return { item: { ...head, action, note: NOTE.conflict, diff: diffLines(active.body, shawn), ...current } };
  }
  if (action === 'too-long') {
    await ctx.write(page.id, { [COL.note]: rich(NOTE.tooLong) });
    return { item: { ...head, action, note: NOTE.tooLong, ...current } };
  }
  if (action === 'skip-draft') {
    // 网站上有：agent 用网站现有版。没有、Notion 是草稿：先用草稿（10-19 设计「取不到启用的就用草稿版」）
    const usesDraft = !active && notionStatus === 'draft' && shawn.trim() !== '';
    const note = active
      ? NOTE.draftUsesSite
      : usesDraft
        ? NOTE.draftUsesNotion
        : notionStatus === null
          ? NOTE.disabled
          : takenOver
            ? NOTE.takenOverNoActive
            : NOTE.empty;
    await ctx.write(page.id, { [COL.note]: rich(note) });
    return { item: { ...head, action, note, ...(usesDraft ? { activeId: null, body: shawn } : current) } };
  }
  return { item: { ...head, action, note: null, ...current } };
}

export async function runSync(deps: SyncDeps, opts: SyncOptions): Promise<SyncResult> {
  const pages = await promptPages(deps, opts);
  const { orgs, adminIds, prompts } = await deps.store.load();
  const ctx: RowCtx = {
    deps,
    opts,
    orgs,
    adminIds,
    prompts,
    now: deps.now().toISOString(),
    write: async (id, props) => {
      if (!opts.dryRun) await deps.notion.updateProps(id, props);
    },
  };
  const items: SyncItem[] = [];
  const affectedOrgs: Record<string, string[]> = {};
  for (const page of pages) {
    try {
      const { item, affected } = await syncRow(ctx, page);
      items.push(item);
      if (affected) affectedOrgs[item.name] = affected;
    } catch (e) {
      items.push({ page: page.id, name: text(page, '名称'), action: 'error', note: (e as Error).message, activeId: null, body: null });
    }
  }
  return Object.keys(affectedOrgs).length ? { items, affectedOrgs } : { items };
}
