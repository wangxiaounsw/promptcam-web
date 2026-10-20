/**
 * 主页预览：每家公司一份小红书主页的样子（名字、简介、头像、背景）+ 若干笔记封面。
 * 给客户演示「我帮你做了之后，你的主页会是什么样」。前后端和测试共用，不 import auth。
 */

export const FRAMES = ['orange', 'blue', 'silver'] as const;
export type Frame = (typeof FRAMES)[number];

export type ShowcaseProfile = {
  name: string;
  redId: string;
  ip: string;
  follows: string;
  fans: string;
  likes: string;
  bio: string;
  tags: string[];
  collections: string[];
  frame: Frame;
};

export type ShowcaseNoteMeta = { title: string; likes: string; date: string; isVideo: boolean };

/** 接口返回给页面的样子：图片是一小时有效的签名链接 */
export type ShowcaseNote = ShowcaseNoteMeta & { id: string; url: string };
export type ShowcaseData = { profile: ShowcaseProfile; avatarUrl: string | null; bgUrl: string | null; notes: ShowcaseNote[] };

export const SHOWCASE_LIMITS = {
  name: 24,
  short: 16, // 小红书号、IP、三个数字
  bio: 300,
  tags: 6,
  tagLength: 20,
  noteTitle: 40,
  noteLikes: 12,
  notes: 60,
  // Vercel 请求体上限 4.5MB；封面在浏览器里先压到 1080 宽的 JPEG，正常一两百 KB
  imageBytes: 3 * 1024 * 1024,
};

export function emptyProfile(): ShowcaseProfile {
  return {
    name: '账号名称', redId: '', ip: '澳大利亚', follows: '0', fans: '0', likes: '0',
    bio: '一句话说清你是谁\n你能帮读者解决什么问题', tags: [], collections: [], frame: 'orange',
  };
}

const clip = (s: string, n: number) => [...s].slice(0, n).join('');
const len = (s: string) => [...s].length;

export function splitList(text: string): string[] {
  return text.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
}

type Result<T> = { value: T; error: null } | { value: null; error: string };

/** 返回清理好的值，或一句给用户看的错误 */
export function validateProfile(input: Partial<ShowcaseProfile>): Result<ShowcaseProfile> {
  const s = (v: unknown) => String(v ?? '').trim();
  const name = s(input.name);
  if (!name) return { value: null, error: '账号名称不能为空' };
  if (len(name) > SHOWCASE_LIMITS.name) return { value: null, error: `账号名称最多 ${SHOWCASE_LIMITS.name} 个字` };
  const bio = s(input.bio);
  if (len(bio) > SHOWCASE_LIMITS.bio) return { value: null, error: `简介最多 ${SHOWCASE_LIMITS.bio} 个字` };
  const short = (v: unknown) => clip(s(v), SHOWCASE_LIMITS.short);
  const list = (v: unknown) =>
    (Array.isArray(v) ? v : []).map((t) => clip(s(t), SHOWCASE_LIMITS.tagLength)).filter(Boolean).slice(0, SHOWCASE_LIMITS.tags);
  const frame = FRAMES.includes(input.frame as Frame) ? (input.frame as Frame) : 'orange';
  return {
    value: {
      name, bio, frame,
      redId: short(input.redId), ip: short(input.ip), follows: short(input.follows), fans: short(input.fans), likes: short(input.likes),
      tags: list(input.tags), collections: list(input.collections),
    },
    error: null,
  };
}

export function validateNote(input: Partial<ShowcaseNoteMeta>): Result<ShowcaseNoteMeta> {
  const title = String(input.title ?? '').trim();
  if (len(title) > SHOWCASE_LIMITS.noteTitle) return { value: null, error: `标题最多 ${SHOWCASE_LIMITS.noteTitle} 个字` };
  const likes = String(input.likes ?? '').trim();
  if (len(likes) > SHOWCASE_LIMITS.noteLikes) return { value: null, error: '点赞数太长了' };
  return { value: { title, likes, date: clip(String(input.date ?? '').trim(), 12), isVideo: Boolean(input.isVideo) }, error: null };
}

const EXT: Record<string, 'jpg' | 'png' | 'webp'> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const imageExt = (mime: string) => EXT[mime] ?? null;

export function showcasePath(orgId: string, kind: 'avatar' | 'bg' | 'note', ext: string): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
  return `showcase/${orgId}/${kind}-${rand}.${ext}`;
}

/** 按文件头认图片类型（浏览器报的 type 不可信）；不是 jpg / png / webp 就返回 null */
export function sniffImage(b: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

type NoteColumns = { title?: string; likes?: string; date_label?: string; is_video?: boolean };

/** 只改送来的那几项 —— 连着改标题又点「视频」时，后一次不会把前一次的标题改回去 */
export function notePatch(input: Partial<ShowcaseNoteMeta> & { id?: unknown }): Result<NoteColumns> {
  const v = validateNote(input);
  if (v.error !== null) return { value: null, error: v.error };
  const out: NoteColumns = {};
  if (input.title !== undefined) out.title = v.value.title;
  if (input.likes !== undefined) out.likes = v.value.likes;
  if (input.date !== undefined) out.date_label = v.value.date;
  if (input.isVideo !== undefined) out.is_video = v.value.isVideo;
  return { value: out, error: null };
}

/** 新数据里的签名链接每次都不同：屏幕上已有的图沿用旧链接，免得每次保存全部重新加载。
 *  fresh 标出刚换过的头像 / 背景，那两张要用新链接 */
export function keepUrls(prev: ShowcaseData | null, next: ShowcaseData, fresh: { avatar: boolean; bg: boolean }): ShowcaseData {
  if (!prev) return next;
  const old = new Map(prev.notes.map((n) => [n.id, n.url]));
  return {
    ...next,
    avatarUrl: fresh.avatar ? next.avatarUrl : prev.avatarUrl ?? next.avatarUrl,
    bgUrl: fresh.bg ? next.bgUrl : prev.bgUrl ?? next.bgUrl,
    notes: next.notes.map((n) => ({ ...n, url: old.get(n.id) ?? n.url })),
  };
}
