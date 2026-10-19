/**
 * 工作台里的「反馈问题」：描述 + 最多 4 张截图。前端提交前和服务端收到后都过这一道。
 */
// totalBytes：Vercel 函数的请求体上限是 4.5MB，超了直接 413、接口都进不来。
// 截图在浏览器里先压成 JPEG（见 FeedbackSheet），正常 4 张远到不了这个数
export const FEEDBACK_LIMITS = {
  maxImages: 4,
  maxImageBytes: 6 * 1024 * 1024,
  totalBytes: 4 * 1024 * 1024,
  maxMessage: 5000,
  perHour: 10,
};
export const FEEDBACK_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

type ImageInfo = { type: string; size: number };

/** 返回给用户看的错误，没问题返回 null */
export function validateFeedback(input: { message: string; images: ImageInfo[] }): string | null {
  const message = input.message.trim();
  if (!message) return '先写一下遇到了什么问题';
  if (message.length > FEEDBACK_LIMITS.maxMessage) return `描述太长了（最多 ${FEEDBACK_LIMITS.maxMessage} 字）`;
  if (input.images.length > FEEDBACK_LIMITS.maxImages) return `最多 ${FEEDBACK_LIMITS.maxImages} 张截图`;
  for (const img of input.images) {
    if (!FEEDBACK_MIME.includes(img.type)) return '只支持 png / jpg / webp / gif 截图（iPhone 照片请先截个屏）';
    if (img.size > FEEDBACK_LIMITS.maxImageBytes) return '单张截图不能超过 6MB';
  }
  const total = input.images.reduce((sum, img) => sum + img.size, 0);
  if (total > FEEDBACK_LIMITS.totalBytes) return '截图加起来太大了（最多 4MB），少传几张';
  return null;
}

export function feedbackImageExt(mime: string): 'png' | 'jpg' | 'webp' | 'gif' {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}
