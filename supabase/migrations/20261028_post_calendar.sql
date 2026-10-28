-- 发布日历：每家公司一本，月历上一格一条小红书内容（posts），以及条目下的备注（post_notes）。
-- 设计：docs/superpowers/specs/2026-10-27-content-calendar-design.md
-- 只走 /api/studio/posts*（service key），所以开 RLS 不加策略，和工作台其他表一样。
-- 全部用 if not exists / on conflict 写法，可以重复跑。

-- 固定发布日（1 = 周一 … 7 = 周日）。空数组 = 没有固定日。
alter table public.organizations add column if not exists post_weekdays int[] not null default '{}';

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  publish_on date,
  kind text not null default 'video' check (kind in ('video', 'image')),
  is_extra boolean not null default false,
  title text not null,
  series text,
  episode int,
  stage text not null default 'planned' check (stage in ('planned','script','voice','cut','ready','published')),
  media_url text,
  cover_path text,
  script_id uuid references public.scripts(id) on delete set null,
  xhs_title text not null default '',
  xhs_body text not null default '',
  xhs_tags text[] not null default '{}',
  published_url text,
  published_at timestamptz,
  likes int, saves int, comments int,
  stats_at timestamptz,
  last_note_at timestamptz,
  last_note_by_admin boolean,
  admin_seen_at timestamptz,
  client_seen_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_org_day_idx on public.posts (org_id, publish_on);
create index if not exists posts_org_series_idx on public.posts (org_id, series);
alter table public.posts enable row level security;

-- 备注：管理员和客户都能写。kind = system 是自动记的（比如撤回已发布）。
create table if not exists public.post_notes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  org_id uuid not null,
  author_id uuid,
  kind text not null default 'note' check (kind in ('note', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_notes_post_idx on public.post_notes (post_id, created_at);
alter table public.post_notes enable row level security;

-- 王小墨的固定发布日：周二、周五。其他公司留空，之后在日历页手动设。
update public.organizations set post_weekdays = '{2,5}'
where name = '王小墨' and post_weekdays = '{}';
