import { normalize } from './rich-text.ts';

/**
 * 叫 agent 前的同步：一条提示词属于哪种情况（设计文档「同步规则」那张表）。
 * S = Notion「Shawn 调的版本」；siteId = Notion「网站版本 ID」= 上次叫 agent 同步时 S 对齐的那版（基准），
 * 只由完整同步写，每天的定时同步不动它；base = 基准那版的正文；active = Supabase 现在启用的那版。
 * 拿 S 和基准比，才分得清「Shawn 改了」和「网站改了」。纯函数，不读写任何东西。
 */

/** 工作台和网站后台的上限（src/app/api/studio/prompt/route.ts 的 LIMIT） */
export const MAX_PROMPT = 8000;

export type Active = { id: string; body: string } | null;

export type FullInput = {
  shawn: string;
  /** 基准那版（siteId）的正文；找不到就是空串 */
  base: string;
  siteId: string | null;
  active: Active;
  takenOver: boolean;
  /** Notion 状态：启用 active / 草稿 draft / 停用 null */
  notionStatus: 'active' | 'draft' | null;
};

export type FullAction = 'none' | 'pull' | 'push' | 'blocked-takeover' | 'conflict' | 'skip-draft' | 'too-long';

function pushOrTooLong(shawn: string): FullAction {
  return normalize(shawn).length > MAX_PROMPT ? 'too-long' : 'push';
}

export function decideFull(i: FullInput): FullAction {
  const shawnEmpty = normalize(i.shawn) === '';
  if (i.active === null) {
    return i.notionStatus === 'active' && !shawnEmpty && !i.takenOver ? pushOrTooLong(i.shawn) : 'skip-draft';
  }
  if (shawnEmpty) return 'pull';

  const same = normalize(i.shawn) === normalize(i.base);
  const moved = i.active.id !== i.siteId;
  if (same) return moved ? 'pull' : 'none';
  if (i.takenOver) return 'blocked-takeover';
  if (moved) return 'conflict';
  // 草稿、停用都不推：草稿推上去不会生效，还会把基准换成草稿
  return i.notionStatus === 'active' ? pushOrTooLong(i.shawn) : 'skip-draft';
}

/** 出现过非管理员存的版本（且晚于解除时间）就算客户接手；created_by 为空的是迁移进来的，算管理员 */
export function isTakenOver(
  versions: readonly { created_by: string | null; created_at: string }[],
  adminIds: ReadonlySet<string>,
  releasedAt: string | null,
): boolean {
  const since = releasedAt ? Date.parse(releasedAt) : -Infinity;
  return versions.some((v) => v.created_by !== null && !adminIds.has(v.created_by) && Date.parse(v.created_at) > since);
}

/** 定时同步只读回来时写进「同步提示」的话：预告下次叫 agent 会发生什么；都对齐就不写 */
export function pullNote(i: FullInput): string | null {
  if (normalize(i.shawn) === '') return null;
  const edited = normalize(i.shawn) !== normalize(i.base);
  const moved = (i.active?.id ?? null) !== i.siteId;
  if (!i.active) {
    if (!edited) return null;
    return i.notionStatus === 'active' ? '网站上还没有这条，下次叫 agent 时会推' : '草稿，不会推到网站；agent 用 Notion 里的草稿';
  }
  if (i.takenOver && normalize(i.shawn) !== normalize(i.active.body)) return '客户已接手，你在 Notion 的改动不会写进网站';
  if (edited && moved) return 'Notion 和网站两边都改了，下次叫 agent 时会让你选';
  if (edited) return i.notionStatus === 'active' ? '你有改动还没推到网站，下次叫 agent 时会推' : '草稿或停用，不会推到网站';
  if (moved) return '网站上有新版本，下次叫 agent 时会拉回到「Shawn 调的版本」';
  return null;
}
