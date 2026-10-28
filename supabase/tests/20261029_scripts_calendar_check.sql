-- 触发器检查：20261029_scripts_calendar.sql 的 BEFORE INSERT / BEFORE UPDATE / 记录触发器
-- 用法：整个文件原样交给 execute_sql（一条 DO 语句，本身就是一个事务，不用再包 begin/rollback）。
-- 不管过没过都会回滚、不留任何测试数据：
--   * 全部通过 → 故意抛 'checks passed — rolled back on purpose'（这就是「通过」，报错信息必须一字不差）；
--   * 任何一条不满足 → 抛别的异常，信息里写明是哪一条。
-- 所以这个脚本「失败」且信息恰好是 'checks passed — rolled back on purpose' = 全部检查通过。
-- 用王小墨公司和它的第一个成员；公司「提前几天录完」在事务里临时设成 5（回滚后不留痕）。

do $$
declare
  oid uuid;
  uid uuid;
  sid uuid := gen_random_uuid();
  sid2 uuid := gen_random_uuid();
  sid3 uuid := gen_random_uuid();
  sid4 uuid := gen_random_uuid();
  sid5 uuid := gen_random_uuid();
  sid6 uuid := gen_random_uuid();
  sid7 uuid := gen_random_uuid();
  sid8 uuid := gen_random_uuid();
  sid9 uuid := gen_random_uuid();
  r record;
  n int;
  n2 int;
begin
  select id into oid from public.organizations where name = '王小墨';
  if oid is null then
    raise exception '找不到公司「王小墨」';
  end if;
  select id into uid from public.profiles where org_id = oid order by created_at limit 1;
  if uid is null then
    raise exception '王小墨公司下没有成员，无法造测试稿子';
  end if;
  update public.organizations set record_lead_days = 5 where id = oid;

  -- 1. 插入 publish_on = 2026-11-03 的视频 → record_by = 2026-10-29
  insert into public.scripts (id, user_id, org_id, title, body, source, status, stage, kind, publish_on, edited_by)
  values (sid, uid, oid, '检查用稿子', '正文', 'self', 'ready', 'final', 'video', '2026-11-03', uid);
  select * into r from public.scripts where id = sid;
  if r.record_by is distinct from date '2026-10-29' then
    raise exception '[1] 插入视频：record_by 应为 2026-10-29，实际 %', r.record_by;
  end if;

  -- 2. 改 publish_on = 2026-11-06 → record_by = 2026-11-01，两条记录的 actor 都是 edited_by
  update public.scripts set publish_on = '2026-11-06', edited_by = uid where id = sid;
  select * into r from public.scripts where id = sid;
  if r.record_by is distinct from date '2026-11-01' then
    raise exception '[2] 改发布日期：record_by 应为 2026-11-01，实际 %', r.record_by;
  end if;
  select count(*) into n from public.script_changes
  where script_id = sid and action = 'update' and field = 'publish_on' and actor_id = uid
    and old_value = '2026-11-03' and new_value = '2026-11-06';
  if n <> 1 then
    raise exception '[2] script_changes 里应有 1 条 publish_on（actor = edited_by），实际 %', n;
  end if;
  select count(*) into n from public.script_changes
  where script_id = sid and action = 'update' and field = 'record_by' and actor_id = uid
    and old_value = '2026-10-29' and new_value = '2026-11-01';
  if n <> 1 then
    raise exception '[2] script_changes 里应有 1 条 record_by（actor = edited_by），实际 %', n;
  end if;

  -- 3. 手动改 record_by，再改 xhs_title → record_by 不被冲掉
  update public.scripts set record_by = '2026-11-02', edited_by = uid where id = sid;
  update public.scripts set xhs_title = '小红书标题', edited_by = uid where id = sid;
  select * into r from public.scripts where id = sid;
  if r.record_by is distinct from date '2026-11-02' then
    raise exception '[3] 手动 record_by 被冲掉：应为 2026-11-02，实际 %', r.record_by;
  end if;
  select count(*) into n from public.script_changes
  where script_id = sid and field = 'xhs_title' and new_value = '小红书标题' and actor_id = uid;
  if n <> 1 then
    raise exception '[3] xhs_title 的修改应记 1 条，实际 %', n;
  end if;

  -- 4. App 点「已录」：status = recorded，stage 原为 final → stage = recorded
  update public.scripts set status = 'recorded', edited_by = uid where id = sid;
  select * into r from public.scripts where id = sid;
  if r.stage is distinct from 'recorded' or r.status is distinct from 'recorded' then
    raise exception '[4] App 点已录：应为 stage=recorded, status=recorded，实际 %, %', r.stage, r.status;
  end if;

  -- 5. stage = cut 时 App 写回 status = ready → 保持 recorded，stage 仍是 cut
  update public.scripts set stage = 'cut', edited_by = uid where id = sid;
  select * into r from public.scripts where id = sid;
  if r.stage is distinct from 'cut' or r.status is distinct from 'recorded' then
    raise exception '[5a] 网页设成片：应为 stage=cut, status=recorded，实际 %, %', r.stage, r.status;
  end if;
  update public.scripts set status = 'ready', edited_by = uid where id = sid;
  select * into r from public.scripts where id = sid;
  if r.stage is distinct from 'cut' or r.status is distinct from 'recorded' then
    raise exception '[5b] 成片被 App 旧数据写回 ready：应保持 stage=cut, status=recorded，实际 %, %', r.stage, r.status;
  end if;

  -- 5c. 被拒绝的 status 改动不写 status 记录（recorded -> ready 一条都不该有）
  select count(*) into n from public.script_changes
  where script_id = sid and field = 'status' and old_value = 'recorded' and new_value = 'ready';
  if n <> 0 then
    raise exception '[5c] 被拒绝的 status 改动不应写记录，实际 % 条', n;
  end if;

  -- 5d. App 真实的保存路径：以登录用户（authenticated + jwt）的身份，只写 8 列的 upsert，拿旧数据（status = ready）整行写回
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  insert into public.scripts (id, user_id, title, body, source, status, sort_order, code)
  values (sid, uid, '检查用稿子', '正文', 'self', 'ready', 0, null)
  on conflict (id) do update set
    title = excluded.title, body = excluded.body, source = excluded.source,
    status = excluded.status, sort_order = excluded.sort_order, code = excluded.code,
    user_id = excluded.user_id;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  select * into r from public.scripts where id = sid;
  if r.stage is distinct from 'cut' or r.status is distinct from 'recorded' then
    raise exception '[5d] App upsert 写回 ready：应保持 stage=cut, status=recorded，实际 %, %', r.stage, r.status;
  end if;
  if r.publish_on is distinct from date '2026-11-06' or r.record_by is distinct from date '2026-11-02'
     or r.xhs_title is distinct from '小红书标题' or r.org_id is distinct from oid then
    raise exception '[5d] App upsert 不该动日期 / 标题 / 公司：publish_on=%, record_by=%, xhs_title=%, org_id=%',
      r.publish_on, r.record_by, r.xhs_title, r.org_id;
  end if;
  select count(*) into n from public.script_changes
  where script_id = sid and field = 'status' and old_value = 'recorded' and new_value = 'ready';
  if n <> 0 then
    raise exception '[5d] App upsert 被拒绝的 status 不应写记录，实际 % 条', n;
  end if;

  -- 5e. App 用新 id 只写 8 列 upsert（同样以登录用户身份，走 auth.uid() 分支）：能成功，stage = draft, kind = video
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  insert into public.scripts (id, user_id, title, body, source, status, sort_order, code)
  values (sid4, uid, '检查用稿子 4', '正文', 'self', 'ready', 0, null)
  on conflict (id) do update set
    title = excluded.title, body = excluded.body, source = excluded.source,
    status = excluded.status, sort_order = excluded.sort_order, code = excluded.code,
    user_id = excluded.user_id;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  select * into r from public.scripts where id = sid4;
  if r.stage is distinct from 'draft' or r.kind is distinct from 'video' or r.org_id is distinct from oid then
    raise exception '[5e] 新 id upsert：应为 stage=draft, kind=video, org_id=王小墨，实际 %, %, %', r.stage, r.kind, r.org_id;
  end if;

  -- 5f. 规则 c：定稿 / ready 的稿子 finalized_at 被写上 -> stage 和 status 都是 recorded
  update public.scripts set stage = 'final', edited_by = uid where id = sid4;
  update public.scripts set finalized_at = now(), edited_by = uid where id = sid4;
  select * into r from public.scripts where id = sid4;
  if r.stage is distinct from 'recorded' or r.status is distinct from 'recorded' then
    raise exception '[5f] finalized_at 写上：应为 stage=recorded, status=recorded，实际 %, %', r.stage, r.status;
  end if;

  -- 5f2. 已发给 Fordexa（finalized_at 有值）的稿子，App 拿旧数据（status = ready）8 列 upsert 写回
  --       -> stage / status 保持 recorded，不被降回定稿
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  insert into public.scripts (id, user_id, title, body, source, status, sort_order, code)
  values (sid4, uid, '检查用稿子 4', '正文', 'self', 'ready', 0, null)
  on conflict (id) do update set
    title = excluded.title, body = excluded.body, source = excluded.source,
    status = excluded.status, sort_order = excluded.sort_order, code = excluded.code,
    user_id = excluded.user_id;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  select * into r from public.scripts where id = sid4;
  if r.stage is distinct from 'recorded' or r.status is distinct from 'recorded' then
    raise exception '[5f2] 已发给 Fordexa 的稿子被 App 旧数据写回 ready：应保持 stage=recorded, status=recorded，实际 %, %', r.stage, r.status;
  end if;

  -- 5g. 改不记录的列（admin_seen_at）不写记录；改 xhs_tags 要记一条
  select count(*) into n from public.script_changes where script_id = sid;
  update public.scripts set admin_seen_at = now(), last_note_at = now(), edited_by = uid where id = sid;
  select count(*) into n2 from public.script_changes where script_id = sid;
  if n2 <> n then
    raise exception '[5g] 改 admin_seen_at / last_note_at 不应写记录，多了 % 条', n2 - n;
  end if;
  update public.scripts set xhs_tags = '{a,b}', edited_by = uid where id = sid;
  select count(*) into n from public.script_changes
  where script_id = sid and field = 'xhs_tags' and new_value = 'a,b' and actor_id = uid;
  if n <> 1 then
    raise exception '[5g] xhs_tags 的修改应记 1 条，实际 %', n;
  end if;

  -- 6. stage = recorded 时 status = ready（客户在 App 里取消已录）→ stage = final
  update public.scripts set stage = 'recorded', edited_by = uid where id = sid;
  update public.scripts set status = 'ready', edited_by = uid where id = sid;
  select * into r from public.scripts where id = sid;
  if r.stage is distinct from 'final' or r.status is distinct from 'ready' then
    raise exception '[6] 取消已录：应为 stage=final, status=ready，实际 %, %', r.stage, r.status;
  end if;

  -- 7. 原 status = recorded，网页把 stage 退到 refining → status = ready
  update public.scripts set stage = 'recorded', edited_by = uid where id = sid;
  select * into r from public.scripts where id = sid;
  if r.status is distinct from 'recorded' then
    raise exception '[7a] 网页设已录：status 应同步为 recorded，实际 %', r.status;
  end if;
  update public.scripts set stage = 'refining', edited_by = uid where id = sid;
  select * into r from public.scripts where id = sid;
  if r.stage is distinct from 'refining' or r.status is distinct from 'ready' then
    raise exception '[7b] 退回精修：应为 stage=refining, status=ready，实际 %, %', r.stage, r.status;
  end if;

  -- 8. 改成图文 → record_by 清空（此前它是手动设的 2026-11-02）；已录退回定稿
  update public.scripts set stage = 'recorded', edited_by = uid where id = sid;
  update public.scripts set kind = 'image', edited_by = uid where id = sid;
  select * into r from public.scripts where id = sid;
  if r.record_by is not null then
    raise exception '[8] 改成图文：record_by 应为空，实际 %', r.record_by;
  end if;
  if r.stage is distinct from 'final' or r.status is distinct from 'ready' then
    raise exception '[8] 已录改成图文：应退回 stage=final, status=ready，实际 %, %', r.stage, r.status;
  end if;

  -- 9. 清空发布日期 → record_by 清空（另用一条视频，确保清空前 record_by 不为空）
  insert into public.scripts (id, user_id, org_id, title, body, source, status, stage, kind, publish_on, edited_by)
  values (sid2, uid, oid, '检查用稿子 2', '正文', 'self', 'ready', 'draft', 'video', '2026-11-03', uid);
  select * into r from public.scripts where id = sid2;
  if r.record_by is distinct from date '2026-10-29' then
    raise exception '[9] 前置：record_by 应为 2026-10-29，实际 %', r.record_by;
  end if;
  update public.scripts set publish_on = null, edited_by = uid where id = sid2;
  select * into r from public.scripts where id = sid2;
  if r.record_by is not null then
    raise exception '[9] 清空发布日期：record_by 应为空，实际 %', r.record_by;
  end if;

  -- 10. 额外：图文插入时不算 record_by；跨夏令时（2026-10-04 澳洲夏令时开始）仍是整整 5 天
  insert into public.scripts (id, user_id, org_id, title, body, source, status, kind, publish_on, edited_by)
  values (sid3, uid, oid, '检查用图文', '', 'self', 'ready', 'image', '2026-11-03', uid);
  select * into r from public.scripts where id = sid3;
  if r.record_by is not null then
    raise exception '[10] 图文插入：record_by 应为空，实际 %', r.record_by;
  end if;
  update public.scripts set kind = 'video', publish_on = '2026-10-06', edited_by = uid where id = sid3;
  select * into r from public.scripts where id = sid3;
  if r.record_by is distinct from date '2026-10-01' then
    raise exception '[10] 跨夏令时：2026-10-06 减 5 天应为 2026-10-01，实际 %', r.record_by;
  end if;

  -- 11. 图文带日期，改回视频 -> record_by 重新算出来
  insert into public.scripts (id, user_id, org_id, title, body, source, status, kind, publish_on, edited_by)
  values (sid5, uid, oid, '检查用图文 2', '', 'self', 'ready', 'image', '2026-11-03', uid);
  update public.scripts set kind = 'video', edited_by = uid where id = sid5;
  select * into r from public.scripts where id = sid5;
  if r.record_by is distinct from date '2026-10-29' then
    raise exception '[11] 图文改回视频：record_by 应为 2026-10-29，实际 %', r.record_by;
  end if;

  -- 12. 已归档的稿子网页往前推进度，不能被放出来
  insert into public.scripts (id, user_id, org_id, title, body, source, status, edited_by)
  values (sid6, uid, oid, '检查用稿子 6', '', 'self', 'archived', uid);
  update public.scripts set stage = 'cut', edited_by = uid where id = sid6;
  select * into r from public.scripts where id = sid6;
  if r.status is distinct from 'archived' then
    raise exception '[12] 已归档的稿子被改了 status：%', r.status;
  end if;

  -- 13. 插入路径：App 直接插入 status = recorded，或带 finalized_at -> stage = recorded；图文不推
  insert into public.scripts (id, user_id, org_id, title, body, source, status, edited_by)
  values (sid7, uid, oid, '检查用稿子 7', '', 'self', 'recorded', uid);
  select * into r from public.scripts where id = sid7;
  if r.stage is distinct from 'recorded' then
    raise exception '[13a] 插入 status=recorded：stage 应为 recorded，实际 %', r.stage;
  end if;
  insert into public.scripts (id, user_id, org_id, title, body, source, status, finalized_at, edited_by)
  values (sid8, uid, oid, '检查用稿子 8', '', 'self', 'ready', now(), uid);
  select * into r from public.scripts where id = sid8;
  if r.stage is distinct from 'recorded' then
    raise exception '[13b] 插入带 finalized_at：stage 应为 recorded，实际 %', r.stage;
  end if;
  insert into public.scripts (id, user_id, org_id, title, body, source, status, kind, edited_by)
  values (sid9, uid, oid, '检查用图文 3', '', 'self', 'recorded', 'image', uid);
  select * into r from public.scripts where id = sid9;
  if r.stage is distinct from 'draft' then
    raise exception '[13c] 图文插入：stage 不该被推到已录，实际 %', r.stage;
  end if;

  -- 全部通过：故意抛异常让整个事务回滚（通过也不留测试行）
  raise exception 'checks passed — rolled back on purpose';
end;
$$;
