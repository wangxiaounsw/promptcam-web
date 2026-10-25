import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { saveVersion } from './prompt-store.ts';

type Call = { op: string; args: unknown[] };

/** 只认 saveVersion 用到的链式调用；记下每一步，插入可设成失败 */
function fakeDb(insertError: string | null = null): { db: SupabaseClient; calls: Call[] } {
  const calls: Call[] = [];
  const chain = (result: unknown) => {
    const q: Record<string, unknown> = {};
    for (const op of ['eq', 'is', 'select', 'single']) {
      q[op] = (...args: unknown[]) => {
        calls.push({ op, args });
        return q;
      };
    }
    q.then = (resolve: (v: unknown) => void) => resolve(result);
    return q;
  };
  const db = {
    from: (table: string) => ({
      update: (v: unknown) => {
        calls.push({ op: 'update', args: [table, v] });
        return chain({ error: null });
      },
      insert: (v: unknown) => {
        calls.push({ op: 'insert', args: [table, v] });
        return chain(
          insertError
            ? { data: null, error: { message: insertError } }
            : { data: { id: 'new', body: (v as { body: string }).body, created_at: '2026-10-25T00:00:00Z' }, error: null },
        );
      },
    }),
  } as unknown as SupabaseClient;
  return { db, calls };
}

const v = { step: 'write_script' as const, orgId: 'v1', industry: 'accounting', name: '写口播 · Vtax', body: '正文', note: 'n', userId: 's' };

test('org scope: deactivates by org, then inserts active', async () => {
  const { db, calls } = fakeDb();
  const saved = await saveVersion(db, v);
  assert.equal(saved.id, 'new');
  const ops = calls.map((c) => c.op);
  assert.ok(ops.indexOf('update') < ops.indexOf('insert'));
  assert.ok(calls.some((c) => c.op === 'eq' && c.args[0] === 'org_id' && c.args[1] === 'v1'));
  const insert = calls.find((c) => c.op === 'insert')?.args[1] as Record<string, unknown>;
  assert.equal(insert.status, 'active');
  assert.equal(insert.created_by, 's');
});

test('general scope: deactivates by null org and null industry', async () => {
  const { db, calls } = fakeDb();
  await saveVersion(db, { ...v, orgId: null, industry: null });
  assert.ok(calls.some((c) => c.op === 'is' && c.args[0] === 'org_id'));
  assert.ok(calls.some((c) => c.op === 'is' && c.args[0] === 'industry'));
});

test('draft does not deactivate the active version', async () => {
  const { db, calls } = fakeDb();
  await saveVersion(db, { ...v, status: 'draft' });
  assert.equal(calls.filter((c) => c.op === 'update').length, 0);
  assert.equal((calls.find((c) => c.op === 'insert')?.args[1] as Record<string, unknown>).status, 'draft');
});

test('insert failure says the scope has no active prompt', async () => {
  const { db } = fakeDb('boom');
  await assert.rejects(saveVersion(db, v), /没有启用的提示词.*boom/);
});
