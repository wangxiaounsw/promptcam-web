import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromRichText, normalize, toRichText } from './rich-text.ts';

test('round-trips 4500 chars', () => {
  const s = '口'.repeat(4500);
  const rt = toRichText(s);
  assert.equal(rt.length, 3);
  assert.ok(rt.every((r) => r.text.content.length <= 2000));
  assert.equal(fromRichText(rt.map((r) => ({ plain_text: r.text.content }))), s);
});

test('does not split a surrogate pair', () => {
  const s = 'a'.repeat(1999) + '😀' + 'b';
  const rt = toRichText(s);
  assert.ok(rt.every((r) => r.text.content.length <= 2000));
  assert.ok(!rt[0].text.content.endsWith('\ud83d'));
  assert.equal(rt.map((r) => r.text.content).join(''), s);
});

test('joins segments', () => {
  assert.equal(fromRichText([{ plain_text: '你' }, { plain_text: '**好**' }]), '你**好**');
});

test('empty', () => {
  assert.deepEqual(toRichText(''), []);
  assert.equal(fromRichText([]), '');
  assert.equal(fromRichText(undefined), '');
});

test('normalize', () => {
  assert.equal(normalize('  a\r\nb \n'), 'a\nb');
  assert.equal(normalize('a\r\nb'), normalize('a\nb\n'));
});
