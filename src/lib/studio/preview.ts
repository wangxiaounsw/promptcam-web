import { createHash } from 'node:crypto';

/**
 * 试听音频的缓存键：正文 + 声音。换了声音，旧音频自然失效 ——
 * 只按正文算的话，换声音后听到的还是上一个声音。
 */
export function previewHash(body: string, voiceId: string): string {
  return createHash('sha256').update(`${voiceId}\n${body.trim()}`).digest('hex').slice(0, 16);
}

/**
 * scripts.audio_path 本人能从 App 改（同一张表），不能拿来签别人的文件或删别人的文件：
 * 只认放在自己 audio/<uid>/ 下面的路径。
 */
export function ownsPreviewPath(path: string | null | undefined, userId: string): boolean {
  return Boolean(path) && path!.startsWith(`audio/${userId}/`) && !path!.includes('..');
}
