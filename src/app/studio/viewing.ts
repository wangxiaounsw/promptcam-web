'use client';

/**
 * 管理员「正在看哪家公司」。
 * 每个标签页记自己的：打开时从 localStorage 读一次（下次打开还是这家），之后只认本页切换的结果。
 * 不能每个请求都读 localStorage —— 另一个标签页切了公司，这一页的横条还写着 Vtax，
 * 请求却已经发去了王小墨（复审 #2）。
 * 只是个方便：服务端每次都会核对，存了别的公司也只对管理员生效。
 */
export const VIEWING_KEY = 'studio-org';

let tabOrg: string | null | undefined;

export function readViewing(): string | null {
  if (tabOrg !== undefined) return tabOrg;
  try {
    tabOrg = window.localStorage.getItem(VIEWING_KEY);
  } catch {
    tabOrg = null;
  }
  return tabOrg;
}

/** 切公司后去哪：留在当前这个标签（在日历就还是日历）。稿子页属于原来那家公司，回口播库 */
export function pathAfterSwitch(pathname: string): string {
  if (!pathname || pathname.startsWith('/studio/s/')) return '/studio';
  return pathname;
}

export function writeViewing(id: string | null): void {
  tabOrg = id;
  try {
    if (id) window.localStorage.setItem(VIEWING_KEY, id);
    else window.localStorage.removeItem(VIEWING_KEY);
  } catch {
    // 无痕模式之类存不了：这一页照样按切换的走，下次打开回到自己公司
  }
}
