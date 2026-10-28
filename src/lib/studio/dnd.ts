import { fail, ok, type Result, type Stage } from './posts.ts';

export type DropTarget = { day: string } | 'rail';

/**
 * 拖放（或「排到…」）要改成什么日期。
 * error 为空字符串表示什么都不做，也不弹提示；已发布的不能挪也不能退回待排。
 */
export function dropPatch(
  target: DropTarget,
  post: { stage: Stage; publishOn: string | null },
): Result<{ publish_on: string | null }> {
  if (post.stage === 'published') return fail('已发布的不能改日期');
  const next = target === 'rail' ? null : target.day;
  if (next === post.publishOn) return fail('');
  return ok({ publish_on: next });
}
