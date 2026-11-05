import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSameSources, planUpload } from './library-upload-lib.mjs';

const cover = (code, file) => ({ code, kind: 'cover', file });
const video = (code, file, poster) => ({ code, kind: 'video', file, poster });

test('planUpload orders files before manifest before deletes', () => {
  const remote = [cover('K01', 'K01-old.jpg'), video('T05', 'T05-a.mp4', 'T05-a-poster.jpg')];
  const local = [cover('K01', 'K01-new.jpg'), cover('K02', 'K02-a.jpg')];
  const { steps } = planUpload(local, remote, ['K01-older.jpg', 'K02-a.jpg']);
  const mi = steps.findIndex((s) => s.op === 'put' && s.path === 'manifest.json');
  assert.ok(mi > 0);
  assert.ok(steps.slice(0, mi).every((s) => s.op === 'put'));
  assert.ok(steps.slice(mi + 1).every((s) => s.op === 'delete'));
  assert.deepEqual(steps.slice(mi + 1).map((s) => s.path), ['K01-older.jpg']);
});

test('planUpload keeps replaced files for one more upload (cached pages still point at them)', () => {
  const remote = [cover('K01', 'K01-old.jpg'), video('T05', 'T05-a.mp4', 'T05-a-poster.jpg')];
  const local = [cover('K01', 'K01-new.jpg')];
  const { steps, keep } = planUpload(local, remote, []);
  assert.ok(!steps.some((s) => s.op === 'delete'));
  assert.deepEqual(keep.sort(), ['K01-old.jpg', 'T05-a-poster.jpg', 'T05-a.mp4']);
});

test('planUpload skips unchanged files', () => {
  const both = [cover('K01', 'K01-same.jpg'), video('T01', 'T01-x.mp4', 'T01-x-poster.jpg')];
  const { steps, added, replaced, retired } = planUpload(both, both);
  assert.deepEqual(steps, [{ op: 'put', path: 'manifest.json' }]);
  assert.deepEqual(planUpload(both, both, ['gone.jpg']).steps.at(-1), { op: 'delete', path: 'gone.jpg' });
  assert.deepEqual([added, replaced, retired], [[], [], []]);
});

test('planUpload reports added, replaced and retired codes', () => {
  const remote = [cover('K01', 'K01-old.jpg'), video('T05', 'T05-a.mp4', 'T05-a-poster.jpg')];
  const local = [cover('K01', 'K01-new.jpg'), cover('K02', 'K02-a.jpg')];
  const r = planUpload(local, remote);
  assert.deepEqual(r.added, ['K02']);
  assert.deepEqual(r.replaced, ['K01']);
  assert.deepEqual(r.retired, ['T05']);
});

test('planUpload first upload', () => {
  const local = [cover('K01', 'K01-a.jpg'), video('T01', 'T01-b.mp4', 'T01-b-poster.jpg')];
  const { steps, added } = planUpload(local, null);
  assert.deepEqual(steps.map((s) => s.path), ['K01-a.jpg', 'T01-b.mp4', 'T01-b-poster.jpg', 'manifest.json']);
  assert.ok(steps.every((s) => s.op === 'put'));
  assert.deepEqual(added, ['K01', 'T01']);
});

test('planUpload never deletes a file the new manifest still uses', () => {
  // T01 was renamed onto a file K01 used before (hash collision is impossible in practice, but the rule must hold)
  const remote = [cover('K01', 'shared.jpg')];
  const local = [cover('K02', 'shared.jpg')];
  const { steps } = planUpload(local, remote);
  assert.ok(!steps.some((s) => s.op === 'delete' && s.path === 'shared.jpg'));
});

const m = (items, retired = []) => ({ items, retired });
const src = (code, source) => ({ code, kind: 'cover', file: `${code}.jpg`, source });

test('assertSameSources refuses a code that changed meaning against the bucket', () => {
  assert.throws(() => assertSameSources(m([src('K01', 'kit:b')]), m([src('K01', 'kit:a')])), /K01/);
});

test('assertSameSources refuses bringing back a retired code', () => {
  assert.throws(() => assertSameSources(m([src('K05', 'kit:a')]), m([], [{ code: 'K05', source: 'kit:a' }])), /K05/);
});

test('assertSameSources refuses a live code that vanished without being retired', () => {
  assert.throws(() => assertSameSources(m([]), m([src('K01', 'kit:a')])), /K01/);
});

test('assertSameSources allows same sources, new codes, retiring, and a first upload', () => {
  assertSameSources(m([src('K01', 'kit:a'), src('K02', 'kit:new')]), m([src('K01', 'kit:a')]));
  assertSameSources(m([], [{ code: 'K01', source: 'kit:a' }]), m([src('K01', 'kit:a')]));
  assertSameSources(m([src('K01', 'kit:a')]), null);
});
