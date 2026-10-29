import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normText, parseFacts, searchSnippets } from './facts-lib.mjs';

const MD = `# 工作底稿 · 电费
调研日期：2026-10-29

⚠️ 核心说法缺官方依据：季度账单

## 事实表
按重要程度排。

### 1. 维州 VDO 2026-27 年账单 $1,591，降 5%
- 英文原句：「Average annual bill will be five per cent lower for domestic customers.」；ESC 新闻稿表格值：「Victorian average 2025–26 $1,675 … 2026–27 $1,591」
- 出处：Essential Services Commission：VDO price review https://www.esc.vic.gov.au/vdo ；新闻稿 https://www.esc.vic.gov.au/media
- 发布日期 / 所属期间：25 May 2026
- 核实日期：2026-10-29
- 关键：是

### 2. 电费 CPI 一年涨 12.8%
- 英文原句：表格值：Table 7, Electricity, Sep 2026 = 12.8
- 英文原句：「Electricity prices rose 12.8% in the 12 months to September.」
- 出处：ABS：Monthly CPI Indicator https://www.abs.gov.au/cpi
- 发布日期 / 所属期间：28 Oct 2026
- 关键：否

## 时效
- 下一期 11/25

## 【缺】清单
- 季度账单的官方数字
- 各零售商的实际套餐价
`;

test('parseFacts：标题、⚠️、事实、【缺】都拿到', () => {
  const r = parseFacts(MD);
  assert.equal(r.title, '电费');
  assert.deepEqual(r.warnings, ['核心说法缺官方依据：季度账单']);
  assert.equal(r.facts.length, 2);
  assert.deepEqual(r.missing, ['季度账单的官方数字', '各零售商的实际套餐价']);
});

test('parseFacts：一条事实的原句、出处链接、日期、关键', () => {
  const [f1, f2] = parseFacts(MD).facts;
  assert.equal(f1.n, 1);
  assert.equal(f1.claim, '维州 VDO 2026-27 年账单 $1,591，降 5%');
  assert.deepEqual(f1.urls, ['https://www.esc.vic.gov.au/vdo', 'https://www.esc.vic.gov.au/media']);
  assert.equal(f1.published, '25 May 2026');
  assert.equal(f1.key, true);
  assert.equal(f2.key, false);
  // 原句可以有好几行，全部保留原文给人看
  assert.equal(f2.quote.split('\n').length, 2);
});

test('parseFacts：只有正文原句拿去截图，表格值不算', () => {
  const [f1, f2] = parseFacts(MD).facts;
  assert.deepEqual(f1.prose, ['Average annual bill will be five per cent lower for domestic customers.']);
  assert.deepEqual(f2.prose, ['Electricity prices rose 12.8% in the 12 months to September.']);
  assert.equal(f2.hasTable, true);
});

test('parseFacts：链接末尾的标点和括号不算进去', () => {
  const md = '## 事实表\n### 1. x\n- 英文原句：「A long enough sentence here.」\n- 出处：ABS（https://www.abs.gov.au/a）。https://www.abs.gov.au/b，\n- 关键：是\n';
  assert.deepEqual(parseFacts(md).facts[0].urls, ['https://www.abs.gov.au/a', 'https://www.abs.gov.au/b']);
});

test('parseFacts：【缺】清单用 1. 2. 编号也认', () => {
  const md = '## 事实表\n### 1. x\n- 关键：是\n## 【缺】清单\n1. 议价窗口\n2. RPPI 原句\n';
  assert.deepEqual(parseFacts(md).missing, ['议价窗口', 'RPPI 原句']);
});

test('parseFacts：出处写「同第 N 条」「同上」「同 N」的，沿用那条的链接并注明', () => {
  const md = [
    '## 事实表',
    '### 1. a', '- 出处：ABS https://www.abs.gov.au/one', '- 关键：是',
    '### 2. b', '- 出处：同第 1 条，分州小节', '- 关键：是',
    '### 3. c', '- 出处：ESC https://www.esc.vic.gov.au/two', '- 关键：是',
    '### 4. d', '- 出处：ESC 新闻稿同上，表「Residential」行', '- 关键：是',
    '### 5. e', '- 出处：同 1；表格值：Table 1', '- 关键：是',
    '### 6. f', '- 出处：ABS latest-release 页面', '- 关键：否',
  ].join('\n');
  const f = parseFacts(md).facts;
  assert.deepEqual(f[1].urls, ['https://www.abs.gov.au/one']);
  assert.equal(f[1].urlsFrom, 1);
  assert.deepEqual(f[3].urls, ['https://www.esc.vic.gov.au/two']);
  assert.equal(f[3].urlsFrom, 3);
  assert.deepEqual(f[4].urls, ['https://www.abs.gov.au/one']);
  // 没写链接、也没说同哪条的，不猜
  assert.deepEqual(f[5].urls, []);
  assert.equal(f[5].urlsFrom, undefined);
  assert.equal(f[0].urlsFrom, undefined);
});

test('normText：弯引号、破折号、空白都归一', () => {
  assert.equal(normText('We’ll  process\n“it” – now'), "We'll process \"it\" - now");
});

test('searchSnippets：省略号切开，取够长的片段，长的在前', () => {
  assert.deepEqual(searchSnippets('Average annual bill … five per cent lower for domestic customers'), [
    'five per cent lower for domestic customers',
    'Average annual bill',
  ]);
  assert.deepEqual(searchSnippets('short'), []);
});
