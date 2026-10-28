/**
 * 发布日历：数据库行 → 前端类型，以及「加一条」「铺系列」请求体的校验。
 * 纯函数，不 import auth 或任何服务端的东西，测试直接跑。
 */
import { POST_LIMITS, isUnread, type PostKind, type Stage } from './posts.ts';
import type { DayKey } from './week.ts';

export type PostRow = {
  id: string; org_id: string; title: string; body: string; status: string; code: string | null;
  record_by: string | null; publish_on: string | null; stage: Stage; kind: PostKind; is_extra: boolean;
  series: string | null; episode: number | null; media_url: string | null; cover_path: string | null;
  xhs_title: string; xhs_body: string; xhs_tags: string[] | null;
  published_url: string | null; published_at: string | null;
  likes: number | null; saves: number | null; comments: number | null; stats_at: string | null;
  last_note_at: string | null; last_note_by_admin: boolean | null; admin_seen_at: string | null; client_seen_at: string | null;
  updated_at: string;
};

/**
 * 封面路径只认「这家公司、这一条」自己的文件夹：App 用户能通过 RLS 改自己行的 cover_path，
 * 服务端用 service key 签名，不卡的话能签到别家的音频或图片
 */
export function coverPathAllowed(path: string, orgId: string, id: string): boolean {
  const prefix = `posts/${orgId}/${id}/`;
  return path.startsWith(prefix) && path.length > prefix.length && !path.includes('..');
}

/** 日历条目 = scripts 里 publish_on 不为空、status 不是 archived 的行 */
export const POST_COLUMNS =
  'id, org_id, title, body, status, code, record_by, publish_on, stage, kind, is_extra, series, episode, media_url, cover_path, xhs_title, xhs_body, xhs_tags, published_url, published_at, likes, saves, comments, stats_at, last_note_at, last_note_by_admin, admin_seen_at, client_seen_at, updated_at';

export type CalendarPost = {
  id: string; publishOn: string | null; kind: PostKind; isExtra: boolean; title: string;
  body: string; recordBy: string | null; status: string; code: string | null;
  series: string | null; episode: number | null; seriesTotal: number | null; stage: Stage;
  mediaUrl: string | null; coverUrl: string | null;
  xhsTitle: string; xhsBody: string; xhsTags: string[];
  publishedUrl: string | null; publishedAt: string | null;
  likes: number | null; saves: number | null; comments: number | null; statsAt: string | null;
  unread: boolean; updatedAt: string;
};

/** 侧栏「待排」里的一条草稿（没排日期） */
export type DraftItem = { id: string; title: string; kind: PostKind; stage: Stage; updatedAt: string };

export type CalendarData = {
  today: string; month: string; weekdays: number[]; isAdmin: boolean;
  industry: string | null; leadDays: number;
  posts: CalendarPost[];
  drafts: DraftItem[]; draftsTotal: number;
  stock: { until: string | null; making: number; unread: number };
  seriesNames: string[];
};

/** 每个系列名有几条 */
export function countSeries(rows: { series: string | null }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) if (r.series) out.set(r.series, (out.get(r.series) ?? 0) + 1);
  return out;
}

export function toCalendarPost(
  r: PostRow,
  coverUrl: string | null,
  totals: Map<string, number>,
  viewerIsAdmin: boolean,
): CalendarPost {
  return {
    id: r.id, publishOn: r.publish_on, kind: r.kind, isExtra: r.is_extra, title: r.title,
    body: r.body, recordBy: r.record_by, status: r.status, code: r.code,
    series: r.series, episode: r.episode, seriesTotal: r.series ? totals.get(r.series) ?? null : null,
    stage: r.stage, mediaUrl: r.media_url, coverUrl,
    xhsTitle: r.xhs_title, xhsBody: r.xhs_body, xhsTags: r.xhs_tags ?? [],
    publishedUrl: r.published_url, publishedAt: r.published_at,
    likes: r.likes, saves: r.saves, comments: r.comments, statsAt: r.stats_at,
    unread: isUnread(
      { lastNoteAt: r.last_note_at, lastNoteByAdmin: r.last_note_by_admin, adminSeenAt: r.admin_seen_at, clientSeenAt: r.client_seen_at },
      viewerIsAdmin,
    ),
    updatedAt: r.updated_at,
  };
}

export function toDraftItem(r: Pick<PostRow, 'id' | 'title' | 'kind' | 'stage' | 'updated_at'>): DraftItem {
  return { id: r.id, title: r.title, kind: r.kind, stage: r.stage, updatedAt: r.updated_at };
}

type Result<T> = { value: T; error: null } | { value: null; error: string };
const ok = <T>(value: T): Result<T> => ({ value, error: null });
const fail = <T>(error: string): Result<T> => ({ value: null, error });
const len = (s: string) => [...s].length;

export function validDay(s: unknown): s is DayKey {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function cleanSeries(v: unknown): Result<string | null> {
  const s = typeof v === 'string' ? v.trim() : '';
  if (len(s) > POST_LIMITS.series) return fail(`系列名最多 ${POST_LIMITS.series} 字`);
  return ok(s || null);
}

export type NewPost = {
  title: string; kind: PostKind; publish_on: string | null; is_extra: boolean; series: string | null; episode: number | null;
};

export function validateNewPost(b: Record<string, unknown>): Result<NewPost> {
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title) return fail('标题不能为空');
  if (len(title) > POST_LIMITS.title) return fail(`标题最多 ${POST_LIMITS.title} 字`);
  if (b.kind !== 'video' && b.kind !== 'image') return fail('类型只能是视频或图文');
  let publishOn: string | null = null;
  if (b.publishOn !== null && b.publishOn !== undefined && b.publishOn !== '') {
    if (!validDay(b.publishOn)) return fail('日期要写成 年-月-日');
    publishOn = b.publishOn;
  }
  if (b.isExtra !== undefined && typeof b.isExtra !== 'boolean') return fail('热点只能是是或否');
  const series = cleanSeries(b.series);
  if (series.error !== null) return fail(series.error);
  let episode: number | null = null;
  if (b.episode !== null && b.episode !== undefined && b.episode !== '') {
    if (typeof b.episode !== 'number' || !Number.isInteger(b.episode) || b.episode < 1) return fail('第几集要填正整数');
    episode = b.episode;
  }
  return ok({ title, kind: b.kind, publish_on: publishOn, is_extra: b.isExtra === true, series: series.value, episode });
}

/** 星期只留 1–7 的整数，去重排序 */
export function cleanWeekdays(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const valid = v.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 7);
  return [...new Set(valid)].sort((a, b) => a - b);
}

export type SeriesBody = { series: string; lines: string; start: DayKey; weekdays: number[]; dryRun: boolean };

export function validateSeriesBody(b: Record<string, unknown>): Result<SeriesBody> {
  const series = cleanSeries(b.series);
  if (series.error !== null) return fail(series.error);
  if (!series.value) return fail('系列名不能为空');
  if (typeof b.lines !== 'string') return fail('至少写一集');
  if (!validDay(b.start)) return fail('开始日期要写成 年-月-日');
  const weekdays = cleanWeekdays(b.weekdays);
  if (weekdays.length === 0) return fail('先选发在星期几');
  return ok({ series: series.value, lines: b.lines, start: b.start, weekdays, dryRun: b.dryRun === true });
}

/** 「提前几天录完」：0–30 的整数 */
export function validateLeadDays(v: unknown): Result<number> {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 30) return fail('提前天数要在 0 到 30 之间');
  return ok(v);
}
