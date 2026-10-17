-- 口播工作台（第一期）
-- 设计：docs/superpowers/specs/2026-10-17-script-studio-design.md
-- 全部可重复执行。新列一律可空 —— App 的 upsert 只写它认识的字段，不能被新列卡住。

-- 1. 稿子：录完日期、试听音频、当前正文的核对结果
alter table public.scripts add column if not exists record_by date;
alter table public.scripts add column if not exists audio_path text;
alter table public.scripts add column if not exists audio_hash text;
alter table public.scripts add column if not exists audio_at timestamptz;
alter table public.scripts add column if not exists checks jsonb;

-- 2. 版本：Fordexa 原版 (n = 0) + 每次「按我的风格生成」(n = 1, 2, ...)
create table if not exists public.script_versions (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('fordexa', 'generated')),
  n int not null,
  body text not null,
  prompt text,
  checks jsonb,
  created_at timestamptz not null default now(),
  unique (script_id, n)
);
create index if not exists script_versions_script_id_idx on public.script_versions (script_id);
-- 只走服务端（service key），不给客户端任何 policy
alter table public.script_versions enable row level security;

-- 3. 声音与写稿提示词 B
alter table public.profiles add column if not exists voice_id text;
alter table public.organizations add column if not exists voice_id text;
alter table public.organizations add column if not exists draft_prompt text;

-- 4. 私有桶：个人试听音频 + 训练录音（播放用短期签名链接）
insert into storage.buckets (id, name, public)
values ('studio-private', 'studio-private', false)
on conflict (id) do nothing;

-- 5. Shawn 的声音（仅当还没设过）
update public.profiles p
set voice_id = '8382e1c04b8f4e56b91a8e30be619e49'
from auth.users u
where u.id = p.id
  and u.email = 'wangxiaounsw@gmail.com'
  and p.voice_id is null;
