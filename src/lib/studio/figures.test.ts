import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFigures, normalizeFigure, unsupportedFigures } from './figures.ts';

test('1.2 万 in the script matches 12,000 in the article', () => {
  assert.deepEqual(unsupportedFigures('按去年 1.2 万的收入算', '应税投资收入 12,000 澳币'), []);
});

test('Chinese numerals 一万二 match 12,000', () => {
  assert.deepEqual(unsupportedFigures('大概一万二', '12,000'), []);
});

test('15% matches 百分之十五', () => {
  assert.deepEqual(unsupportedFigures('税率 15%', '税率为百分之十五'), []);
});

test('3 个月 is flagged when the article only says 30 天', () => {
  assert.deepEqual(unsupportedFigures('等 3 个月再交', '一般需要 30 天'), ['3 个月']);
});

test('a year matches when the article has the full date', () => {
  assert.deepEqual(unsupportedFigures('2025年起', '自 2025 年 7 月 1 日起'), []);
});

test('一个人 / 一下 are not figures', () => {
  assert.deepEqual(unsupportedFigures('一个人去办一下', ''), []);
});

test('extractFigures keeps the original text, including $ and full-width digits', () => {
  const found = extractFigures('$1,500 和 ２０ 天');
  assert.ok(found.includes('$1,500'), JSON.stringify(found));
  assert.ok(found.includes('２０ 天'), JSON.stringify(found));
});

test('a bare amount not in the article is flagged', () => {
  assert.deepEqual(unsupportedFigures('最多可以抵 5000 元', '可以抵扣部分费用'), ['5000 元']);
});

test('normalizeFigure gives the same key for equivalent writings', () => {
  assert.equal(normalizeFigure('1.2万'), normalizeFigure('12,000'));
  assert.equal(normalizeFigure('15%'), normalizeFigure('百分之十五'));
  assert.equal(normalizeFigure('三个月'), normalizeFigure('3 个月'));
  assert.equal(normalizeFigure('一下'), null);
});

test('common words built from numerals (十分, 千万, 万一) are not figures', () => {
  assert.deepEqual(unsupportedFigures('这点十分重要，千万别拖，万一被罚', ''), []);
});

test('spoken mixed form 50 万 9000 matches 509,000', () => {
  assert.deepEqual(unsupportedFigures('中国大陆出生的 50 万 9000，印度的 44 万 9000', '509,000 and 449,000'), []);
});

test('a Chinese comma after a number is not part of the number', () => {
  assert.deepEqual(unsupportedFigures('有 1000，还有 2000。', '1000 和 2000'), []);
  assert.deepEqual(extractFigures('有 1000，还有 2000。'), ['1000', '2000']);
});

test('那一年 / 这一年 are not figures', () => {
  assert.deepEqual(unsupportedFigures('那一年印度第一次超过中国，这一年变化最大', ''), []);
});

test('spoken form 97 万 1 千 matches 97.1 万 / 971,000', () => {
  assert.deepEqual(unsupportedFigures('印度出生的 97 万 1 千人，中国大陆 73 万 2 千', '印度 97.1 万、中国大陆 732,000'), []);
});
