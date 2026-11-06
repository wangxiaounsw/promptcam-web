/**
 * 风格库（/library）：封面、转场、口播效果……每个一个固定编号。
 * 媒体和 manifest.json 在 Supabase 公开桶 style-library 里，由 xhs-video 的 `npm run library` 渲染、
 * scripts/library-upload.mjs 上传。页面在服务端读 manifest，5 分钟内跟上新上传的版本，不用重新部署。
 */

export const LIBRARY_BUCKET = 'style-library';
export const GROUP_ORDER = ['模板封面', '实拍封面', '转场', '口播效果', '素材卡片', '版式件', '整条版式'] as const;
const REVALIDATE_SECONDS = 300;

export type LibraryItem = {
  code: string;
  group: (typeof GROUP_ORDER)[number];
  kind: 'cover' | 'video';
  name: string;
  purpose: string;
  origin: string;
  source: string;
  /** 筛选标签，词表见 manifest 的 tagGroups；旧 manifest 没有就是 []。 */
  tags: string[];
  /** 加进风格库的日期 YYYY-MM-DD，「最新加入」排序用；旧 manifest 没有。 */
  added?: string;
  file: string;
  poster?: string;
  width: number;
  height: number;
};

export type TagGroup = { name: string; tags: string[] };
export type LibraryResult =
  | { ok: true; items: LibraryItem[]; tagGroups: TagGroup[]; dropped: string[] }
  | { ok: false; reason: string };

const CODE = /^[A-Z]\d{2,}$/;
const FILE = /^[\w.-]+$/;
const isFile = (v: unknown): v is string => typeof v === 'string' && FILE.test(v) && !v.includes('..');
const isText = (v: unknown): v is string => typeof v === 'string';
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isText);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isSize = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function itemProblem(x: Record<string, unknown>): string | null {
  if (!isText(x.code) || !CODE.test(x.code)) return `编号不对：${String(x.code)}`;
  if (x.kind !== 'cover' && x.kind !== 'video') return `${x.code}: kind 不对`;
  for (const k of ['group', 'name', 'purpose', 'origin', 'source'] as const) if (!isText(x[k])) return `${x.code}: 缺 ${k}`;
  if (!isFile(x.file)) return `${x.code}: 文件名不对`;
  if (x.poster !== undefined && !isFile(x.poster)) return `${x.code}: poster 文件名不对`;
  if (!isSize(x.width) || !isSize(x.height)) return `${x.code}: 缺尺寸`;
  if (x.tags !== undefined && !isTextList(x.tags)) return `${x.code}: tags 不对`;
  if (x.added !== undefined && !(isText(x.added) && DATE.test(x.added))) return `${x.code}: added 不对`;
  return null;
}

/** 标签分组：坏的组跳过，不让整页打不开；组里一个标签都没有的也不要。 */
function parseTagGroups(raw: unknown): TagGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((g) => {
    if (!g || typeof g !== 'object') return [];
    const { name, tags } = g as { name?: unknown; tags?: unknown };
    return isText(name) && isTextList(tags) && tags.length ? [{ name, tags: [...tags] }] : [];
  });
}

/** 校验并排序 manifest。任何一项坏了整份不用（宁可显示「打不开」也不显示一半）；不认识的分组只丢那几项。 */
export function parseManifest(raw: unknown): LibraryResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'manifest 不是对象' };
  const m = raw as { version?: unknown; items?: unknown; tagGroups?: unknown };
  if (m.version !== 1) return { ok: false, reason: `不认识的 manifest 版本：${String(m.version)}` };
  if (!Array.isArray(m.items)) return { ok: false, reason: 'manifest 缺 items' };
  const items: LibraryItem[] = [];
  const dropped = new Set<string>();
  for (const x of m.items) {
    if (!x || typeof x !== 'object') return { ok: false, reason: 'items 里有不是对象的' };
    const problem = itemProblem(x as Record<string, unknown>);
    if (problem) return { ok: false, reason: problem };
    const it = { ...(x as LibraryItem), tags: [...((x as { tags?: string[] }).tags ?? [])] };
    if (!(GROUP_ORDER as readonly string[]).includes(it.group)) {
      dropped.add(it.group);
      continue;
    }
    items.push(it);
  }
  const rank = (i: LibraryItem) => GROUP_ORDER.indexOf(i.group);
  const num = (i: LibraryItem) => Number(i.code.slice(1));
  items.sort((a, b) => rank(a) - rank(b) || num(a) - num(b));
  return { ok: true, items, tagGroups: parseTagGroups(m.tagGroups), dropped: [...dropped] };
}

export function mediaUrl(file: string, base = process.env.SUPABASE_URL ?? ''): string {
  return `${base}/storage/v1/object/public/${LIBRARY_BUCKET}/${file}`;
}

/** 读桶里的 manifest；网络错、404、坏 JSON 都返回 ok: false，不抛。 */
export async function fetchLibrary(): Promise<LibraryResult> {
  try {
    const res = await fetch(mediaUrl('manifest.json'), { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return { ok: false, reason: `manifest ${res.status}` };
    return parseManifest(await res.json());
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
