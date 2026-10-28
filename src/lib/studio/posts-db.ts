/**
 * 发布日历的数据层：日历条目就是 scripts 里排了期的行，所有查询都带 org_id。页面用到的类型也从这里出。
 */
import { admin } from '@/lib/auth';
import { PRIVATE_BUCKET } from '@/lib/studio/audio';
import { monthGrid, stockUntil } from './calendar.ts';
import type { NoteView } from './notes.ts';
import { isUnread } from './posts.ts';
import {
  POST_COLUMNS, countSeries, coverPathAllowed, toCalendarPost, toDraftItem,
  type CalendarData, type CalendarPost, type DraftItem, type PostRow,
} from './posts-map.ts';
import { melbourneDay } from './week.ts';

export { POST_COLUMNS };
export type { CalendarData, CalendarPost, DraftItem, PostRow };

/** 侧栏「待排」最多给多少条 */
export const DRAFTS_LIMIT = 300;

/** 备注一行（页面也用）。author 为空 = 系统写的或人已不在 */
export type PostNote = NoteView;

/** 封面签不出来：接口回 502，别让封面悄悄消失 */
export class SignError extends Error {}

export async function postInScope(orgId: string, id: string): Promise<PostRow | null> {
  const { data } = await admin().from('scripts').select(POST_COLUMNS).eq('id', id).eq('org_id', orgId).neq('status', 'archived').maybeSingle();
  return (data as PostRow | null) ?? null;
}

const PAGE = 1000;

/** PostgREST 一次最多回 1000 行：超过就接着 .range 往后取，别悄悄少数。build 里要带稳定的 order */
export async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error('db');
    const rows = (data as T[] | null) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** 这家公司每个系列有几条（只取 series 一列） */
async function seriesTotals(orgId: string): Promise<Map<string, number>> {
  const rows = await pageAll<{ series: string | null }>((from, to) =>
    admin().from('scripts').select('series').eq('org_id', orgId).neq('status', 'archived')
      .not('series', 'is', null).order('id').range(from, to),
  );
  return countSeries(rows);
}

/** 一次签全部封面、一次查系列总数 */
export async function toCalendarPosts(
  rows: PostRow[],
  orgId: string,
  viewerIsAdmin: boolean,
  knownTotals?: Map<string, number>,
): Promise<CalendarPost[]> {
  if (rows.length === 0) return [];
  const totals = knownTotals ?? (await seriesTotals(orgId));
  // 只签自己文件夹里的封面（RLS 允许 App 用户改自己行的 cover_path，不卡会签到别家的文件）
  const okPath = (r: PostRow): string | null =>
    r.cover_path && coverPathAllowed(r.cover_path, orgId, r.id) ? r.cover_path : null;
  const paths = [...new Set(rows.map(okPath).filter((p): p is string => Boolean(p)))];
  const urls = new Map<string, string>();
  if (paths.length) {
    const res = await admin().storage.from(PRIVATE_BUCKET).createSignedUrls(paths, 3600);
    if (res.error || !res.data) throw new SignError('sign failed');
    for (const s of res.data) {
      if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
      else console.error('posts-db sign cover', s.path, s.error);
    }
  }
  return rows.map((r) => {
    const path = okPath(r);
    return toCalendarPost(r, path ? urls.get(path) ?? null : null, totals, viewerIsAdmin);
  });
}

type UpcomingRow = Pick<PostRow, 'publish_on' | 'is_extra' | 'stage'>;
type NoteMarkRow = Pick<PostRow, 'last_note_at' | 'last_note_by_admin' | 'admin_seen_at' | 'client_seen_at'>;

/** 今天及以后排了期的行（库存和「在做」只看这些） */
function upcomingRows(orgId: string, today: string): Promise<UpcomingRow[]> {
  return pageAll<UpcomingRow>((from, to) =>
    admin().from('scripts').select('publish_on, is_extra, stage').eq('org_id', orgId).neq('status', 'archived')
      .gte('publish_on', today).order('id').range(from, to),
  );
}

/** 红点：只取对方写过备注的行（不是我写的最后一条），再按 isUnread 判断有没有看过 */
async function unreadCount(orgId: string, viewerIsAdmin: boolean): Promise<number> {
  const rows = await pageAll<NoteMarkRow>((from, to) =>
    admin().from('scripts')
      .select('last_note_at, last_note_by_admin, admin_seen_at, client_seen_at')
      .eq('org_id', orgId).neq('status', 'archived').not('last_note_at', 'is', null)
      .or(`last_note_by_admin.is.null,last_note_by_admin.eq.${!viewerIsAdmin}`)
      .order('id').range(from, to),
  );
  return rows.filter((r) =>
    isUnread(
      { lastNoteAt: r.last_note_at, lastNoteByAdmin: r.last_note_by_admin, adminSeenAt: r.admin_seen_at, clientSeenAt: r.client_seen_at },
      viewerIsAdmin,
    ),
  ).length;
}

export async function loadMonth(orgId: string, month: string, viewerIsAdmin: boolean): Promise<CalendarData> {
  const db = admin();
  const today = melbourneDay(new Date());
  const grid = monthGrid(month);
  const from = grid[0][0];
  const to = grid[grid.length - 1][6];
  const live = () => db.from('scripts').select(POST_COLUMNS).eq('org_id', orgId).neq('status', 'archived');
  const [org, inRange, drafts, upcoming, totals, unread] = await Promise.all([
    db.from('organizations').select('post_weekdays, industry, record_lead_days').eq('id', orgId).maybeSingle(),
    live().gte('publish_on', from).lte('publish_on', to).order('publish_on').order('created_at'),
    db.from('scripts').select('id, title, kind, stage, updated_at', { count: 'exact' })
      .eq('org_id', orgId).neq('status', 'archived').is('publish_on', null)
      .order('updated_at', { ascending: false }).limit(DRAFTS_LIMIT),
    upcomingRows(orgId, today),
    seriesTotals(orgId),
    unreadCount(orgId, viewerIsAdmin),
  ]);
  if (org.error || inRange.error || drafts.error) throw new Error('db');

  const stock = {
    until: stockUntil(upcoming.map((r) => ({ publishOn: r.publish_on, isExtra: r.is_extra, stage: r.stage })), today),
    making: upcoming.filter((r) => r.stage !== 'cut' && r.stage !== 'published').length,
    unread,
  };

  const orgRow = org.data as { post_weekdays: number[] | null; industry: string | null; record_lead_days: number | null } | null;
  const draftRows = (drafts.data as Pick<PostRow, 'id' | 'title' | 'kind' | 'stage' | 'updated_at'>[]) ?? [];
  return {
    today, month,
    weekdays: [...(orgRow?.post_weekdays ?? [])],
    isAdmin: viewerIsAdmin,
    industry: orgRow?.industry ?? null,
    leadDays: orgRow?.record_lead_days ?? 5,
    posts: await toCalendarPosts((inRange.data as PostRow[]) ?? [], orgId, viewerIsAdmin, totals),
    drafts: draftRows.map(toDraftItem),
    draftsTotal: drafts.count ?? draftRows.length,
    stock,
    seriesNames: [...totals.keys()].sort((a, b) => a.localeCompare(b, 'zh')),
  };
}

/** 从 from 起已有非热点安排的日子（铺系列时跳过） */
export async function takenDays(orgId: string, from: string): Promise<Set<string>> {
  const rows = await pageAll<{ publish_on: string | null }>((a, b) =>
    admin().from('scripts').select('publish_on').eq('org_id', orgId).neq('status', 'archived')
      .eq('is_extra', false).gte('publish_on', from).order('id').range(a, b),
  );
  return new Set(rows.map((r) => r.publish_on).filter((d): d is string => Boolean(d)));
}
