-- 主页预览：每家公司一份小红书主页的样子 + 若干笔记封面，给客户演示「做完之后主页长什么样」。
-- 只走 /api/studio/showcase（service key），所以开 RLS 不加策略，和工作台其他表一样。
-- 图片放现有私有桶 studio-private 的 showcase/<org_id>/ 下，页面拿一小时的签名链接。

create table if not exists public.xhs_showcases (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  name text not null default '账号名称',
  red_id text not null default '',
  ip text not null default '澳大利亚',
  follows text not null default '0',
  fans text not null default '0',
  likes text not null default '0',
  bio text not null default '',
  tags text[] not null default '{}',
  collections text[] not null default '{}',
  frame text not null default 'orange' check (frame in ('orange', 'blue', 'silver')),
  avatar_path text,
  bg_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.xhs_showcases enable row level security;

create table if not exists public.xhs_showcase_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  image_path text not null,
  title text not null default '',
  likes text not null default '',
  date_label text not null default '',
  is_video boolean not null default true,
  position integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists xhs_showcase_notes_org_idx on public.xhs_showcase_notes (org_id, position);
alter table public.xhs_showcase_notes enable row level security;
