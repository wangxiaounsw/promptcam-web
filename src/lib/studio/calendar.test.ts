import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueWarning, recordByFor, recordWarning, isoWeekday, monthGrid, shiftMonth, spreadDays, stockUntil, type StockItem } from './calendar.ts';
import { melbourneDay } from './week.ts';

test('monthGrid: 2026-11 starts on Mon 26 Oct and has 6 rows (30 Nov is a Monday)', () => {
  const g = monthGrid('2026-11');
  assert.equal(g[0][0], '2026-10-26');
  assert.equal(g.length, 6);
  assert.equal(g[4][6], '2026-11-29');
  assert.equal(g[5][0], '2026-11-30');
  assert.equal(g[5][6], '2026-12-06');
});
test('monthGrid: 2026-02 (starts on Sunday) begins Mon 26 Jan', () => assert.equal(monthGrid('2026-02')[0][0], '2026-01-26'));
test('shiftMonth: across a year boundary', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
test('isoWeekday: 2026-11-03 is a Tuesday', () => assert.equal(isoWeekday('2026-11-03'), 2));
test('spreadDays: Tue/Fri from Mon 2026-10-26 skips taken days and crosses into November', () => {
  assert.deepEqual(
    spreadDays({ start: '2026-10-26', weekdays: [2, 5], count: 4, taken: new Set(['2026-10-30']) }),
    ['2026-10-27', '2026-11-03', '2026-11-06', '2026-11-10'],
  );
});
test('spreadDays: start day itself counts when it is a publish weekday', () =>
  assert.deepEqual(spreadDays({ start: '2026-11-03', weekdays: [2], count: 1, taken: new Set() }), ['2026-11-03']));
test('spreadDays: crosses the DST change on 2026-10-04 without slipping a day', () =>
  assert.deepEqual(spreadDays({ start: '2026-10-01', weekdays: [1], count: 2, taken: new Set() }), ['2026-10-05', '2026-10-12']));
test('spreadDays: no weekdays → empty', () => assert.deepEqual(spreadDays({ start: '2026-11-01', weekdays: [], count: 3, taken: new Set() }), []));
test('stockUntil: stops before the first not-ready item, ignoring past, extra and unscheduled', () => {
  const items: StockItem[] = [
    { publishOn: '2026-10-27', isExtra: false, stage: 'draft' }, // 今天之前，不算
    { publishOn: '2026-11-03', isExtra: false, stage: 'cut' },
    { publishOn: '2026-11-05', isExtra: true, stage: 'draft' },  // 热点，不算
    { publishOn: '2026-11-06', isExtra: false, stage: 'published' },
    { publishOn: '2026-11-10', isExtra: false, stage: 'recorded' },
    { publishOn: '2026-11-13', isExtra: false, stage: 'cut' },
    { publishOn: null, isExtra: false, stage: 'draft' },
  ];
  assert.equal(stockUntil(items, '2026-10-28'), '2026-11-06');
});
test('stockUntil: two posts on one day, one not ready → stops at the previous day', () => {
  assert.equal(stockUntil([
    { publishOn: '2026-11-03', isExtra: false, stage: 'cut' },
    { publishOn: '2026-11-06', isExtra: false, stage: 'cut' },
    { publishOn: '2026-11-06', isExtra: false, stage: 'refining' },
  ], '2026-11-01'), '2026-11-03');
});
test('stockUntil: first item not ready → null', () =>
  assert.equal(stockUntil([{ publishOn: '2026-11-03', isExtra: false, stage: 'recorded' }], '2026-11-01'), null));
test('dueWarning: 3 days out and not ready → short 3; 4 days → null; ready → null', () => {
  assert.deepEqual(dueWarning({ publishOn: '2026-11-03', stage: 'recorded' }, '2026-10-31'), { kind: 'short', days: 3 });
  assert.equal(dueWarning({ publishOn: '2026-11-04', stage: 'recorded' }, '2026-10-31'), null);
  assert.equal(dueWarning({ publishOn: '2026-11-03', stage: 'cut' }, '2026-10-31'), null);
});
test('dueWarning: same day → short 0; past and not published → overdue (even if ready)', () => {
  assert.deepEqual(dueWarning({ publishOn: '2026-11-03', stage: 'recorded' }, '2026-11-03'), { kind: 'short', days: 0 });
  assert.deepEqual(dueWarning({ publishOn: '2026-11-03', stage: 'cut' }, '2026-11-04'), { kind: 'overdue' });
  assert.equal(dueWarning({ publishOn: '2026-11-03', stage: 'published' }, '2026-11-04'), null);
});
test('Melbourne today: Mon 14:30 UTC in daylight saving counts as Tuesday', () =>
  assert.equal(melbourneDay(new Date('2026-11-02T14:30:00Z')), '2026-11-03'));

test('WEEKDAY_NAMES: 周一到周日', async () => {
  const { WEEKDAY_NAMES } = await import('./calendar.ts');
  assert.deepEqual([...WEEKDAY_NAMES], ['一', '二', '三', '四', '五', '六', '日']);
});

test('recordByFor: 5 days before, crosses month; image → null; no date → null', () => {
  assert.equal(recordByFor('2026-11-03', 5, 'video'), '2026-10-29');
  assert.equal(recordByFor('2026-11-03', 5, 'image'), null);
  assert.equal(recordByFor(null, 5, 'video'), null);
});
test('recordByFor: across the DST change (2026-10-04) still exact days', () =>
  assert.equal(recordByFor('2026-10-06', 5, 'video'), '2026-10-01'));
test('recordWarning: final video past record_by warns; recorded or image does not', () => {
  assert.equal(recordWarning({ kind: 'video', stage: 'final', recordBy: '2026-10-29' }, '2026-10-30'), true);
  assert.equal(recordWarning({ kind: 'video', stage: 'recorded', recordBy: '2026-10-29' }, '2026-10-30'), false);
  assert.equal(recordWarning({ kind: 'video', stage: 'final', recordBy: '2026-10-30' }, '2026-10-30'), false);
  assert.equal(recordWarning({ kind: 'image', stage: 'final', recordBy: '2026-10-29' }, '2026-10-30'), false);
  assert.equal(recordWarning({ kind: 'video', stage: 'final', recordBy: null }, '2026-10-30'), false);
});
