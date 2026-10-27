import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articleProps, mergeNotionBody, normalizeScript, normKey, scriptHash, scriptProps, scriptToNotion } from './review-lib.mjs';

test('scriptHash 和网站一样：去掉首尾空白再算', () => {
  assert.equal(scriptHash('  一句话\n'), scriptHash('一句话'));
  assert.equal(scriptHash('一句话').length, 16);
});

test('normalizeScript 去行首尾空白，多个空行并成一个', () => {
  assert.equal(normalizeScript('  第一句 \n第二句\n\n\n\n 第三句\n'), '第一句\n第二句\n\n第三句');
});

test('scriptToNotion：段内换行变 <br>，段落一行一个', () => {
  assert.equal(scriptToNotion('第一句\n第二句\n\n第三句'), '第一句<br>第二句\n第三句');
});

test('mergeNotionBody 认 Notion 读出来的单换行分隔线', () => {
  assert.equal(mergeNotionBody('旧<br>稿\n---\n### 出处\n<table></table>', '新'), '新\n\n---\n\n### 出处\n<table></table>');
});

test('mergeNotionBody 换掉 --- 前面的稿子，出处表留着', () => {
  const old = '旧稿子\n\n---\n\n### 每个数字的出处\n\n| a | b |';
  assert.equal(mergeNotionBody(old, '新稿子'), '新稿子\n\n---\n\n### 每个数字的出处\n\n| a | b |');
  assert.equal(mergeNotionBody('', '新稿子'), '新稿子');
  assert.equal(mergeNotionBody('只有稿子', '新稿子'), '新稿子');
});

test('normKey 只收编号 / slug 的字符', () => {
  assert.equal(normKey(' FX-0028 '), 'fx-0028');
  assert.throws(() => normKey('fx-0028,code.eq.x'));
  assert.throws(() => normKey(''));
});

const row = {
  title: '华人区被撬被偷算多吗', code: 'FX-0029', slug: 'fx-0029', published_at: '2026-10-26T10:00:00Z',
  audio_url: 'https://x/a.mp3', summary: '两句话', industry: 'data', refs: [{ label: 'CSA', url: 'https://csa' }],
};

test('scriptProps：发布状态、编号、锚点链接、行业中文名', () => {
  const p = scriptProps({ row, articleSlug: 'fx-0028', articleNotion: 'n1', created: true });
  assert.equal(p.状态.select.name, '发布');
  assert.equal(p.网站链接.url, 'https://app.fordexa.com/ideas/fx-0028#fx-0029');
  assert.equal(p.行业.select.name, '数据');
  assert.equal(p.朗读.select.name, '已生成');
  assert.deepEqual(p.所属文章.relation, [{ id: 'n1' }]);
  assert.equal(p.来源.select.name, '管线起草');
  assert.equal(p.出处.rich_text[0].text.content, 'CSA｜https://csa');
});

test('scriptProps：已有页不改来源，没朗读写未生成', () => {
  const p = scriptProps({ row: { ...row, audio_url: null }, articleSlug: 'fx-0028', articleNotion: null, created: false });
  assert.equal(p.来源, undefined);
  assert.equal(p.所属文章, undefined);
  assert.equal(p.朗读.select.name, '未生成');
});

test('articleProps：新建才写摘要、出处、行业（多选）', () => {
  assert.equal(articleProps({ row, created: false }).摘要, undefined);
  const p = articleProps({ row, created: true });
  assert.deepEqual(p.行业.multi_select, [{ name: '数据' }]);
  assert.equal(p.网站链接.url, 'https://app.fordexa.com/ideas/fx-0029');
});
