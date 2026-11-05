// 把 xhs-video 渲染好的风格库传到公开桶 style-library（app.fordexa.com/library 读它）。
//   node --env-file=.env.local scripts/library-upload.mjs C:/Users/habit/xhs-video/tmp/library --dry-run
// 先 --dry-run 给 Shawn 看「新增 / 换图 / 下架」，他同意再去掉 --dry-run。顺序：新文件 → manifest → 删上上次换下来的旧文件
// （上次换下来的多留一轮，见 library-upload-lib.mjs）。编号对不上桶里的版本（换了来源、下架又拿回来）就停下。
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { LIBRARY_BUCKET, parseManifest } from '../src/lib/library.ts';
import { assertSameSources, planUpload } from './library-upload-lib.mjs';

const [dir, ...flags] = process.argv.slice(2);
if (!dir) throw new Error('usage: node --env-file=.env.local scripts/library-upload.mjs <xhs-video/tmp/library> [--dry-run]');
const dry = flags.includes('--dry-run');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('缺 SUPABASE_URL / SUPABASE_SERVICE_KEY（用 --env-file=.env.local）');

const TYPES = { '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json' };
const must = (r, what) => {
  if (!r.ok) throw new Error(`${what}：${r.reason}`);
  return r.items;
};

const localRaw = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const local = must(parseManifest(localRaw), '本地 manifest 不对');
for (const f of local.flatMap((i) => [i.file, i.poster].filter(Boolean))) {
  if (!fs.existsSync(path.join(dir, f))) throw new Error(`本地缺文件 ${f}，先在 xhs-video 跑 npm run library`);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = db.storage.from(LIBRARY_BUCKET);
const got = await bucket.download('manifest.json');
let remote = null;
let remoteRaw = null;
if (!got.error) {
  // a broken manifest in the bucket must not block the upload that repairs it: warn, upload as if first, delete nothing
  try {
    remoteRaw = JSON.parse(await got.data.text());
    remote = must(parseManifest(remoteRaw), '桶里的 manifest 不对');
  } catch (e) {
    console.warn(`⚠ 桶里的 manifest 坏了（${e instanceof Error ? e.message : e}），这次整份覆盖、不删任何文件，也没法比对编号。`);
    remote = null;
    remoteRaw = null;
  }
} else if (!/not.?found|does not exist|404/i.test(`${got.error.message} ${got.error.status ?? ''} ${got.error.statusCode ?? ''}`)) {
  throw new Error(`读桶里的 manifest 失败：${got.error.message}`);
}

assertSameSources(localRaw, remoteRaw);
const plan = planUpload(local, remote, Array.isArray(remoteRaw?.keep) ? remoteRaw.keep : []);
const manifestOut = Buffer.from(JSON.stringify({ ...localRaw, keep: plan.keep }, null, 1));
const nameOf = new Map([...(remote ?? []), ...local].map((i) => [i.code, i.name]));
const show = (label, codes) => console.log(`${label} ${codes.length}：${codes.map((c) => `${c} ${nameOf.get(c)}`).join('、') || '—'}`);
console.log(remote ? `桶里现在 ${remote.length} 条，本地 ${local.length} 条` : `第一次上传，本地 ${local.length} 条`);
show('新增', plan.added);
show('换图', plan.replaced);
show('下架', plan.retired);
console.log(`要传 ${plan.steps.filter((s) => s.op === 'put').length} 个文件，删 ${plan.steps.filter((s) => s.op === 'delete').length} 个`);
if (dry) console.log('\n--dry-run：什么都没传。');
else await run(plan.steps);

// process.exit with fetch sockets still open trips a libuv assertion on Windows, so a failure sets exitCode and returns
async function run(steps) {
  for (const [k, s] of steps.entries()) {
    const where = `第 ${k + 1}/${steps.length} 步 ${s.op} ${s.path}`;
    const res = s.op === 'delete'
      ? await bucket.remove([s.path])
      : await bucket.upload(s.path, s.path === 'manifest.json' ? manifestOut : fs.readFileSync(path.join(dir, s.path)), {
        contentType: TYPES[path.extname(s.path)] ?? 'application/octet-stream',
        cacheControl: s.path === 'manifest.json' ? '60' : '31536000',
        upsert: true,
      });
    if (res.error) {
      console.error(`✘ ${where} 失败：${res.error.message}。前面的步骤已经做了，重跑一次会从头比对、接着传。`);
      process.exitCode = 1;
      return;
    }
    console.log(`✔ ${where}`);
  }
  console.log('完成。页面 5 分钟内跟上：https://app.fordexa.com/library');
}
