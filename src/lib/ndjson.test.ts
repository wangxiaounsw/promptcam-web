import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNdjson } from './ndjson.ts';

test('complete lines become events, the unfinished line stays as rest', () => {
  const out = readNdjson('{"t":"delta","text":"你"}\n{"t":"delta","text":"好"}\n{"t":"do');
  assert.deepEqual(out.events, [{ t: 'delta', text: '你' }, { t: 'delta', text: '好' }]);
  assert.equal(out.rest, '{"t":"do');
});

test('blank lines are skipped and a broken line does not stop the rest', () => {
  const out = readNdjson('\n{"t":"a"}\nnot json\n{"t":"b"}\n');
  assert.deepEqual(out.events, [{ t: 'a' }, { t: 'b' }]);
  assert.equal(out.rest, '');
});
