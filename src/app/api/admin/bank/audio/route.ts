import { NextRequest, NextResponse } from 'next/server';
import { admin, configured, requireAdmin } from '@/lib/auth';
import { scriptHash, storeAudio, synthesize, ttsReady } from '@/lib/tts';
import { revalidateIdea } from '@/lib/content';

export const runtime = 'nodejs';
export const maxDuration = 60;

const no = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * 给一条选题生成朗读。稿子没改过(hash 一样)就不重跑,省 Fish 的额度;
 * 传 force 强制重念。
 */
export async function POST(request: NextRequest) {
  if (!configured) return no({ error: 'Server not configured.' }, 503);
  if (!ttsReady) return no({ error: 'FISH_API_KEY 没配到 Vercel。' }, 503);
  if (!(await requireAdmin(request))) return no({ error: 'Not authorised.' }, 403);

  let body: { id?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return no({ error: 'Bad request.' }, 400);
  }
  const id = String(body.id ?? '');
  if (!id) return no({ error: 'Missing id.' }, 400);

  const db = admin();
  const { data: idea } = await db
    .from('idea_bank')
    .select('code, slug, script, audio_url, audio_script_hash, is_published')
    .eq('id', id)
    .maybeSingle();
  if (!idea) return no({ error: 'Not found.' }, 404);
  const script = (idea.script ?? '').trim();
  if (!script) return no({ error: '这条还没有口播稿。' }, 400);

  const hash = scriptHash(script);
  if (!body.force && idea.audio_url && idea.audio_script_hash === hash) {
    return no({ ok: true, url: idea.audio_url, reused: true }, 200);
  }

  try {
    const mp3 = await synthesize(script);
    const url = await storeAudio(idea.code ?? id, mp3, idea.audio_url ?? null);
    const { error } = await db
      .from('idea_bank')
      .update({ audio_url: url, audio_script_hash: hash, audio_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return no({ error: '存链接失败' }, 502);
    if (idea.is_published) revalidateIdea(idea.slug);
    return no({ ok: true, url, bytes: mp3.length }, 200);
  } catch (e) {
    return no({ error: (e as Error).message }, 502);
  }
}
