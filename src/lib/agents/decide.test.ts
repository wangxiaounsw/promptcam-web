import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideFull, isTakenOver, pullNote, type FullInput } from './decide.ts';

const base: FullInput = {
  shawn: 'a',
  base: 'a',
  siteId: 'r1',
  active: { id: 'r1', body: 'a' },
  takenOver: false,
  notionStatus: 'active',
};

test('case1 none', () => {
  assert.equal(decideFull({ ...base, base: 'a\n' }), 'none');
});

test('case2 site moved pulls', () => {
  assert.equal(decideFull({ ...base, active: { id: 'r2', body: 'b' } }), 'pull');
});

test('case3 shawn edited pushes', () => {
  assert.equal(decideFull({ ...base, shawn: 'a2' }), 'push');
});

test('case3 too long', () => {
  assert.equal(decideFull({ ...base, shawn: 'x'.repeat(8001) }), 'too-long');
});

test('case4 taken over blocks', () => {
  assert.equal(decideFull({ ...base, shawn: 'a2', takenOver: true }), 'blocked-takeover');
  assert.equal(decideFull({ ...base, shawn: 'a2', takenOver: true, active: { id: 'r2', body: 'c' } }), 'blocked-takeover');
});

test('case5 both moved conflict', () => {
  assert.equal(decideFull({ ...base, shawn: 'a2', active: { id: 'r2', body: 'b' } }), 'conflict');
});

test('empty shawn pulls', () => {
  assert.equal(decideFull({ ...base, shawn: '  ', base: '', siteId: null }), 'pull');
});

test('no active, enabled pushes', () => {
  assert.equal(decideFull({ ...base, base: '', siteId: null, active: null }), 'push');
});

test('no active, draft skips', () => {
  assert.equal(decideFull({ ...base, base: '', siteId: null, active: null, notionStatus: 'draft' }), 'skip-draft');
});

test('no active, empty shawn skips', () => {
  assert.equal(decideFull({ ...base, shawn: '', base: '', siteId: null, active: null }), 'skip-draft');
});

test('disabled never pushes', () => {
  assert.equal(decideFull({ ...base, shawn: 'a2', notionStatus: null }), 'skip-draft');
});

test('draft with an active version never pushes', () => {
  assert.equal(decideFull({ ...base, shawn: 'a2', notionStatus: 'draft' }), 'skip-draft');
});

test('takeover: null creator is admin', () => {
  assert.equal(isTakenOver([{ created_by: null, created_at: '2026-10-17T00:00:00Z' }], new Set(), null), false);
});

test('takeover: admin creator', () => {
  assert.equal(isTakenOver([{ created_by: 's', created_at: '2026-10-20T00:00:00Z' }], new Set(['s']), null), false);
});

test('takeover: client version', () => {
  assert.equal(isTakenOver([{ created_by: 'c1', created_at: '2026-10-20T00:00:00Z' }], new Set(['s']), null), true);
});

test('takeover: sticky after a later admin version', () => {
  const versions = [
    { created_by: 'c1', created_at: '2026-10-20T00:00:00Z' },
    { created_by: 's', created_at: '2026-10-22T00:00:00Z' },
  ];
  assert.equal(isTakenOver(versions, new Set(['s']), null), true);
});

test('takeover: released after client version', () => {
  const versions = [{ created_by: 'c1', created_at: '2026-10-20T00:00:00Z' }];
  assert.equal(isTakenOver(versions, new Set(['s']), '2026-10-21T00:00:00+11:00'), false);
  assert.equal(isTakenOver(versions, new Set(['s']), '2026-10-19T00:00:00+11:00'), true);
});

test('pullNote: in step', () => {
  assert.equal(pullNote({ ...base, base: 'a\n' }), null);
});

test('pullNote: shawn edited, not taken over', () => {
  assert.match(pullNote({ ...base, shawn: 'b' }) ?? '', /下次叫 agent 时会推/);
});

test('pullNote: client took over', () => {
  assert.match(pullNote({ ...base, shawn: 'b', takenOver: true, active: { id: 'r2', body: 'c' } }) ?? '', /客户已接手/);
});

test('pullNote: only the site moved', () => {
  assert.match(pullNote({ ...base, active: { id: 'r2', body: 'b' } }) ?? '', /网站上有新版本.*拉回/);
});

test('pullNote: both moved', () => {
  assert.match(pullNote({ ...base, shawn: 'x', active: { id: 'r2', body: 'b' } }) ?? '', /两边都改了/);
});

test('pullNote: draft without site version is not promised a push', () => {
  const note = pullNote({ ...base, shawn: '草稿', base: '', siteId: null, active: null, notionStatus: 'draft' }) ?? '';
  assert.doesNotMatch(note, /时会推/);
  assert.match(note, /草稿/);
});

test('pullNote: empty shawn', () => {
  assert.equal(pullNote({ ...base, shawn: '' }), null);
});
