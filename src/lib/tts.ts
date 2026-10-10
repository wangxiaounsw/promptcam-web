import { createHash, randomBytes } from 'node:crypto';
import { admin } from '@/lib/auth';

/**
 * 口播稿朗读:Fish Audio 的「女大学生」声音。
 * 生成一次存到 Supabase Storage,网站上按权限给链接。
 */
export const FISH_VOICE = '5c353fdb312f4888836a9a5680099ef0';
export const ttsReady = Boolean(process.env.FISH_API_KEY);

export function scriptHash(script: string): string {
  return createHash('sha256').update(script.trim()).digest('hex').slice(0, 16);
}

export async function synthesize(text: string): Promise<Buffer> {
  const key = process.env.FISH_API_KEY ?? '';
  if (!key) throw new Error('FISH_API_KEY 没配');
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      model: 's1',
    },
    body: JSON.stringify({
      text,
      reference_id: FISH_VOICE,
      format: 'mp3',
      mp3_bitrate: 128,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Fish Audio ${res.status}: ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * 上传到公开桶。文件名带 16 位随机串 —— 桶是公开的,但链接猜不到,
 * 只有网站接口确认权限后才给出。旧文件顺手删掉,免得越攒越多。
 */
export async function storeAudio(
  code: string,
  mp3: Buffer,
  previousUrl: string | null,
): Promise<string> {
  const db = admin();
  const name = `${code.toLowerCase()}-${randomBytes(8).toString('hex')}.mp3`;
  const { error } = await db.storage
    .from('idea-audio')
    .upload(name, mp3, { contentType: 'audio/mpeg', upsert: false });
  if (error) throw new Error(`上传失败: ${error.message}`);
  if (previousUrl) {
    const old = previousUrl.split('/idea-audio/')[1];
    if (old) await db.storage.from('idea-audio').remove([old]).catch(() => {});
  }
  return db.storage.from('idea-audio').getPublicUrl(name).data.publicUrl;
}
