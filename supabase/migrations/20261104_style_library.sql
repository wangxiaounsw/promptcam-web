-- 风格库（app.fordexa.com/library）的媒体和 manifest.json。
-- 公开桶：内容都是王小墨自己的样张，不是秘密（Shawn 2026-11-04）；只要求不被搜索引擎收录，那在页面和 robots.ts 里做。
-- 不加任何写策略：只有 scripts/library-upload.mjs 用 service key 写。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('style-library', 'style-library', true, 15728640, array['image/jpeg', 'video/mp4', 'application/json'])
on conflict (id) do nothing;
