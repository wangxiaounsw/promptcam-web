/**
 * 浏览器里先把图缩小再上传（手机照片动辄几 MB，Vercel 请求体上限 4.5MB），一律存 JPEG。
 * square400：居中裁成 400 的正方形（头像）；fit1080：缩到 1080 宽、2400 高以内（背景、封面、笔记图）。
 */
export type ShrinkMode = 'square400' | 'fit1080';

export async function shrinkImage(file: File, mode: ShrinkMode): Promise<Blob> {
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  if (mode === 'square400') {
    const size = Math.min(img.width, img.height);
    canvas.width = canvas.height = 400;
    ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400);
  } else {
    const k = Math.min(1, 1080 / img.width, 2400 / img.height); // 太长的长图也压住，免得超过 3MB
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  img.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  if (!blob) throw new Error('这张图读不了，换一张试试（iPhone 照片请先截个屏）');
  return blob;
}
