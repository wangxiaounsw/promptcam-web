// 审稿脚本（review.mjs）里不碰网络的部分，单独放着好测。
import { createHash } from 'node:crypto';

export const SITE = 'https://app.fordexa.com';

/** 和网站 src/lib/tts.ts 的 scriptHash 一样：朗读按它判断稿子改没改过 */
export function scriptHash(script) {
  return createHash('sha256').update(String(script).trim()).digest('hex').slice(0, 16);
}

/** 稿子文件 → 存进库的口播正文：去掉每行首尾空白，多个空行并成一个（空行 = 换段） */
export function normalizeScript(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const IND_ZH = { accounting: '会计', migration: '移民留学', mortgage: '贷款', property: '房产', legal: '律师', data: '数据' };

/** 口播正文 → Notion 的 Markdown：一段一个段落，段内换行用 <br>（Notion 读出来也是这个样子） */
export function scriptToNotion(script) {
  return normalizeScript(script)
    .split(/\n{2,}/)
    .map((p) => p.split('\n').join('<br>'))
    .join('\n');
}

/** Notion 页面正文：口播稿在前，`---` 后面是出处表之类的附注。换稿子时只换前面那段，附注留着 */
export function mergeNotionBody(oldMd, script) {
  const tail = String(oldMd ?? '').split(/\n-{3,}\n/).slice(1).join('\n---\n').trim();
  return tail ? `${script}\n\n---\n\n${tail}` : script;
}

/** 编号 / slug 的统一写法：FX-0028 → fx-0028；不认识的直接拒，免得拼进查询串 */
export function normKey(raw) {
  const k = String(raw ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]{1,160}$/.test(k)) throw new Error(`编号或 slug 不对：${raw}`);
  return k;
}

const rt = (s) => [{ type: 'text', text: { content: String(s ?? '').slice(0, 1900) } }];

/** 口播发布后回写 Notion「口播稿」库的属性 */
export function scriptProps({ row, articleSlug, articleNotion, created }) {
  const props = {
    标题: { title: rt(row.title) },
    状态: { select: { name: '发布' } },
    编号: { rich_text: rt(row.code) },
    slug: { rich_text: rt(row.slug) },
    网站链接: { url: `${SITE}/ideas/${articleSlug}#${String(row.code).toLowerCase()}` },
    发布时间: { date: { start: row.published_at } },
    朗读: { select: { name: row.audio_url ? '已生成' : '未生成' } },
    摘要: { rich_text: rt(row.summary ?? '') },
    出处: { rich_text: rt((row.refs ?? []).map((r) => `${r.label}｜${r.url}`).join('\n')) },
  };
  if (IND_ZH[row.industry]) props.行业 = { select: { name: IND_ZH[row.industry] } };
  if (articleNotion) props.所属文章 = { relation: [{ id: articleNotion }] };
  if (created) props.来源 = { select: { name: '管线起草' } };
  return props;
}

/** 文章发布后回写 Notion「文章」库的属性 */
export function articleProps({ row, created }) {
  const props = {
    标题: { title: rt(row.title) },
    状态: { select: { name: '发布' } },
    编号: { rich_text: rt(row.code) },
    slug: { rich_text: rt(row.slug) },
    网站链接: { url: `${SITE}/ideas/${row.slug}` },
    发布时间: { date: { start: row.published_at } },
  };
  if (created) {
    props.摘要 = { rich_text: rt(row.summary ?? '') };
    props.出处 = { rich_text: rt((row.refs ?? []).map((r) => r.url).join('\n')) };
    if (IND_ZH[row.industry]) props.行业 = { multi_select: [{ name: IND_ZH[row.industry] }] };
  }
  return props;
}
