-- 定稿记录：客户在 App 录完点「发给 Fordexa」(把视频发来剪辑) 的那一刻，就是这条稿子定稿了。
--
-- 以后用来让写稿提示词跟着改稿进化：拿「AI 生成的那一版」和「定稿时的正文」对比，
-- 攒够几条出提示词修改建议，Shawn / 客户点了才采纳。
-- 这一期只加列，网站暂时不读；App 下一版在「发给 Fordexa」时写这三列。
--
-- finalized_body 是快照：定稿后正文再改，也知道交片时念的是哪一版。
-- 再次点「发给 Fordexa」就覆盖成最新一次。
-- 这几列不进修改记录(script_changes 只记标题、正文、录制日期、状态)。

alter table public.scripts add column if not exists finalized_at timestamptz;
alter table public.scripts add column if not exists finalized_body text;
alter table public.scripts add column if not exists finalized_by uuid;

-- 以后按公司找最近定稿的稿子出建议
create index if not exists scripts_finalized_idx on public.scripts (org_id, finalized_at desc)
  where finalized_at is not null;
