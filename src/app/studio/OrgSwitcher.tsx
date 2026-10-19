'use client';

import { useState } from 'react';
import { useStudioMe } from './studio-me';

/**
 * 管理员切换公司。电脑：顶栏里一个下拉；手机：内容上方一条窄栏，点开是底部列表。
 * 看的不是自己公司时，换成醒目的提醒条 —— 免得以为在改自己的，其实在改客户的。
 */
function label(o: { name: string; is_active: boolean }) {
  return o.is_active ? o.name : `${o.name}（未开通）`;
}

export function OrgSelect() {
  const ctx = useStudioMe();
  if (!ctx?.orgs || !ctx.viewing) return null;
  return (
    <label className="ml-2 flex items-center gap-2 text-[14px] text-[var(--muted)]">
      <span className="sr-only">切换公司</span>
      <select
        value={ctx.viewing.id}
        onChange={(e) => ctx.switchTo(e.target.value)}
        className="h-10 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--bg-raised)] px-3 text-[15px] font-medium text-[var(--ink)] outline-none focus:border-[var(--accent)]"
      >
        {ctx.orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {label(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 不是自己公司时的提醒条（电脑、手机都有） */
export function ViewingBanner() {
  const ctx = useStudioMe();
  const [open, setOpen] = useState(false);
  if (!ctx?.orgs || !ctx.viewing) return null;
  const other = ctx.viewing.id !== ctx.ownOrgId;

  return (
    <>
      <div
        className={`flex h-11 items-center gap-2 px-5 text-[15px] md:px-6 ${
          other ? 'bg-[var(--viewing)] font-bold text-white' : 'border-b border-[var(--line)] bg-[var(--bg-raised)] md:hidden'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">
          {other ? `你正在看：${ctx.viewing.name} 的口播库` : `正在看：${ctx.viewing.name}`}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`h-11 shrink-0 px-2 font-medium md:hidden ${other ? 'text-white underline' : 'text-[var(--accent)]'}`}
        >
          切换
        </button>
        {other && ctx.ownOrgId && (
          <button
            type="button"
            onClick={() => ctx.switchTo(ctx.ownOrgId!)}
            className="hidden h-9 shrink-0 rounded-lg bg-white/20 px-3 text-[14px] font-medium md:block"
          >
            回到自己的
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-[#121815]/50 md:hidden" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-3xl bg-[var(--bg-raised)] md:hidden"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
          >
            <p className="px-5 pb-1 pt-4 text-[13px] font-bold text-[var(--muted)]">切换到</p>
            {ctx.orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  ctx.switchTo(o.id);
                }}
                className={`flex h-14 w-full items-center justify-between border-b border-[var(--row-line)] px-5 text-left text-base last:border-b-0 ${
                  o.id === ctx.viewing?.id ? 'font-bold text-[var(--accent)]' : ''
                }`}
              >
                <span>
                  {label(o)}
                  {o.id === ctx.ownOrgId && <span className="ml-2 text-[13px] font-normal text-[var(--muted)]">我的</span>}
                </span>
                <span className="text-[13px] text-[var(--muted)]">{o.members} 人</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
