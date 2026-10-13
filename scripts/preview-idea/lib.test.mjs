import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDoc, parseRef, scriptParas, scriptStats } from './lib.mjs';

test('parseDoc reads scalars, inline lists and dash lists, and returns the body', () => {
  const src = [
    '---',
    'title: 预缴税是多交的吗',
    'tags: [报税, ATO]',
    'refs:',
    '  - ATO：PAYG instalments｜https://www.ato.gov.au/x',
    '  - 只有名称',
    '---',
    '',
    '正文第一段',
  ].join('\n');
  const { meta, body } = parseDoc(src);
  assert.equal(meta.title, '预缴税是多交的吗');
  assert.deepEqual(meta.tags, ['报税', 'ATO']);
  assert.deepEqual(meta.refs, ['ATO：PAYG instalments｜https://www.ato.gov.au/x', '只有名称']);
  assert.equal(body.trim(), '正文第一段');
});

test('parseDoc without frontmatter keeps everything as body', () => {
  assert.deepEqual(parseDoc('只有正文'), { meta: {}, body: '只有正文' });
});

test('parseRef splits 名称｜网址 the same way the Notion 出处 field is written', () => {
  assert.deepEqual(parseRef('ATO｜https://a.b'), { label: 'ATO', url: 'https://a.b' });
  assert.deepEqual(parseRef('https://a.b'), { label: 'https://a.b', url: 'https://a.b' });
  assert.deepEqual(parseRef('只有名称'), { label: '只有名称', url: '' });
});

test('scriptParas splits on blank lines like ScriptBody.tsx', () => {
  assert.deepEqual(scriptParas('一\n二\n\n\n三\n'), ['一\n二', '三']);
});

test('scriptStats counts non-space characters and rounds reading time like ScriptBody.tsx', () => {
  assert.deepEqual(scriptStats('一二三'), { chars: 3, length: '约 10 秒' });
  assert.deepEqual(scriptStats('字'.repeat(345)), { chars: 345, length: '约 1 分 30 秒' });
  assert.deepEqual(scriptStats('字'.repeat(240)), { chars: 240, length: '约 1 分钟' });
});
