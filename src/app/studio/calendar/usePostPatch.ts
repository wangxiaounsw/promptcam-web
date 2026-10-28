'use client';

import { useCallback, useRef, useState } from 'react';
import type { PostPatchBody } from '@/lib/studio/posts';
import type { CalendarPost } from '@/lib/studio/posts-db';
import { errorText, send, studioFetch } from '../api';
import { showToast } from '../ui';

/** 面板里所有改动都走这一个：PATCH 一条，成功换掉整条（不可变），失败 toast 服务端的原话 */
export type SavePost = (body: PostPatchBody) => Promise<boolean>;

/** 比最新一次请求更早回来的响应直接丢掉（序号），连着失焦保存时不会用旧值盖掉新值 */
export function usePostPatch(postId: string, onChange: (p: CalendarPost) => void) {
  const [inflight, setInflight] = useState(0);
  const seq = useRef(0);
  const patch = useCallback<SavePost>(
    async (body) => {
      const mine = ++seq.current;
      setInflight((n) => n + 1);
      try {
        const { post } = await studioFetch<{ post: CalendarPost }>(`/api/studio/posts/${postId}`, send('PATCH', body));
        if (mine === seq.current) onChange(post);
        return true;
      } catch (e) {
        showToast(errorText(e));
        return false;
      } finally {
        setInflight((n) => n - 1);
      }
    },
    [postId, onChange],
  );
  return { patch, busy: inflight > 0 };
}
