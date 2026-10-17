// 一次性检查：.env.local 里的 FISH_API_KEY 能不能用 Shawn 的私有声音合成，
// 以及账号下有几个自己的声音。只打印状态码、字节数和数量，不打印 key。
// 用法：node scripts/fish-smoke.mjs [输出目录]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VOICE = '8382e1c04b8f4e56b91a8e30be619e49';

function envKey(name) {
  const line = readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, '') : '';
}

const key = envKey('FISH_API_KEY');
if (!key) {
  console.error('FISH_API_KEY 不在 .env.local 里');
  process.exit(1);
}

const tts = await fetch('https://api.fish.audio/v1/tts', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', model: 's1' },
  body: JSON.stringify({ text: '这是一句测试。', reference_id: VOICE, format: 'mp3', mp3_bitrate: 128 }),
});
const audio = Buffer.from(await tts.arrayBuffer());
console.log(`tts: ${tts.status} ${audio.length} bytes`);
if (!tts.ok) console.log(audio.toString('utf8').slice(0, 300));
else if (process.argv[2]) writeFileSync(join(process.argv[2], 'fish-smoke.mp3'), audio);

const models = await fetch('https://api.fish.audio/model?self=true&page_size=50', {
  headers: { Authorization: `Bearer ${key}` },
});
const body = await models.json().catch(() => ({}));
const items = Array.isArray(body.items) ? body.items : [];
console.log(`models: ${models.status} total=${body.total} mine=${items.length}`);
console.log(`has Shawn voice: ${items.some((m) => m._id === VOICE)}`);
for (const m of items) console.log(`  ${m._id} ${m.visibility} ${m.state} ${m.title}`);
