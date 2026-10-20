'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Ref } from '@/lib/content';
import { send, studioFetch, StudioError, type StudioScript } from '@/app/studio/api';
import { pullAction, pullFallback } from '@/lib/studio/scope';
import { openLogin } from '@/components/LoginDialog';
import ScriptDrawer from './ScriptDrawer';

type Claim = 'ours' | 'taken';
type State =
  | { kind: 'hidden' }
  | { kind: 'guest' }
  | { kind: 'needAccount' }
  | { kind: 'pull' }
  | { kind: 'generate' }
  | { kind: 'busy'; label: string }
  | { kind: 'open'; scriptId: string }
  | { kind: 'error'; message: string };
type Drawer = { scriptId: string; autoGenerate: boolean };

/** 一页上同时只开一个侧栏:开新的时通知别的按钮把自己的关掉 */
const DRAWER_EVENT = 'fordexa:drawer-open';

type Library = { claims: Record<string, Claim>; codes: Record<string, string> };

/**
 * 一篇文章下有几条口播:占用和口播库只取一次,几个按钮共用。
 * 拉过之后作废;站内跳转模块不重载,所以也只管 30 秒,免得在工作台拉过回来还显示「拉」
 */
const LIBRARY_TTL_MS = 30_000;
let library: Promise<Library> | null = null;
let libraryAt = 0;
function loadLibrary(): Promise<Library> {
  if (library && Date.now() - libraryAt > LIBRARY_TTL_MS) library = null;
  if (!library) libraryAt = Date.now();
  library ??= Promise.all([
    studioFetch<{ claims: Record<string, Claim> }>('/api/studio/claims'),
    studioFetch<{ scripts: StudioScript[] }>('/api/studio/scripts'),
  ]).then(([{ claims }, { scripts }]) => ({
    claims,
    codes: Object.fromEntries(scripts.filter((s) => s.code).map((s) => [s.code as string, s.id])),
  }));
  library.catch(() => (library = null));
  return library;
}

const BUTTON =
  'rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50';

/**
 * 公开文章页上的「拉到我的口播库」:看完直接拉,右边滑出侧栏改稿、看提示词、试听,不用跳去工作台。
 * - 库里已有这条 → 「打开我的稿子」,不拉第二份;
 * - 没人占 → 拉原稿;别家已占 → 「用我的提示词生成」:拉一份空稿子,侧栏打开就按这家的提示词生成;
 * - 没登录或不是开通客户 → 照样给按钮,点了提示先开通。
 * 管理员按工作台里正在看的那家公司拉。拉取走工作台同一个接口,占用照样由数据库触发器写。
 */
export default function PullButton({ code, refs }: { code: string; refs: Ref[] }) {
  const [state, setState] = useState<State>({ kind: 'hidden' });
  const [drawer, setDrawer] = useState<Drawer | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then(({ claims, codes }) => {
        if (cancelled) return;
        const mine = codes[code];
        const action = pullAction({ claim: claims[code], hasScript: Boolean(mine) });
        setState(action === 'open' && mine ? { kind: 'open', scriptId: mine } : { kind: action === 'generate' ? 'generate' : 'pull' });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ kind: pullFallback(e instanceof StudioError ? e.status : 0) });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    const onOther = (e: Event) => (e as CustomEvent<string>).detail !== code && setDrawer(null);
    window.addEventListener(DRAWER_EVENT, onOther);
    return () => window.removeEventListener(DRAWER_EVENT, onOther);
  }, [code]);

  const openDrawer = (next: Drawer) => {
    window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: code }));
    setDrawer(next);
  };
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const pull = async (label: string) => {
    setState({ kind: 'busy', label });
    try {
      const { id, taken } = await studioFetch<{ id: string; taken: boolean }>('/api/studio/pull', send('POST', { code }));
      library = null;
      setState({ kind: 'open', scriptId: id });
      // 别家已占(包括刚好被别家抢先):拉来的是空稿子,侧栏一开就按这家的提示词生成
      openDrawer({ scriptId: id, autoGenerate: taken });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : '拉取失败，稍后再试' });
    }
  };

  const panel = drawer && (
    <ScriptDrawer scriptId={drawer.scriptId} autoGenerate={drawer.autoGenerate} refs={refs} onClose={closeDrawer} />
  );

  switch (state.kind) {
    case 'hidden':
      return null;
    case 'needAccount':
      return (
        <div className="w-full rounded-xl bg-[var(--accent-tint)] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">
          只有 Fordexa 的客户才能把口播稿拉到口播库。
          <Link href="/apply" className="mx-1 font-medium text-[var(--accent)] hover:underline">
            申请开通 →
          </Link>
          已经开通了？
          <button type="button" onClick={openLogin} className="ml-1 text-[var(--accent)] hover:underline">
            登录
          </button>
        </div>
      );
    case 'guest':
      return (
        <button type="button" onClick={() => setState({ kind: 'needAccount' })} className={BUTTON}>
          拉到我的口播库
        </button>
      );
    case 'error':
      return <span className="text-sm text-[var(--muted)]">{state.message}</span>;
    case 'busy':
      return (
        <button type="button" disabled className={BUTTON}>
          {state.label}
        </button>
      );
    case 'open':
      return (
        <>
          <button
            type="button"
            onClick={() => openDrawer({ scriptId: state.scriptId, autoGenerate: false })}
            className={BUTTON}
          >
            打开我的稿子
          </button>
          {panel}
        </>
      );
    case 'generate':
      return (
        <button type="button" onClick={() => pull('准备中…')} className={BUTTON}>
          用我的提示词生成口播稿
        </button>
      );
    case 'pull':
      return (
        <button type="button" onClick={() => pull('拉取中…')} className={BUTTON}>
          拉到我的口播库
        </button>
      );
  }
}
