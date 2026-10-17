import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { admin } from '@/lib/auth';
import { resolveVoice } from '@/lib/voice';
import { PRIVATE_BUCKET, removePrivate } from '@/lib/studio/audio';
import { json, requireStudioUser } from '@/lib/studio/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILES = 20;
const SLOT_LIMIT = 10; // Plus 套餐：整个账号 10 个私有声音

/** 账号下已经有几个自己的声音；取不到返回 null */
async function usedSlots(): Promise<number | null> {
  try {
    const res = await fetch('https://api.fish.audio/model?self=true&page_size=1', {
      headers: { Authorization: `Bearer ${process.env.FISH_API_KEY ?? ''}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as { total?: number };
    return res.ok && typeof body.total === 'number' ? body.total : null;
  } catch {
    return null;
  }
}

/**
 * 第一步：给每段录音发一个签名上传地址。录音由浏览器直传私有桶 ——
 * Vercel 函数的请求体只有 4.5MB，几段录音塞不进来。
 */
export async function POST(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let body: { files?: { name?: unknown; type?: unknown }[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length || files.length > MAX_FILES) return json({ error: `录音要 1 到 ${MAX_FILES} 段` }, 400);
  if (files.some((f) => !String(f.type ?? '').startsWith('audio/'))) return json({ error: '只能传音频文件' }, 400);

  const uploads = [];
  for (const f of files) {
    const safe = String(f.name ?? 'audio').replace(/[^\w.-]/g, '_').slice(-60);
    const path = `training/${user.id}/${randomBytes(6).toString('hex')}-${safe}`;
    const { data, error } = await admin().storage.from(PRIVATE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return json({ error: '准备上传失败' }, 502);
    uploads.push({ path, token: data.token, signedUrl: data.signedUrl });
  }
  return json({ uploads, slots: { used: await usedSlots(), limit: SLOT_LIMIT } });
}

/** 第二步：录音传完了，交给 Fish 建一个私有声音（fast 模式，建完即可用），设成我的声音 */
export async function PUT(request: NextRequest) {
  const user = await requireStudioUser(request);
  if (!user) return json({ error: 'Not authorised.' }, 403);

  let body: { paths?: unknown; title?: unknown; texts?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const paths = Array.isArray(body.paths) ? body.paths.map(String) : [];
  const mine = `training/${user.id}/`;
  if (!paths.length || paths.length > MAX_FILES || paths.some((p) => !p.startsWith(mine) || p.includes('..'))) {
    return json({ error: '录音不对' }, 400);
  }
  const title = String(body.title ?? '').trim().slice(0, 60) || `${user.email} 的声音`;

  try {
    const form = new FormData();
    form.append('type', 'tts');
    form.append('title', title);
    form.append('train_mode', 'fast');
    form.append('visibility', 'private');
    form.append('enhance_audio_quality', 'true');
    for (const p of paths) {
      const { data, error } = await admin().storage.from(PRIVATE_BUCKET).download(p);
      if (error || !data) throw new Error('读取录音失败');
      form.append('voices', data, p.split('/').pop());
    }
    if (Array.isArray(body.texts)) for (const t of body.texts.slice(0, MAX_FILES)) form.append('texts', String(t));

    const res = await fetch('https://api.fish.audio/model', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FISH_API_KEY ?? ''}` },
      body: form,
      signal: AbortSignal.timeout(55_000),
    });
    const out = (await res.json().catch(() => ({}))) as { _id?: string; state?: string; message?: string };
    if (!res.ok || !out._id) {
      console.error('fish train failed', res.status, JSON.stringify(out).slice(0, 300));
      return json({ error: `Fish 建声音失败（${res.status}）${out.message ? `：${out.message}` : ''}` }, 502);
    }
    const { error } = await admin().from('profiles').update({ voice_id: out._id }).eq('id', user.id);
    if (error) return json({ error: '声音建好了但没存上，声音 ID：' + out._id }, 502);
    return json({ voiceId: out._id, state: out.state, voice: await resolveVoice(user.id) });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  } finally {
    // 录音属于个人生物特征类数据：建完（成功或失败）都删
    await removePrivate(paths);
  }
}
