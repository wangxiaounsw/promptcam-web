import { admin } from '@/lib/auth';

/**
 * 工作台的私有桶:个人试听音频和训练录音。
 * 和公开的 idea-audio 不同,这里的文件只能凭短期签名链接听。
 */
export const PRIVATE_BUCKET = 'studio-private';

export async function putPrivate(path: string, data: Buffer, contentType: string, cacheControl = '0'): Promise<void> {
  // 默认不让 CDN / 浏览器缓存:一版稿子「再次生成试听稿」是覆盖同一个文件名,缓存了会听到旧的。
  // 文件名每次都随机、从不覆盖的(主页预览的图)可以放心缓存
  const { error } = await admin()
    .storage.from(PRIVATE_BUCKET)
    .upload(path, data, { contentType, upsert: true, cacheControl });
  if (error) throw new Error(`上传失败: ${error.message}`);
}

export async function signedUrl(path: string, seconds = 3600): Promise<string> {
  const { data, error } = await admin().storage.from(PRIVATE_BUCKET).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error('取音频链接失败');
  return data.signedUrl;
}

export async function existsPrivate(path: string): Promise<boolean> {
  const slash = path.lastIndexOf('/');
  const { data } = await admin()
    .storage.from(PRIVATE_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  return Boolean(data?.some((f) => f.name === path.slice(slash + 1)));
}

/** 删不掉也不报错 —— 留几个孤儿文件不影响使用 */
export async function removePrivate(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await admin().storage.from(PRIVATE_BUCKET).remove(paths).catch(() => {});
}

export async function copyPrivate(from: string, to: string): Promise<boolean> {
  const { error } = await admin().storage.from(PRIVATE_BUCKET).copy(from, to);
  return !error;
}
