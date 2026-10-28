/**
 * 发布日历：「已发布 · 贴链接」「撤回已发布」的补丁。纯函数，服务端接口和测试共用。
 */
import { fail, isXhsUrl, ok, stageMissing, type Result, type Stage, type StageFields } from './posts.ts';

type PublishPatch = { stage: 'published'; published_url: string; published_at?: string; publish_on?: string };

/**
 * 「已发布 · 贴链接」的补丁；链接不是小红书的 → 错误。
 * 已发布时只改链接，不动发布时间；没排期的补上墨尔本今天（today）当发布日。
 * 还没发布的要先够条件（视频有正文、有成片链接），防止拼请求绕过界面
 */
export function publishPatch(
  url: unknown,
  current: { stage: Stage; publishOn: string | null } & StageFields,
  now: string,
  today: string,
): Result<PublishPatch> {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u || !isXhsUrl(u)) return fail('这不是小红书的链接');
  if (current.stage !== 'published') {
    const missing = stageMissing('published', current);
    if (missing.length) return fail(`还缺：${missing.join('、')}`);
  }
  const patch: PublishPatch = { stage: 'published', published_url: u };
  if (current.stage !== 'published') patch.published_at = now;
  if (current.publishOn === null) patch.publish_on = today;
  return ok(patch);
}

type UnpublishPatch = { stage: 'cut'; published_url: null; published_at: null };

/** 「撤回已发布」：只对已发布的有效；回到成片，链接和时间清空（修改记录由触发器写） */
export function unpublishPatch(
  current: { stage: Stage; publishedUrl: string | null },
): Result<UnpublishPatch> {
  if (current.stage !== 'published') return fail('只有已发布的才能撤回');
  return ok({ stage: 'cut', published_url: null, published_at: null });
}
