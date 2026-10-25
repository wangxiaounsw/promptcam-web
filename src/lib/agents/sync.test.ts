import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NotionPage } from './notion-api.ts';
import { AGENTS_DS, COL, PROMPTS_DS, runSync, supabaseStore, type PromptStore, type StoredPrompt, type SyncDeps } from './sync.ts';
import type { NewVersion } from '../prompt-store.ts';

const rt = (s: string) => ({ type: 'rich_text', rich_text: s ? [{ plain_text: s }] : [] });
const sel = (s: string | null) => ({ type: 'select', select: s ? { name: s } : null });

function promptPage(id: string, o: {
  name: string; step?: string; industry?: string; company?: string; status?: string;
  shawn?: string; site?: string; siteId?: string; sync?: boolean; note?: string;
}): NotionPage {
  return {
    id,
    properties: {
      名称: { type: 'title', title: [{ plain_text: o.name }] },
      用在哪一步: sel(o.step ?? '写口播'),
      行业: sel(o.industry ?? '会计'),
      所属企业: rt(o.company ?? ''),
      状态: sel(o.status ?? '启用'),
      版本说明: rt(o.note ?? 'v5：加一句'),
      [COL.shawn]: rt(o.shawn ?? ''),
      [COL.site]: rt(o.site ?? ''),
      [COL.siteId]: rt(o.siteId ?? ''),
      [COL.sync]: { type: 'checkbox', checkbox: o.sync ?? true },
      [COL.releasedAt]: { type: 'date', date: null },
    },
  };
}

function agentPage(id: string, name: string, promptIds: string[]): NotionPage {
  return {
    id,
    properties: {
      Name: { type: 'title', title: [{ plain_text: name }] },
      状态: sel('启用'),
      提示词: { type: 'relation', relation: promptIds.map((p) => ({ id: p })) },
    },
  };
}

function fakeNotion(prompts: NotionPage[], agents: NotionPage[] = []) {
  const pages = new Map([...prompts, ...agents].map((p) => [p.id, p]));
  const updates: { id: string; props: Record<string, unknown> }[] = [];
  return {
    updates,
    api: {
      queryAll: async (ds: string) => (ds === PROMPTS_DS ? prompts : ds === AGENTS_DS ? agents : []),
      getPage: async (id: string) => {
        const p = pages.get(id);
        if (!p) throw new Error(`no page ${id}`);
        return p;
      },
      updateProps: async (id: string, props: Record<string, unknown>) => {
        updates.push({ id, props });
        // 像 Notion 一样把写入落到页面上，连续两次同步才测得出来
        const page = pages.get(id);
        if (!page) return;
        for (const [name, value] of Object.entries(props) as [string, Record<string, unknown>][]) {
          const segs = value.rich_text as { text: { content: string } }[] | undefined;
          page.properties[name] = segs
            ? { type: 'rich_text', rich_text: segs.map((s) => ({ plain_text: s.text.content })) }
            : (value as NotionPage['properties'][string]);
        }
      },
    },
  };
}

function fakeStore(prompts: StoredPrompt[], opts: { failSave?: boolean; admins?: string[] } = {}) {
  const saved: NewVersion[] = [];
  const store: PromptStore = {
    load: async () => ({
      orgs: [
        { id: 'v1', name: 'Vtax', industry: 'accounting' },
        { id: 'w1', name: '王小墨', industry: 'data' },
      ],
      adminIds: new Set(opts.admins ?? ['shawn']),
      prompts,
    }),
    save: async (v) => {
      if (opts.failSave) throw new Error('「x」停用了旧版但新版没写进去，这个范围现在没有启用的提示词：boom');
      saved.push(v);
      return { id: 'new', body: v.body, created_at: '2026-10-25T00:00:00Z' };
    },
  };
  return { store, saved };
}

const vtaxActive: StoredPrompt = {
  id: 'r1', step: 'write_script', org_id: 'v1', industry: 'accounting', status: 'active', body: '旧', created_by: null, created_at: '2026-10-17T00:00:00Z',
};

function deps(notion: ReturnType<typeof fakeNotion>, store: PromptStore): SyncDeps {
  return { notion: notion.api, store, now: () => new Date('2026-10-25T06:00:00+11:00'), shawnId: 'shawn' };
}

const textOf = (prop: unknown) => ((prop as { rich_text: { text: { content: string } }[] }).rich_text ?? []).map((r) => r.text.content).join('');

test('pull mode updates site column only', async () => {
  const notion = fakeNotion([promptPage('p1', { name: '写口播 · Vtax', company: 'Vtax', shawn: '我改的', site: '旧', siteId: 'r1' })]);
  const { store, saved } = fakeStore([vtaxActive]);
  const out = await runSync(deps(notion, store), { mode: 'pull', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'pulled');
  assert.equal(saved.length, 0);
  const props = notion.updates[0].props;
  assert.equal(COL.shawn in props, false);
  assert.equal(textOf(props[COL.site]), '旧');
  assert.equal(COL.siteId in props, false);
  assert.match(textOf(props[COL.note]), /下次叫 agent/);
});

test('full push writes version then columns', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · Vtax', company: 'Vtax', shawn: '我改的', site: '旧', siteId: 'r1' })],
    [agentPage('a1', 'Vtax', ['p1'])],
  );
  const { store, saved } = fakeStore([vtaxActive]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Vtax', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'push');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].userId, 'shawn');
  assert.equal(saved[0].orgId, 'v1');
  assert.equal(saved[0].industry, 'accounting');
  assert.match(saved[0].note ?? '', /^Shawn 在 Notion 调：/);
  assert.equal(textOf(notion.updates[0].props[COL.site]), '我改的');
  assert.equal(textOf(notion.updates[0].props[COL.siteId]), 'new');
  assert.equal(out.items[0].body, '我改的');
  assert.equal(out.items[0].activeId, 'new');
});

test('general push needs confirm', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · 通用', industry: '通用', shawn: '新通用', site: '旧通用', siteId: 'g1' })],
    [agentPage('a1', 'Fordexa 公共稿', ['p1'])],
  );
  const general: StoredPrompt = { ...vtaxActive, id: 'g1', org_id: null, industry: null, body: '旧通用' };
  const { store, saved } = fakeStore([general, vtaxActive]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Fordexa 公共稿', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'needs-confirm');
  assert.equal(saved.length, 0);
  assert.equal(notion.updates.length, 0);
  assert.deepEqual(out.affectedOrgs?.['写口播 · 通用'], ['王小墨']);
});

test('general push goes through with yesGeneral', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · 通用', industry: '通用', shawn: '新通用', site: '旧通用', siteId: 'g1' })],
    [agentPage('a1', 'Fordexa 公共稿', ['p1'])],
  );
  const general: StoredPrompt = { ...vtaxActive, id: 'g1', org_id: null, industry: null, body: '旧通用' };
  const { store, saved } = fakeStore([general]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Fordexa 公共稿', dryRun: false, yesGeneral: true });
  assert.equal(out.items[0].action, 'push');
  assert.equal(saved.length, 1);
});

test('dry run writes nothing', async () => {
  const notion = fakeNotion(
    [
      promptPage('p1', { name: '写口播 · Vtax', company: 'Vtax', shawn: '我改的', site: '旧', siteId: 'r1' }),
      promptPage('p2', { name: '写口播 · 王小墨', company: '王小墨', shawn: '', site: '', siteId: '' }),
    ],
    [agentPage('a1', 'Vtax', ['p1', 'p2'])],
  );
  const wActive: StoredPrompt = { ...vtaxActive, id: 'w9', org_id: 'w1', industry: 'data', body: '王' };
  const { store, saved } = fakeStore([vtaxActive, wActive]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Vtax', dryRun: true, yesGeneral: false });
  assert.deepEqual(out.items.map((i) => i.action), ['push', 'pull']);
  assert.equal(saved.length, 0);
  assert.equal(notion.updates.length, 0);
});

test('blocked takeover keeps shawn column', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · Vtax', company: 'Vtax', shawn: '我改的', site: '旧', siteId: 'r1' })],
    [agentPage('a1', 'Vtax', ['p1'])],
  );
  const client: StoredPrompt = { ...vtaxActive, id: 'r2', body: '客户版', created_by: 'zhou', created_at: '2026-10-24T00:00:00Z' };
  const { store, saved } = fakeStore([{ ...vtaxActive, status: 'inactive' }, client]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Vtax', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'blocked-takeover');
  assert.equal(saved.length, 0);
  const props = notion.updates[0].props;
  assert.equal(COL.shawn in props, false);
  assert.equal(textOf(props[COL.site]), '客户版');
  assert.ok((out.items[0].diff ?? []).length > 0);
  assert.equal(out.items[0].body, '客户版');
});

test('conflict writes nothing and shows diff', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · Vtax', company: 'Vtax', shawn: '我改的', site: '旧', siteId: 'r1' })],
    [agentPage('a1', 'Vtax', ['p1'])],
  );
  const mine: StoredPrompt = { ...vtaxActive, id: 'r2', body: '我在网站改的', created_by: 'shawn', created_at: '2026-10-24T00:00:00Z' };
  const { store, saved } = fakeStore([{ ...vtaxActive, status: 'inactive' }, mine]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Vtax', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'conflict');
  assert.equal(saved.length, 0);
  assert.equal(notion.updates.length, 0);
  assert.ok((out.items[0].diff ?? []).length > 0);
});

test('scope error does not stop others', async () => {
  const notion = fakeNotion([
    promptPage('p1', { name: '写口播 · vtax', company: 'vtax', shawn: 'x' }),
    promptPage('p2', { name: '写口播 · Vtax', company: 'Vtax', shawn: '旧', site: '旧', siteId: 'r1' }),
  ]);
  const { store } = fakeStore([vtaxActive]);
  const out = await runSync(deps(notion, store), { mode: 'pull', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'error');
  assert.match(out.items[0].note ?? '', /找不到公司/);
  assert.equal(out.items[1].action, 'pulled');
});

test('insert failure reported', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · Vtax', company: 'Vtax', shawn: '我改的', site: '旧', siteId: 'r1' })],
    [agentPage('a1', 'Vtax', ['p1'])],
  );
  const { store } = fakeStore([vtaxActive], { failSave: true });
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Vtax', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'error');
  assert.match(out.items[0].note ?? '', /没有启用的提示词/);
  assert.equal(notion.updates.length, 0);
});

test('unsynced rows skipped', async () => {
  const notion = fakeNotion(
    [
      promptPage('p1', { name: '做视频 · Vtax', step: '做视频', company: 'Vtax', sync: false }),
      promptPage('p2', { name: '写口播 · Vtax', company: 'Vtax', shawn: '旧', site: '旧', siteId: 'r1' }),
    ],
    [agentPage('a1', 'Vtax', ['p1', 'p2'])],
  );
  const { store } = fakeStore([vtaxActive]);
  const pull = await runSync(deps(notion, store), { mode: 'pull', dryRun: true, yesGeneral: false });
  assert.deepEqual(pull.items.map((i) => i.name), ['写口播 · Vtax']);
  const full = await runSync(deps(notion, store), { mode: 'full', agent: 'Vtax', dryRun: true, yesGeneral: false });
  assert.deepEqual(full.items.map((i) => i.name), ['写口播 · Vtax']);
});

test('draft without a site version hands the agent the notion draft', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写文章 · 王小墨', step: '写文章', industry: '数据', company: '王小墨', status: '草稿', shawn: '草稿全文' })],
    [agentPage('a1', '王小墨', ['p1'])],
  );
  const { store, saved } = fakeStore([]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: '王小墨', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'skip-draft');
  assert.equal(out.items[0].body, '草稿全文');
  assert.equal(out.items[0].activeId, null);
  assert.match(out.items[0].note ?? '', /Notion 里的草稿/);
  assert.equal(saved.length, 0);
});

test('site-only change after the daily pull is pulled, not reverted', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · 王小墨', company: '王小墨', shawn: 'A', site: 'A', siteId: 'r1' })],
    [agentPage('a1', '王小墨', ['p1'])],
  );
  const v1: StoredPrompt = { ...vtaxActive, id: 'r1', org_id: 'w1', industry: 'data', body: 'A', status: 'inactive' };
  const v2: StoredPrompt = { ...v1, id: 'r2', body: 'B', status: 'active', created_by: 'shawn', created_at: '2026-10-24T00:00:00Z' };
  const { store, saved } = fakeStore([v1, v2]);
  await runSync(deps(notion, store), { mode: 'pull', dryRun: false, yesGeneral: false });
  assert.equal(textOf(notion.updates[0].props[COL.site]), 'B');
  assert.equal(COL.siteId in notion.updates[0].props, false);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: '王小墨', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'pull');
  assert.equal(saved.length, 0);
  assert.equal(out.items[0].body, 'B');
});

test('draft row with a site version is not pushed and keeps the base', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · Vtax', company: 'Vtax', status: '草稿', shawn: '我改的', site: '旧', siteId: 'r1' })],
    [agentPage('a1', 'Vtax', ['p1'])],
  );
  const { store, saved } = fakeStore([vtaxActive]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Vtax', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'skip-draft');
  assert.equal(saved.length, 0);
  assert.equal(out.items[0].body, '旧');
  assert.equal(out.items[0].activeId, 'r1');
  const props = notion.updates[0]?.props ?? {};
  assert.equal(COL.siteId in props, false);
  assert.match(textOf(props[COL.note]), /网站现有版/);
});

test('disabled row without a site version gives the agent nothing', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写文章 · 王小墨', step: '写文章', company: '王小墨', status: '停用', shawn: '旧草稿' })],
    [agentPage('a1', '王小墨', ['p1'])],
  );
  const { store } = fakeStore([]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: '王小墨', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'skip-draft');
  assert.equal(out.items[0].body, null);
  assert.doesNotMatch(out.items[0].note ?? '', /草稿/);
});

test('needs-confirm carries a diff', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · 通用', industry: '通用', shawn: '新通用', site: '旧通用', siteId: 'g1' })],
    [agentPage('a1', 'Fordexa 公共稿', ['p1'])],
  );
  const general: StoredPrompt = { ...vtaxActive, id: 'g1', org_id: null, industry: null, body: '旧通用' };
  const { store } = fakeStore([general]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Fordexa 公共稿', dryRun: false, yesGeneral: false });
  assert.equal(out.items[0].action, 'needs-confirm');
  assert.ok((out.items[0].diff ?? []).some((d) => d.kind === 'add' && d.text === '新通用'));
});

test('yesGeneral as a list only confirms listed pages', async () => {
  const notion = fakeNotion(
    [
      promptPage('p1', { name: '写口播 · 通用', industry: '通用', shawn: '新通用', site: '旧通用', siteId: 'g1' }),
      promptPage('p2', { name: '写文章 · 数据', step: '写文章', industry: '数据', shawn: '新数据' }),
    ],
    [agentPage('a1', 'Fordexa 公共稿', ['p1', 'p2'])],
  );
  const general: StoredPrompt = { ...vtaxActive, id: 'g1', org_id: null, industry: null, body: '旧通用' };
  const { store, saved } = fakeStore([general]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Fordexa 公共稿', dryRun: false, yesGeneral: ['p1'] });
  assert.deepEqual(out.items.map((i) => i.action), ['push', 'needs-confirm']);
  assert.equal(saved.length, 1);
});

test('acceptNotion turns a conflict into a push', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · Vtax', company: 'Vtax', shawn: '我改的', site: '旧', siteId: 'r1' })],
    [agentPage('a1', 'Vtax', ['p1'])],
  );
  const mine: StoredPrompt = { ...vtaxActive, id: 'r2', body: '我在网站改的', created_by: 'shawn', created_at: '2026-10-24T00:00:00Z' };
  const { store, saved } = fakeStore([{ ...vtaxActive, status: 'inactive' }, mine]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Vtax', dryRun: false, yesGeneral: false, acceptNotion: ['p1'] });
  assert.equal(out.items[0].action, 'push');
  assert.equal(saved[0].body, '我改的');
});

test('acceptSite turns a conflict into a pull', async () => {
  const notion = fakeNotion(
    [promptPage('p1', { name: '写口播 · Vtax', company: 'Vtax', shawn: '我改的', site: '旧', siteId: 'r1' })],
    [agentPage('a1', 'Vtax', ['p1'])],
  );
  const mine: StoredPrompt = { ...vtaxActive, id: 'r2', body: '我在网站改的', created_by: 'shawn', created_at: '2026-10-24T00:00:00Z' };
  const { store, saved } = fakeStore([{ ...vtaxActive, status: 'inactive' }, mine]);
  const out = await runSync(deps(notion, store), { mode: 'full', agent: 'Vtax', dryRun: false, yesGeneral: false, acceptSite: ['p1'] });
  assert.equal(out.items[0].action, 'pull');
  assert.equal(saved.length, 0);
  assert.equal(textOf(notion.updates[0].props[COL.shawn]), '我在网站改的');
});

test('supabaseStore loads every prompt row past the 1000-row page', async () => {
  const rows = Array.from({ length: 1005 }, (_, i) => ({ ...vtaxActive, id: `r${i}`, status: i === 1004 ? 'active' : 'inactive' }));
  const result = (data: unknown) => ({ data, error: null });
  const db = {
    from: (table: string) => ({
      select: () => {
        if (table === 'organizations') return Promise.resolve(result([]));
        if (table === 'profiles') return { eq: () => Promise.resolve(result([])) };
        return {
          order: () => ({
            // 和 PostgREST 一样：一次最多回 1000 行
            range: (from: number, to: number) => Promise.resolve(result(rows.slice(from, Math.min(to + 1, from + 1000)))),
          }),
        };
      },
    }),
  } as unknown as Parameters<typeof supabaseStore>[0];
  const { prompts } = await supabaseStore(db).load();
  assert.equal(prompts.length, 1005);
  assert.equal(prompts.at(-1)?.id, 'r1004');
});

test('unknown agent throws', async () => {
  const notion = fakeNotion([], [agentPage('a1', 'Vtax', [])]);
  const { store } = fakeStore([]);
  await assert.rejects(runSync(deps(notion, store), { mode: 'full', agent: '谁', dryRun: true, yesGeneral: false }), /找不到启用的 agent「谁」/);
});
