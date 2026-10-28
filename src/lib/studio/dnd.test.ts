import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropPatch } from './dnd.ts';

test('dropPatch: draft onto a day schedules it', () =>
  assert.deepEqual(dropPatch({ day: '2026-11-03' }, { stage: 'draft', publishOn: null }).value, { publish_on: '2026-11-03' }));
test('dropPatch: calendar item back to rail clears the date', () =>
  assert.deepEqual(dropPatch('rail', { stage: 'final', publishOn: '2026-11-03' }).value, { publish_on: null }));
test('dropPatch: published cannot move or go back', () => {
  assert.equal(dropPatch('rail', { stage: 'published', publishOn: '2026-11-03' }).error, '已发布的不能改日期');
  assert.equal(dropPatch({ day: '2026-11-04' }, { stage: 'published', publishOn: '2026-11-03' }).error, '已发布的不能改日期');
});
test('dropPatch: dropping on the same day is a no-op error', () =>
  assert.equal(dropPatch({ day: '2026-11-03' }, { stage: 'final', publishOn: '2026-11-03' }).error, ''));
test('dropPatch: draft dropped on the rail is a no-op', () =>
  assert.equal(dropPatch('rail', { stage: 'draft', publishOn: null }).error, ''));
test('dropPatch: calendar item to another day moves it', () =>
  assert.deepEqual(dropPatch({ day: '2026-11-04' }, { stage: 'final', publishOn: '2026-11-03' }).value, { publish_on: '2026-11-04' }));
