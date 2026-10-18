import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSse } from './sse.ts';

const ev = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

test('pulls content deltas out of complete events and keeps the unfinished tail', () => {
  const out = readSse(ev('你好') + ev('，世界') + 'data: {"choi');
  assert.deepEqual(out.deltas, ['你好', '，世界']);
  assert.equal(out.rest, 'data: {"choi');
  assert.equal(out.done, false);
});

test('[DONE] ends the stream', () => {
  const out = readSse(ev('末') + 'data: [DONE]\n\n');
  assert.deepEqual(out.deltas, ['末']);
  assert.equal(out.done, true);
});

test('keep-alive comments, empty deltas and finish_reason are reported', () => {
  const finish = `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'length' }] })}\n\n`;
  const out = readSse(': keep-alive\n\n' + ev('') + finish);
  assert.deepEqual(out.deltas, []);
  assert.equal(out.finishReason, 'length');
});

test('CRLF separated events work too', () => {
  assert.deepEqual(readSse(ev('a').replace(/\n/g, '\r\n')).deltas, ['a']);
});
