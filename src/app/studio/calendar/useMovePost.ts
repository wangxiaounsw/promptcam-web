'use client';

import { useCallback } from 'react';
import { dropPatch, type DropTarget } from '@/lib/studio/dnd';
import type { CalendarData } from '@/lib/studio/posts-map';
import { errorText, send, studioFetch } from '../api';
import { showToast } from '../ui';

/**
 * 改一条的发布日期：拖放、侧栏「排到…」共用。
 * 先 dropPatch 判断（不通过就 toast 原话、什么都不动），通过再 PATCH，成功后 reload 让录制截止日和库存对齐。
 */
export function useMovePost(data: CalendarData | null, reload: () => void) {
  return useCallback(
    async (id: string, target: DropTarget): Promise<boolean> => {
      if (!data) return false;
      const onCal = data.posts.find((p) => p.id === id);
      const draft = onCal ? null : data.drafts.find((d) => d.id === id);
      const post = onCal ?? draft;
      if (!post) return false;
      const r = dropPatch(target, { stage: post.stage, publishOn: onCal ? onCal.publishOn : null });
      if (r.error !== null) {
        if (r.error) showToast(r.error);
        return false;
      }
      try {
        await studioFetch(`/api/studio/posts/${id}`, send('PATCH', { edit: { publish_on: r.value.publish_on } }));
        reload();
        return true;
      } catch (e) {
        showToast(errorText(e));
        return false;
      }
    },
    [data, reload],
  );
}
