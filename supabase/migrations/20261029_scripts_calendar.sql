-- 发布日历第 3 版：口播库（scripts）就是日历，不再单独建 posts 表
-- 设计：docs/superpowers/specs/2026-10-27-content-calendar-design.md（第 3 版）
--
-- 顺序要紧（照第二期的做法）：先加列、建表、放开约束，再回填老数据，最后才替换触发器 ——
-- 否则回填本身会被记成一大堆「修改」。
-- App 直接写 scripts，只写 id/title/body/source/status/sort_order/code/user_id，
-- 所以新列一律可空或带默认值，App 的 upsert 不会被卡住。
-- 全部可以重复跑：if not exists / create or replace / drop … if exists。

-- 1. 加列、建表、放开约束 ------------------------------------------------------

alter table public.scripts add column if not exists publish_on date;
alter table public.scripts add column if not exists stage text not null default 'draft'
  check (stage in ('draft', 'refining', 'final', 'recorded', 'cut', 'published'));
alter table public.scripts add column if not exists kind text not null default 'video'
  check (kind in ('video', 'image'));
alter table public.scripts add column if not exists is_extra boolean not null default false;
alter table public.scripts add column if not exists series text;
alter table public.scripts add column if not exists episode int;
alter table public.scripts add column if not exists media_url text;
alter table public.scripts add column if not exists cover_path text;
alter table public.scripts add column if not exists xhs_title text not null default '';
alter table public.scripts add column if not exists xhs_body text not null default '';
alter table public.scripts add column if not exists xhs_tags text[] not null default '{}';
alter table public.scripts add column if not exists published_url text;
alter table public.scripts add column if not exists published_at timestamptz;
alter table public.scripts add column if not exists likes int;
alter table public.scripts add column if not exists saves int;
alter table public.scripts add column if not exists comments int;
alter table public.scripts add column if not exists stats_at timestamptz;
-- 备注红点（第 2 版的规则不变）
alter table public.scripts add column if not exists last_note_at timestamptz;
alter table public.scripts add column if not exists last_note_by_admin boolean;
alter table public.scripts add column if not exists admin_seen_at timestamptz;
alter table public.scripts add column if not exists client_seen_at timestamptz;

-- 日历按公司、按日期取
create index if not exists scripts_org_publish_idx on public.scripts (org_id, publish_on);

-- 「提前几天录完」：发布日期 − 这个天数 = 录制截止日 record_by
alter table public.organizations add column if not exists record_lead_days int not null default 5;
alter table public.organizations drop constraint if exists organizations_record_lead_days_check;
alter table public.organizations add constraint organizations_record_lead_days_check
  check (record_lead_days between 0 and 30);

-- 备注：双方都能写。kind = system 预留给自动记的备注（目前没有人写：撤回已发布等进度变化记在 script_changes）。只走服务端，开 RLS 不加策略
create table if not exists public.script_notes (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts(id) on delete cascade,
  org_id uuid not null,
  author_id uuid,
  kind text not null default 'note' check (kind in ('note', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists script_notes_script_idx on public.script_notes (script_id, created_at);
alter table public.script_notes enable row level security;

-- 修改记录的 field 放开到新列（备注增删记 note）
alter table public.script_changes drop constraint if exists script_changes_field_check;
alter table public.script_changes add constraint script_changes_field_check check (field in (
  'title', 'body', 'record_by', 'status', 'publish_on', 'stage', 'kind', 'is_extra', 'series',
  'episode', 'media_url', 'cover_path', 'xhs_title', 'xhs_body', 'xhs_tags', 'published_url',
  'likes', 'saves', 'comments', 'note'
));

-- 2. 回填 --------------------------------------------------------------------

-- 已经录过的（App 点过「已录」，或发过视频给 Fordexa）= 已录；其余都是草稿。
-- publish_on 一律留空：老稿子不会突然出现在日历上。
-- 只改 stage = 'draft' 的行，重复跑也不会出错
update public.scripts
set stage = 'recorded'
where stage = 'draft' and (status = 'recorded' or finalized_at is not null);

-- 3. 触发器 ------------------------------------------------------------------

-- 进度先后：draft < refining < final < recorded < cut < published，不认识的算 0
create or replace function public.script_stage_rank(s text)
returns int
language sql
immutable
set search_path = public
as $$
  select coalesce(array_position(array['draft', 'refining', 'final', 'recorded', 'cut', 'published'], s), 0);
$$;
revoke execute on function public.script_stage_rank(text) from public, anon, authenticated;

-- 这家公司「提前几天录完」，查不到按 5
create or replace function public.script_lead_days(org uuid)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce((select record_lead_days from public.organizations where id = org), 5);
$$;
revoke execute on function public.script_lead_days(uuid) from public, anon, authenticated;

-- 在第二期（含复审修复）基础上：新插入的视频有发布日期、没填 record_by 时自动算；图文没有录制
create or replace function public.scripts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- App 保存走 upsert（INSERT … ON CONFLICT DO UPDATE），已有的行也会先进这里：
  -- 原样放行，不然会把老稿子的正文清掉
  if exists (select 1 from public.scripts where id = new.id) then
    return new;
  end if;

  if auth.uid() is not null then
    new.org_id := (select org_id from public.profiles where id = auth.uid());
    new.created_by := auth.uid();
  else
    new.org_id := coalesce(new.org_id, (select org_id from public.profiles where id = new.user_id));
    new.created_by := coalesce(new.created_by, new.user_id);
  end if;

  if new.source = 'fordexa' and new.code is not null and new.org_id is not null then
    insert into public.fordexa_claims (code, org_id, script_id, claimed_by)
    values (new.code, new.org_id, new.id, coalesce(auth.uid(), new.edited_by, new.user_id))
    on conflict (code) do nothing;
    -- 别家已经占了：只给标题和选题，正文留空让他们自己写
    if (select org_id from public.fordexa_claims where code = new.code) <> new.org_id then
      new.body := '';
      new.source := 'self';
    end if;
  end if;

  -- 录制截止日：date - integer 按日历天算，不受夏令时影响
  if new.kind = 'image' then
    new.record_by := null;
  elsif new.publish_on is not null and new.record_by is null then
    new.record_by := new.publish_on - public.script_lead_days(new.org_id);
  end if;

  -- App 直接插入一条已录 / 已发给 Fordexa 的稿子：进度推到已录（只往前推，图文没有已录）
  if new.kind <> 'image'
     and (new.status = 'recorded' or new.finalized_at is not null)
     and public.script_stage_rank(new.stage) < public.script_stage_rank('recorded') then
    new.stage := 'recorded';
  end if;
  return new;
end;
$$;

-- 主人、公司、谁放的保持原值；再按顺序处理发布日期、种类、进度和 App 状态的对齐。
-- BEFORE 触发器只改 NEW，后面 AFTER 的 scripts_log_change 看到的就是最终值，
-- 自动算出的 record_by 也会记在同一个人名下（auth.uid()，否则 edited_by）。
create or replace function public.scripts_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := old.user_id;
  new.org_id := case when auth.uid() is null then coalesce(old.org_id, new.org_id) else old.org_id end;
  new.created_by := coalesce(old.created_by, new.created_by);

  -- a. 发布日期变了：视频重算 record_by（清空则一起清空），图文没有录制
  --    只有发布日期变时才重算，所以手动改的 record_by 会保留到下次改发布日期
  if new.publish_on is distinct from old.publish_on then
    if new.kind = 'image' or new.publish_on is null then
      new.record_by := null;
    else
      new.record_by := new.publish_on - public.script_lead_days(new.org_id);
    end if;
  end if;

  -- b. 改成图文：清掉 record_by；图文没有「已录」，退回定稿
  if new.kind = 'image' and old.kind is distinct from 'image' then
    new.record_by := null;
    if new.stage = 'recorded' then
      new.stage := 'final';
    end if;
  end if;

  -- b2. 图文改回视频且有发布日期：重算 record_by
  if new.kind = 'video' and old.kind is distinct from 'video' and new.publish_on is not null then
    new.record_by := new.publish_on - public.script_lead_days(new.org_id);
  end if;

  -- c. App 里客户发来视频（finalized_at 从空变有值）：进度推到已录（图文跳过）
  if new.kind <> 'image' and old.finalized_at is null and new.finalized_at is not null
     and public.script_stage_rank(new.stage) < public.script_stage_rank('recorded') then
    new.stage := 'recorded';
  end if;

  -- d. App 把 status 改成 recorded（点「✓ 已录」）：进度推到已录
  if new.kind <> 'image' and new.status = 'recorded' and old.status is distinct from 'recorded'
     and public.script_stage_rank(new.stage) < public.script_stage_rank('recorded') then
    new.stage := 'recorded';
  end if;

  -- e. status 从 recorded 变回 ready
  if old.status = 'recorded' and new.status = 'ready' then
    if new.stage in ('cut', 'published') or new.finalized_at is not null then
      -- App 拿旧数据写回来：成片、已发布和「已发给 Fordexa」（finalized_at 有值）不接受，
      -- 保持 recorded、不降进度
      new.status := 'recorded';
    elsif new.stage = 'recorded' then
      -- 客户在 App 里取消了「已录」：退回定稿
      new.stage := 'final';
    end if;
  end if;

  -- f. 网页只改了 stage、没动 status：把 App 的状态对齐
  --    已归档的不动 status（否则退回进度会把归档的稿子放出来）
  if new.stage is distinct from old.stage and new.status is not distinct from old.status
     and new.status <> 'archived' then
    if public.script_stage_rank(new.stage) >= public.script_stage_rank('recorded') then
      new.status := 'recorded';
    elsif old.status = 'recorded' then
      new.status := 'ready';
    end if;
  end if;

  return new;
end;
$$;

-- 每一列「变了就记一条」。用 jsonb 逐列比，数字、日期、布尔都转成文字存；数组单独处理。
-- 不记：updated_at、stats_at、last_note_*、*_seen_at、edited_by（红点和统计时间，不是内容）
create or replace function public.scripts_log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  col text;
  old_j jsonb;
  new_j jsonb;
  tracked constant text[] := array[
    'title', 'body', 'record_by', 'status', 'publish_on', 'stage', 'kind', 'is_extra',
    'series', 'episode', 'media_url', 'cover_path', 'xhs_title', 'xhs_body',
    'published_url', 'likes', 'saves', 'comments'
  ];
begin
  if tg_op = 'DELETE' then
    insert into public.script_changes (script_id, org_id, actor_id, action, old_value)
    values (old.id, old.org_id, coalesce(auth.uid(), old.edited_by), 'delete',
            coalesce(old.title, '') || E'\n\n' || coalesce(old.body, ''));
    return old;
  end if;

  actor := coalesce(auth.uid(), new.edited_by);
  if tg_op = 'INSERT' then
    insert into public.script_changes (script_id, org_id, actor_id, action, new_value)
    values (new.id, new.org_id, actor, 'create', new.title);
    return new;
  end if;

  old_j := to_jsonb(old);
  new_j := to_jsonb(new);
  foreach col in array tracked loop
    if new_j -> col is distinct from old_j -> col then
      insert into public.script_changes (script_id, org_id, actor_id, action, field, old_value, new_value)
      values (new.id, new.org_id, actor, 'update', col, old_j ->> col, new_j ->> col);
    end if;
  end loop;

  if new.xhs_tags is distinct from old.xhs_tags then
    insert into public.script_changes (script_id, org_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.org_id, actor, 'update', 'xhs_tags',
            array_to_string(old.xhs_tags, ','), array_to_string(new.xhs_tags, ','));
  end if;
  return new;
end;
$$;

-- 触发器本身第二期已建好（函数换了内容，绑定不用动）；这里保证它们都在，重复跑也安全
drop trigger if exists scripts_before_insert on public.scripts;
create trigger scripts_before_insert
  before insert on public.scripts
  for each row execute function public.scripts_before_insert();

drop trigger if exists scripts_before_update on public.scripts;
create trigger scripts_before_update
  before update on public.scripts
  for each row execute function public.scripts_before_update();

drop trigger if exists scripts_log_change on public.scripts;
create trigger scripts_log_change
  after insert or update on public.scripts
  for each row execute function public.scripts_log_change();

drop trigger if exists scripts_log_delete on public.scripts;
create trigger scripts_log_delete
  before delete on public.scripts
  for each row execute function public.scripts_log_change();

-- 4. 删第 2 版的旧表 ---------------------------------------------------------
-- 里面只有 3 条测试数据，不迁。organizations.post_weekdays 保留（固定发布日还在用）

drop table if exists public.post_notes;
drop table if exists public.posts;
