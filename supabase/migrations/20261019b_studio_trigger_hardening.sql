-- 复审修复：触发器不能信客户端传来的 org_id / created_by
--
-- 带用户令牌的写入（App，或任何人直接打 PostgREST）：公司一律取这个人自己的公司，
-- 「谁放的」一律是这个人自己 —— 否则谁都能往别家公司的口播库里塞稿子、冒充 Shawn 放的。
-- 只有 service key（网页接口，auth.uid() 为空）才能指定公司和「谁放的」，接口里已经核对过权限。

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
  return new;
end;
$$;

-- 主人、公司、谁放的保持原值。公司原来为空的，只有 service key 能补上
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
  return new;
end;
$$;
