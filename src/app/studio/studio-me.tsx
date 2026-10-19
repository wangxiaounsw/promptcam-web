'use client';

import { createContext, useContext } from 'react';
import type { StudioMe } from './api';

/** 工作台里「我是谁、正在看哪家公司」。StudioShell 提供，切换按钮和页面读 */
export type StudioMeContext = StudioMe & { switchTo: (orgId: string) => void; openFeedback: () => void };

export const MeContext = createContext<StudioMeContext | null>(null);

export function useStudioMe(): StudioMeContext | null {
  return useContext(MeContext);
}
