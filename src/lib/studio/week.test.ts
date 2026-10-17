import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayLabel, daysBetween, groupWeek, melbourneDay, shiftWeek, weekLabel, weekOf, type WeekItem } from './week.ts';

test('melbourneDay: Sunday 14:30 UTC in daylight saving is Monday in Melbourne', () => {
  assert.equal(melbourneDay(new Date('2026-10-18T14:30:00Z')), '2026-10-19');
});

test('melbourneDay: 23:59 in winter (+10) stays on the same day', () => {
  assert.equal(melbourneDay(new Date('2026-06-30T13:59:00Z')), '2026-06-30');
});

test('weekOf: a Saturday belongs to the week starting the Monday before', () => {
  const w = weekOf('2026-10-17');
  assert.equal(w.start, '2026-10-12');
  assert.equal(w.end, '2026-10-18');
  assert.equal(w.days.length, 7);
  assert.deepEqual(w.days.slice(0, 2), ['2026-10-12', '2026-10-13']);
});

test('weekOf: Sunday is the last day of its week', () => {
  assert.equal(weekOf('2026-10-18').start, '2026-10-12');
});

test('shiftWeek: one week forward lands in the week of 19 October', () => {
  assert.equal(weekOf(shiftWeek('2026-10-17', 1)).start, '2026-10-19');
  assert.equal(weekOf(shiftWeek('2026-10-17', -1)).start, '2026-10-05');
});

test('groupWeek: overdue first, per-day ready before recorded, archived ignored', () => {
  const items: WeekItem[] = [
    { id: 'A', record_by: '2026-10-13', status: 'ready' },
    { id: 'B', record_by: '2026-10-17', status: 'ready' },
    { id: 'C', record_by: '2026-10-17', status: 'recorded' },
    { id: 'D', record_by: null, status: 'ready' },
    { id: 'E', record_by: '2026-10-17', status: 'archived' },
    { id: 'F', record_by: '2026-10-01', status: 'ready' },
  ];
  const g = groupWeek(items, '2026-10-17', '2026-10-12');
  const ids = (xs: WeekItem[]) => xs.map((x) => x.id);
  assert.deepEqual(ids(g.overdue), ['F', 'A']);
  assert.deepEqual(ids(g.days['2026-10-17']), ['B', 'C']);
  assert.deepEqual(ids(g.unscheduled), ['D']);
  assert.equal(g.next?.id, 'F');
  const all = [...g.overdue, ...g.unscheduled, ...Object.values(g.days).flat()];
  assert.ok(!all.some((x) => x.id === 'E'));
  // 过期的不再重复出现在它那天
  assert.ok(!ids(g.days['2026-10-13']).includes('A'));
});

test('groupWeek: next is the earliest ready from today when nothing is overdue', () => {
  const g = groupWeek(
    [
      { id: 'X', record_by: '2026-10-19', status: 'ready' },
      { id: 'Y', record_by: '2026-10-17', status: 'ready' },
      { id: 'Z', record_by: '2026-10-17', status: 'recorded' },
    ],
    '2026-10-17',
    '2026-10-12',
  );
  assert.equal(g.next?.id, 'Y');
});

test('groupWeek: next is null when there is nothing left to record', () => {
  assert.equal(groupWeek([], '2026-10-17', '2026-10-12').next, null);
});

test('dayLabel names today and tomorrow, otherwise weekday + date', () => {
  assert.equal(dayLabel('2026-10-17', '2026-10-17'), '今天 · 周六');
  assert.equal(dayLabel('2026-10-18', '2026-10-17'), '明天 · 周日');
  assert.equal(dayLabel('2026-10-20', '2026-10-17'), '周二 · 10月20日');
});

test('weekLabel spans months when the week does', () => {
  assert.equal(weekLabel('2026-10-12'), '10月12日 – 18日');
  assert.equal(weekLabel('2026-10-26'), '10月26日 – 11月1日');
});

test('daysBetween counts whole days, overdue is positive', () => {
  assert.equal(daysBetween('2026-10-13', '2026-10-17'), 4);
  assert.equal(daysBetween('2026-10-17', '2026-10-17'), 0);
});
