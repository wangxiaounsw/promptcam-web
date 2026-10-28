import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coverPathAllowed, cleanWeekdays, countSeries, toCalendarPost, toDraftItem, validateLeadDays, validateNewPost, validateSeriesBody, validDay,
  type PostRow,
} from './posts-map.ts';

const row = (o: Partial<PostRow> = {}): PostRow => ({
  id: 'p1', org_id: 'o1', title: 't', body: '正文', status: 'ready', code: null, record_by: '2026-10-29',
  publish_on: '2026-11-03', stage: 'draft', kind: 'video', is_extra: false, series: '安全卷', episode: 3,
  media_url: null, cover_path: null, xhs_title: '', xhs_body: '', xhs_tags: null,
  published_url: null, published_at: null, likes: null, saves: null, comments: null, stats_at: null,
  last_note_at: null, last_note_by_admin: null, admin_seen_at: null, client_seen_at: null,
  updated_at: 'y', ...o,
});

test('toCalendarPost: maps columns, null tags -> [], series total, unread by viewer', () => {
  const r = row({ last_note_at: '2026-11-01T00:00:00Z', last_note_by_admin: false });
  const totals = countSeries([{ series: '安全卷' }, { series: '安全卷' }, { series: null }]);
  const asAdmin = toCalendarPost(r, 'u', totals, true);
  assert.equal(asAdmin.seriesTotal, 2);
  assert.deepEqual(asAdmin.xhsTags, []);
  assert.equal(asAdmin.coverUrl, 'u');
  assert.equal(asAdmin.unread, true);
  assert.equal(toCalendarPost(r, null, totals, false).unread, false);
  assert.equal(toCalendarPost(row({ series: null }), null, totals, true).seriesTotal, null);
});

test('toCalendarPost: carries script fields (body, recordBy, status, code)', () => {
  const p = toCalendarPost(row({ code: 'A1', status: 'recorded' }), null, new Map(), false);
  assert.equal(p.body, '正文');
  assert.equal(p.recordBy, '2026-10-29');
  assert.equal(p.status, 'recorded');
  assert.equal(p.code, 'A1');
  assert.equal(toCalendarPost(row({ record_by: null }), null, new Map(), false).recordBy, null);
});

test('toDraftItem: keeps only the sidebar fields', () => {
  assert.deepEqual(toDraftItem({ id: 'd', title: 'x', kind: 'image', stage: 'refining', updated_at: 'u' }), {
    id: 'd', title: 'x', kind: 'image', stage: 'refining', updatedAt: 'u',
  });
});

test('validateLeadDays: 0..30 integers only', () => {
  const msg = '提前天数要在 0 到 30 之间';
  assert.equal(validateLeadDays(5).value, 5);
  assert.equal(validateLeadDays(0).value, 0);
  assert.equal(validateLeadDays(30).value, 30);
  assert.equal(validateLeadDays(31).error, msg);
  assert.equal(validateLeadDays(-1).error, msg);
  assert.equal(validateLeadDays(2.5).error, msg);
  assert.equal(validateLeadDays('5').error, msg);
  assert.equal(validateLeadDays(null).error, msg);
});

test('validDay: rejects impossible dates and bad shapes', () => {
  assert.ok(validDay('2026-11-02'));
  assert.ok(!validDay('2026-02-30'));
  assert.ok(!validDay('2026-1-2'));
  assert.ok(!validDay(20261102));
});

test('cleanWeekdays: keeps integers 1-7, dedupes, sorts', () => {
  assert.deepEqual(cleanWeekdays([5, 2, 2, 0, 8, 1.5, '3', null]), [2, 5]);
  assert.deepEqual(cleanWeekdays('x'), []);
});

test('validateNewPost: happy path and each rejection', () => {
  const base = { title: ' 标题 ', kind: 'image', publishOn: '2026-11-03', isExtra: true, series: ' 安全卷 ', episode: 2 };
  assert.deepEqual(validateNewPost(base).value, {
    title: '标题', kind: 'image', publish_on: '2026-11-03', is_extra: true, series: '安全卷', episode: 2,
  });
  assert.deepEqual(validateNewPost({ title: 'a', kind: 'video', publishOn: null }).value, {
    title: 'a', kind: 'video', publish_on: null, is_extra: false, series: null, episode: null,
  });
  assert.ok(validateNewPost({ ...base, title: '  ' }).error);
  assert.ok(validateNewPost({ ...base, title: '字'.repeat(41) }).error);
  assert.equal(validateNewPost({ ...base, title: '字'.repeat(40) }).error, null);
  assert.ok(validateNewPost({ ...base, kind: 'audio' }).error);
  assert.ok(validateNewPost({ ...base, publishOn: '2026-13-01' }).error);
  assert.ok(validateNewPost({ ...base, isExtra: 'yes' }).error);
  assert.ok(validateNewPost({ ...base, series: '系'.repeat(21) }).error);
  assert.ok(validateNewPost({ ...base, episode: 0 }).error);
  assert.ok(validateNewPost({ ...base, episode: 1.5 }).error);
});

test('validateSeriesBody: empty weekdays and bad start are rejected with the agreed messages', () => {
  const base = { series: '安全卷', lines: '一\n二', start: '2026-11-02', weekdays: [5, 2, 2], dryRun: true };
  assert.deepEqual(validateSeriesBody(base).value, {
    series: '安全卷', lines: '一\n二', start: '2026-11-02', weekdays: [2, 5], dryRun: true,
  });
  assert.equal(validateSeriesBody({ ...base, weekdays: [] }).error, '先选发在星期几');
  assert.equal(validateSeriesBody({ ...base, weekdays: [0, 9] }).error, '先选发在星期几');
  assert.ok(validateSeriesBody({ ...base, start: '2026-11-31' }).error);
  assert.ok(validateSeriesBody({ ...base, series: ' ' }).error);
  assert.equal(validateSeriesBody({ ...base, dryRun: 'true' }).value?.dryRun, false);
});

test('coverPathAllowed: only this org and this post folder, no traversal', () => {
  assert.equal(coverPathAllowed('posts/o1/p1/cover.jpg', 'o1', 'p1'), true);
  assert.equal(coverPathAllowed('posts/o2/p1/cover.jpg', 'o1', 'p1'), false);
  assert.equal(coverPathAllowed('posts/o1/p2/cover.jpg', 'o1', 'p1'), false);
  assert.equal(coverPathAllowed('scripts/o1/p1/a.mp3', 'o1', 'p1'), false);
  assert.equal(coverPathAllowed('posts/o1/p1/../../o2/p9/x.jpg', 'o1', 'p1'), false);
  assert.equal(coverPathAllowed('posts/o1/p1/..', 'o1', 'p1'), false);
  assert.equal(coverPathAllowed('posts/o1/p1/', 'o1', 'p1'), false);
  assert.equal(coverPathAllowed('', 'o1', 'p1'), false);
});
