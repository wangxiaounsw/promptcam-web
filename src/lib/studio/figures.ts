/**
 * 数字核对：把稿子里的数字（金额、比例、年份、时长……）挑出来，
 * 去「依据材料」里逐个找。找不到的原样返回，编辑器里标黄。
 *
 * 这是程序不是 AI —— AI 偷偷编了个数字，这里一定抓得到。
 * 宁可多标不要漏标：解析不了的片段当作找不到。
 */

const CN_DIGIT: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const CN_SMALL: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const CN_BIG: Record<string, number> = { 万: 1e4, 亿: 1e8 };
const CN_CHARS = '零〇一二两三四五六七八九十百千万亿';

/** 时间、年龄、次数这类量词单独成一类；货币单位等同于裸数字 */
const KIND_UNITS = ['个月', '年', '月', '天', '周', '岁', '次', '倍'];
const MONEY_UNITS = ['澳币', '澳元', '元', '块'];
const UNIT_RE = `(?:%|${[...KIND_UNITS, ...MONEY_UNITS].join('|')})`;

/** 带数量级字的常用词，不是数字 */
const CN_STOPWORDS = new Set(['千万', '万一', '一一', '十分', '万万', '那一年', '这一年', '哪一年']);

// 千分位逗号只认后面跟三位数字的（中文逗号转成半角后也是 ,）；
// 「50 万 9000」这种口语读法整体算一个数
const ARABIC = new RegExp(
  `(?:A\\$|\\$)?\\d(?:\\d|,(?=\\d{3}))*(?:\\.\\d+)?(?:\\s*[万千亿](?:\\s*\\d+(?![\\d.])(?:\\s*[千百])?)?)?(?:\\s*${UNIT_RE})?`,
  'g',
);
// 余数后面还可以带「千/百」：97 万 1 千 = 971000
const MIXED = new RegExp(`^(\\d+(?:\\.\\d+)?)([万亿])(\\d+)([千百])?(${UNIT_RE})?$`);
const PERCENT_CN = new RegExp(`百分之[${CN_CHARS}\\d.]+`, 'g');
const CHINESE = new RegExp(`[${CN_CHARS}]+(?:\\s*${UNIT_RE})?`, 'g');

/** 全角数字和符号换成半角，长度不变，下标还能对回原文 */
function halfWidth(text: string): string {
  return text.replace(/[０-９％＄，．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function parseChinese(s: string): number | null {
  if (![...s].some((c) => c in CN_SMALL || c in CN_BIG)) {
    // 二〇二五 这类逐位写法
    const digits = [...s].map((c) => CN_DIGIT[c]);
    return digits.every((d) => d !== undefined) ? Number(digits.join('')) : null;
  }
  let total = 0;
  let section = 0;
  let digit = 0;
  let lastUnit = 1;
  for (const c of s) {
    if (c in CN_DIGIT) {
      digit = CN_DIGIT[c];
    } else if (c in CN_SMALL) {
      section += (digit || 1) * CN_SMALL[c];
      lastUnit = CN_SMALL[c];
      digit = 0;
    } else if (c in CN_BIG) {
      total += (section + digit) * CN_BIG[c];
      lastUnit = CN_BIG[c];
      section = 0;
      digit = 0;
    } else {
      return null;
    }
  }
  // 一万二 = 12000、三千五 = 3500：末尾单个数字落在上一个单位的下一位
  const tail = digit && lastUnit >= 10 ? digit * (lastUnit / 10) : digit;
  return total + section + tail;
}

function parseNumber(s: string): number | null {
  const t = s.replace(/[,\s$A]/g, '');
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return parseChinese(t);
}

/** 归一成可比较的键：n:12000 / pct:15 / y:2025 / 3:个月；不是数字返回 null */
export function normalizeFigure(raw: string): string | null {
  const s = halfWidth(raw).replace(/\s+/g, '');
  const mixed = s.match(MIXED);
  if (mixed) {
    const [, head, magnitude, rest, small, unit] = mixed;
    const restValue = Number(rest) * (small === '千' ? 1e3 : small === '百' ? 100 : 1);
    const value = Number(head) * (magnitude === '万' ? 1e4 : 1e8) + restValue;
    return unit === '%' ? `pct:${value}` : unit && KIND_UNITS.includes(unit) ? `${value}:${unit}` : `n:${value}`;
  }
  if (s.startsWith('百分之')) {
    const v = parseNumber(s.slice(3));
    return v === null ? null : `pct:${v}`;
  }
  const m = s.match(new RegExp(`^(.*?)([万千亿])?(${UNIT_RE})?$`));
  if (!m || !m[1]) return null;
  const [, numPart, magnitude, unit] = m;
  if (!/\d/.test(numPart) && !magnitude && !unit && ![...numPart].some((c) => c in CN_SMALL || c in CN_BIG)) {
    return null; // 一、两、三 单独出现不算数字
  }
  if (!/\d/.test(numPart) && CN_STOPWORDS.has(numPart + (magnitude ?? ''))) return null;
  let value = parseNumber(numPart + (/\d/.test(numPart) ? '' : (magnitude ?? '')));
  if (value === null) return null;
  if (magnitude && /\d/.test(numPart)) value *= magnitude === '万' ? 1e4 : magnitude === '千' ? 1e3 : 1e8;
  value = Math.round(value * 1e6) / 1e6;
  if (unit === '%') return `pct:${value}`;
  if (unit === '年' && Number.isInteger(value) && value >= 1900 && value <= 2100) return `y:${value}`;
  if (unit && KIND_UNITS.includes(unit)) return `${value}:${unit}`;
  return `n:${value}`;
}

type Hit = { text: string; key: string; at: number };

/** 把「十分」「千万」这类词换成等长占位，正则就不会把其中的数字字抠出来 */
function maskStopwords(text: string): string {
  let out = text;
  for (const w of CN_STOPWORDS) out = out.split(w).join('□'.repeat(w.length));
  return out;
}

function hits(text: string): Hit[] {
  const half = maskStopwords(halfWidth(text));
  const found: Hit[] = [];
  const taken: [number, number][] = [];
  for (const re of [PERCENT_CN, ARABIC, CHINESE]) {
    for (const m of half.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      // 「第一次」「第三点」是序数，不是数量
      if (re === CHINESE && half[start - 1] === '第') continue;
      const original = text.slice(start, end).trim();
      const key = normalizeFigure(original);
      if (!key) continue;
      taken.push([start, end]);
      found.push({ text: original, key, at: start });
    }
  }
  return found.sort((a, b) => a.at - b.at);
}

export function extractFigures(text: string): string[] {
  return [...new Set(hits(text).map((h) => h.text))];
}

export function unsupportedFigures(script: string, sourceText: string): string[] {
  const known = new Set(hits(sourceText).map((h) => h.key));
  const missing = hits(script).filter((h) => !known.has(h.key)).map((h) => h.text);
  return [...new Set(missing)];
}
