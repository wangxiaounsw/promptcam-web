import { createHash } from 'node:crypto';

/**
 * 试听音频的缓存键：正文 + 声音。换了声音，旧音频自然失效 ——
 * 只按正文算的话，换声音后听到的还是上一个声音。
 */
export function previewHash(body: string, voiceId: string): string {
  return createHash('sha256').update(`${voiceId}\n${body.trim()}`).digest('hex').slice(0, 16);
}

/**
 * scripts.audio_path 能从 App 改（同一张表），不能拿来签别家的文件或删别家的文件。
 * 只认这家公司的 audio/org/<orgId>/，和稿子主人第一期留下的 audio/<uid>/。
 */
export function previewPathAllowed(
  path: string | null | undefined,
  a: { orgId: string | null; ownerId: string },
): boolean {
  if (!path || path.includes('..')) return false;
  return (a.orgId !== null && path.startsWith(`audio/org/${a.orgId}/`)) || path.startsWith(`audio/${a.ownerId}/`);
}

/** 这家公司的试听文件放哪 */
export function orgAudioDir(orgId: string): string {
  return `audio/org/${orgId}`;
}
