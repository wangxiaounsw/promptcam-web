-- 工作台第二期：稿子按公司共享、修改留痕、Fordexa 稿占用、反馈、头像
-- 设计：docs/superpowers/specs/2026-10-19-studio-companies-design.md
--
-- 顺序要紧：先加列、回填，最后才建触发器 —— 否则回填本身会被记成一大堆「修改」。
-- App 直接写 scripts（带用户令牌），所以补公司、锁主人、记修改、占稿全放在触发器里，
-- App 那条路也一样管得住。网页接口用 service key，auth.uid() 为空，靠 edited_by 告诉触发器是谁。

-- 1. 加列、建表 ---------------------------------------------------------------

alter table public.scripts add column if not exists org_id uuid references public.organizations(id);
alter table public.scripts add column if not exists created_by uuid references public.profiles(id);
alter table public.scripts add column if not exists edited_by uuid;
create index if not exists scripts_org_id_idx on public.scripts (org_id);

-- 修改记录。script_id 不加外键：稿子删了，记录还要留着
create table if not exists public.script_changes (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null,
  org_id uuid,
  actor_id uuid,
  at timestamptz not null default now(),
  action text not null check (action in ('create', 'update', 'delete')),
  field text check (field in ('title', 'body', 'record_by', 'status')),
  old_value text,
  new_value text
);
create index if not exists script_changes_script_idx on public.script_changes (script_id, at desc);
alter table public.script_changes enable row level security;

-- 一个选题的 Fordexa 稿只归一家公司
create table if not exists public.fordexa_claims (
  code text primary key,
  org_id uuid not null,
  script_id uuid,
  claimed_by uuid,
  claimed_at timestamptz not null default now()
);
alter table public.fordexa_claims enable row level security;

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  org_id uuid,
  page_url text,
  message text not null,
  image_paths text[],
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists bug_reports_status_idx on public.bug_reports (status, created_at desc);
create index if not exists bug_reports_reporter_idx on public.bug_reports (reporter_id, created_at desc);
alter table public.bug_reports enable row level security;

alter table public.profiles add column if not exists avatar_path text;

-- 头像不敏感，公开桶
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. 回填 --------------------------------------------------------------------

update public.scripts s
set org_id = p.org_id
from public.profiles p
where p.id = s.user_id and s.org_id is null;

update public.scripts set created_by = user_id where created_by is null;

-- 每个选题编号：最早拉走它的那家公司占着
insert into public.fordexa_claims (code, org_id, script_id, claimed_by, claimed_at)
select distinct on (code) code, org_id, id, user_id, created_at
from public.scripts
where source = 'fordexa' and code is not null and org_id is not null
order by code, created_at
on conflict (code) do nothing;

-- 3. 触发器 ------------------------------------------------------------------

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

  new.org_id := coalesce(new.org_id, (select org_id from public.profiles where id = new.user_id));
  new.created_by := coalesce(new.created_by, auth.uid(), new.user_id);

  if new.source = 'fordexa' and new.code is not null and new.org_id is not null then
    insert into public.fordexa_claims (code, org_id, script_id, claimed_by)
    values (new.code, new.org_id, new.id, coalesce(new.edited_by, auth.uid(), new.user_id))
    on conflict (code) do nothing;
    -- 别家已经占了：只给标题和选题，正文留空让他们自己写
    if (select org_id from public.fordexa_claims where code = new.code) <> new.org_id then
      new.body := '';
      new.source := 'self';
    end if;
  end if;
  return new;
end;
$$;

-- App 每次保存都写 user_id = 当前用户：主人、公司、谁放的一律保持原值
create or replace function public.scripts_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := old.user_id;
  new.org_id := coalesce(old.org_id, new.org_id);
  new.created_by := coalesce(old.created_by, new.created_by);
  return new;
end;
$$;

create or replace function public.scripts_log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
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

  if new.title is distinct from old.title then
    insert into public.script_changes (script_id, org_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.org_id, actor, 'update', 'title', old.title, new.title);
  end if;
  if new.body is distinct from old.body then
    insert into public.script_changes (script_id, org_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.org_id, actor, 'update', 'body', old.body, new.body);
  end if;
  if new.record_by is distinct from old.record_by then
    insert into public.script_changes (script_id, org_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.org_id, actor, 'update', 'record_by', old.record_by::text, new.record_by::text);
  end if;
  if new.status is distinct from old.status then
    insert into public.script_changes (script_id, org_id, actor_id, action, field, old_value, new_value)
    values (new.id, new.org_id, actor, 'update', 'status', old.status::text, new.status::text);
  end if;
  return new;
end;
$$;

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
