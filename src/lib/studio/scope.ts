/**
 * 工作台「在看哪家公司」的规则。纯函数，接口那边查好数据再交给这里判断。
 * 管理员能切到任何一家；成员永远只看自己公司 —— 请求里带了别的也不认。
 */

export function pickViewingOrg(a: {
  isAdmin: boolean;
  ownOrgId: string | null;
  requested: string | null;
  requestedExists: boolean;
}): string | null {
  if (a.isAdmin && a.requested && a.requestedExists) return a.requested;
  return a.ownOrgId;
}

/** 管理员，或者所在公司已开通的人 */
export function canEnterStudio(a: { isAdmin: boolean; ownOrgActive: boolean }): boolean {
  return a.isAdmin || a.ownOrgActive;
}

/** Fordexa 稿全站只给一家：没人占，或者占着的就是这家 */
export function canUseFordexa(claimOrgId: string | null, orgId: string | null): boolean {
  return claimOrgId === null || claimOrgId === orgId;
}

/**
 * 公开文章页上的按钮做什么：库里已经有这条 → 打开它，不拉第二份；
 * 别家占了 → 原稿拉不到，改成「用我的提示词生成」(拉一份空稿子，在侧栏里按自己的风格生成)；
 * 其余(没人占，或这家占着但稿子已归档) → 拉原稿。
 */
export function pullAction(a: { claim: 'ours' | 'taken' | undefined; hasScript: boolean }): 'open' | 'pull' | 'generate' {
  if (a.hasScript) return 'open';
  if (a.claim === 'taken') return 'generate';
  return 'pull';
}

/**
 * 查占用失败时按钮怎么办：没登录(401)、不是开通客户(403) → 照样给按钮，点了提示去申请开通；
 * 别的错(服务器出错、断网=0) → 不显示，免得叫已开通的客户去申请。
 */
export function pullFallback(status: number): 'guest' | 'hidden' {
  return status === 401 || status === 403 ? 'guest' : 'hidden';
}

/**
 * 已经在库里的稿子能不能看到 Fordexa 原稿：这家占着才行；没人占时只认本来就是 Fordexa 稿的那条。
 * 别家占着时拉来的空稿子(source=self)，占用释放后也不会自动拿到原稿 —— 释放只是「谁先再导入归谁」。
 */
export function scriptMayUseFordexa(a: { claimOrgId: string | null; orgId: string | null; source: string }): boolean {
  if (a.claimOrgId === null) return a.source === 'fordexa';
  return a.claimOrgId === a.orgId;
}

/**
 * 网站和 /api/ideas（App 也用）上 Fordexa 稿给不给看：没人占，或者是占着的那家，或者是管理员。
 * 免费样稿被占了也一样藏 —— 不然别家退出登录就能看到。
 */
export function fordexaVisible(a: { claimOrgId: string | null; viewerOrgId: string | null; isAdmin: boolean }): boolean {
  return a.claimOrgId === null || a.isAdmin || a.claimOrgId === a.viewerOrgId;
}
