/**
 * 发布日历：每条要发的小红书内容（视频或图文）的进度规则、校验、红点、复制文案。
 * 服务端接口、浏览器和测试共用，不 import auth 或任何只能在服务端用的东西。
 */

export type PostKind = 'video' | 'image';
export type Stage = 'draft' | 'refining' | 'final' | 'recorded' | 'cut' | 'published';
export const STAGES: Stage[] = ['draft', 'refining', 'final', 'recorded', 'cut', 'published'];

/** 图文没有「已录」这一步 */
export function stagesFor(kind: PostKind): Stage[] {
  return kind === 'image' ? STAGES.filter((s) => s !== 'recorded') : [...STAGES];
}

const LABELS: Record<Stage, string> = {
  draft: '草稿', refining: '精修中', final: '定稿', recorded: '已录', cut: '成片', published: '已发布',
};

/** 数据行业（TTS 配音，不用自己录）的「已录」叫「已配音」 */
export function stageLabel(stage: Stage, industry: string | null): string {
  return stage === 'recorded' && industry === 'data' ? '已配音' : LABELS[stage];
}

/** 草稿/精修中 · 定稿 · 已录/成片 · 已发布 四种颜色 */
export type Tone = 'todo' | 'final' | 'made' | 'done';
export function toneOf(stage: Stage): Tone {
  if (stage === 'published') return 'done';
  if (stage === 'final') return 'final';
  return stage === 'recorded' || stage === 'cut' ? 'made' : 'todo';
}

export const POST_LIMITS = {
  title: 40,
  xhsTitle: 20,
  xhsBody: 1000,
  tags: 10,
  tag: 20,
  series: 20,
  episodes: 60,
  note: 1000,
  // Vercel 请求体上限 4.5MB；封面在浏览器里先压缩
  coverBytes: 3 * 1024 * 1024,
} as const;

export type Result<T> = { value: T; error: null } | { value: null; error: string };
export const ok = <T>(value: T): Result<T> => ({ value, error: null });
export const fail = <T>(error: string): Result<T> => ({ value: null, error });
const len = (s: string) => [...s].length;

/** 一行一集；行首「图文：」「图文:」标图文，「视频：」可省；序号原样保留 */
export function parseSeriesLines(text: string): Result<{ title: string; kind: PostKind }[]> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return fail('至少写一集');
  if (lines.length > POST_LIMITS.episodes) return fail(`一次最多 ${POST_LIMITS.episodes} 集`);
  const out: { title: string; kind: PostKind }[] = [];
  for (const line of lines) {
    const m = /^(图文|视频)\s*[:：]\s*(.*)$/.exec(line);
    const kind: PostKind = m && m[1] === '图文' ? 'image' : 'video';
    const title = (m ? m[2] : line).trim();
    if (!title) return fail('有一集没写标题');
    if (len(title) > POST_LIMITS.title) return fail(`标题最多 ${POST_LIMITS.title} 字：${title.slice(0, 10)}…`);
    out.push({ title, kind });
  }
  return ok(out);
}

/** 成片链接会当 href 渲染给客户，只收 https:；空 → null */
export function cleanMediaUrl(raw: string): Result<string | null> {
  const s = raw.trim();
  if (!s) return ok(null);
  const bad = '成片链接要以 https:// 开头';
  try {
    return new URL(s).protocol === 'https:' ? ok(s) : fail(bad);
  } catch {
    return fail(bad);
  }
}

const XHS_HOSTS = ['xiaohongshu.com', 'xhslink.com'];
export function isXhsUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return XHS_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** 照小红书的写法：1.2万、1万+、3w、1,234；空 → null；看不懂就报错，不悄悄存 0 */
export function parseCount(raw: string): Result<number | null> {
  const s = raw.trim();
  if (!s) return ok(null);
  const m = /^(\d+(?:\.\d+)?)\s*([万wW]?)\+?$/.exec(s.replace(/[,，]/g, ''));
  if (!m) return fail(`数字看不懂：${s}`);
  return ok(Math.round(Number(m[1]) * (m[2] ? 10000 : 1)));
}

export function cleanTags(raw: string[] | string): string[] {
  const parts = Array.isArray(raw) ? raw : [raw];
  return parts.flatMap((p) => p.split(/[\s,，、#]+/)).filter(Boolean);
}

export type StageFields = { kind: PostKind; body: string; mediaUrl: string | null };

const at = (s: Stage) => STAGES.indexOf(s);

/** 到 to 这一步还缺什么：定稿及以后的视频要正文，成片及以后要成片链接 */
export function stageMissing(to: Stage, p: StageFields): string[] {
  const missing: string[] = [];
  if (at(to) >= at('final') && p.kind === 'video' && !p.body.trim()) missing.push('正文');
  if (at(to) >= at('cut') && !p.mediaUrl) missing.push('成片链接');
  return missing;
}

/** 贴了成片链接：早于「成片」且「成片」的条件都满足（视频要有正文）才推进，其余不动 */
export function stageAfterLink(stage: Stage, p: { kind: PostKind; body: string }): Stage {
  if (at(stage) >= at('cut')) return stage;
  return stageMissing('cut', { kind: p.kind, body: p.body, mediaUrl: 'linked' }).length ? stage : 'cut';
}

/** null = 可以改 */
export function checkStageChange(a: { from: Stage; to: Stage } & StageFields): string | null {
  if (a.to === 'published') return '要先贴发布链接';
  if (a.from === 'published' && a.to !== 'cut') return '已发布的只能撤回到「成片」';
  if (a.kind === 'image' && a.to === 'recorded') return '图文没有已录这一步';
  const missing = stageMissing(a.to, a);
  return missing.length ? `还缺：${missing.join('、')}` : null;
}

export type NoteMarks = {
  lastNoteAt: string | null;
  lastNoteByAdmin: boolean | null;
  adminSeenAt: string | null;
  clientSeenAt: string | null;
};

/** 对方最后写的备注，比我上次看的还新（没看过也算） */
export function isUnread(m: NoteMarks, viewerIsAdmin: boolean): boolean {
  if (!m.lastNoteAt) return false;
  if (m.lastNoteByAdmin === viewerIsAdmin) return false;
  const seen = viewerIsAdmin ? m.adminSeenAt : m.clientSeenAt;
  if (!seen) return true;
  return new Date(m.lastNoteAt).getTime() > new Date(seen).getTime();
}

export function copyText(p: { xhsTitle: string; xhsBody: string; xhsTags: string[] }): string {
  const tags = p.xhsTags.map((t) => `#${t}`).join(' ');
  return [p.xhsTitle, p.xhsBody, tags].filter(Boolean).join('\n\n');
}

export type PostEdit = Partial<{
  publish_on: string | null; title: string; kind: PostKind; is_extra: boolean; series: string | null;
  episode: number | null; media_url: string | null; xhs_title: string;
  xhs_body: string; xhs_tags: string[]; stage: Stage; likes: number | null; saves: number | null;
  comments: number | null; stats_at: string;
}>;

/** PATCH /api/studio/posts/[id] 能收的三种请求体；浏览器端的 save 都按它写，漏包 edit 会在 tsc 里报错 */
export type PostPatchBody =
  | { edit: Record<string, unknown> }
  | { action: 'publish'; url: string }
  | { action: 'unpublish' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const year = Number(s.slice(0, 4));
  if (year < 2020 || year > 2100) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const text = (v: unknown) => (typeof v === 'string' ? v : String(v ?? '')).trim();

/** 限长的文字字段：返回清理后的值，或一句错误 */
function limited(v: unknown, label: string, max: number): Result<string> {
  const s = text(v);
  return len(s) > max ? fail(`${label}最多 ${max} 字`) : ok(s);
}

/** 返回可以直接写进数据库的 snake_case 补丁，或一句给用户看的错误 */
export function validateEdit(
  input: Record<string, unknown>,
  current: { stage: Stage } & StageFields & { xhsTitle: string; xhsBody: string },
): Result<PostEdit> {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  const patch: PostEdit = {};
  const published = current.stage === 'published';

  if (has('publish_on')) {
    if (published) return fail('已发布的不能改日期');
    const v = input.publish_on;
    if (v === null || v === '') patch.publish_on = null;
    else if (typeof v === 'string' && validDate(v.trim())) patch.publish_on = v.trim();
    else return fail('日期要写成 年-月-日');
  }
  if (has('title')) {
    const r = limited(input.title, '标题', POST_LIMITS.title);
    if (r.value === null) return fail(r.error);
    if (!r.value) return fail('标题不能为空');
    patch.title = r.value;
  }
  if (has('kind')) {
    if (input.kind !== 'video' && input.kind !== 'image') return fail('类型只能是视频或图文');
    patch.kind = input.kind;
  }
  if (has('is_extra')) patch.is_extra = input.is_extra === true;
  if (has('series')) {
    const r = limited(input.series, '系列名', POST_LIMITS.series);
    if (r.value === null) return fail(r.error);
    patch.series = r.value || null;
  }
  if (has('episode')) {
    const v = input.episode;
    if (v === null || v === '') patch.episode = null;
    else {
      const n = typeof v === 'number' ? v : Number(text(v));
      if (!Number.isInteger(n) || n < 1) return fail('第几集要填正整数');
      patch.episode = n;
    }
  }
  if (has('xhs_title')) {
    const r = limited(input.xhs_title, '小红书标题', POST_LIMITS.xhsTitle);
    if (r.value === null) return fail(r.error);
    patch.xhs_title = r.value;
  }
  if (has('xhs_body')) {
    const r = limited(input.xhs_body, '小红书正文', POST_LIMITS.xhsBody);
    if (r.value === null) return fail(r.error);
    patch.xhs_body = r.value;
  }
  if (has('xhs_tags')) {
    const v = input.xhs_tags;
    const tags = cleanTags(Array.isArray(v) ? v.map((t) => String(t)) : text(v));
    if (tags.length > POST_LIMITS.tags) return fail(`标签最多 ${POST_LIMITS.tags} 个`);
    if (tags.some((t) => len(t) > POST_LIMITS.tag)) return fail(`每个标签最多 ${POST_LIMITS.tag} 字`);
    patch.xhs_tags = tags;
  }
  if (has('media_url')) {
    const r = cleanMediaUrl(text(input.media_url));
    if (r.error !== null) return fail(r.error);
    patch.media_url = r.value;
  }

  let hasStats = false;
  for (const k of ['likes', 'saves', 'comments'] as const) {
    if (!has(k)) continue;
    const v = input[k];
    const r = parseCount(v === null || v === undefined ? '' : String(v));
    if (r.error !== null) return fail(r.error);
    patch[k] = r.value;
    hasStats = true;
  }
  if (hasStats) patch.stats_at = new Date().toISOString();

  // 进度：先按编辑后的内容判断能不能改，再按成片链接自动推进
  const kind = patch.kind ?? current.kind;
  const mediaUrl = patch.media_url !== undefined ? patch.media_url : current.mediaUrl;
  if (has('stage')) {
    if (published) return fail('要撤回请点「撤回已发布」');
    const to = input.stage;
    if (typeof to !== 'string' || !STAGES.includes(to as Stage)) return fail('进度不对');
    const err = checkStageChange({ from: current.stage, to: to as Stage, kind, body: current.body, mediaUrl });
    if (err) return fail(err);
    patch.stage = to as Stage;
  }
  // 贴了成片链接且条件满足 → 推进到成片；图文没有「已录」；视频缺正文不能停在定稿及以后
  let stage = patch.stage ?? current.stage;
  if (patch.media_url) stage = stageAfterLink(stage, { kind, body: current.body });
  if (kind === 'image' && stage === 'recorded') stage = 'final';
  if (patch.kind === 'video' && current.kind === 'image' && stage !== 'published'
    && at(stage) >= at('final') && stageMissing('final', { kind, body: current.body, mediaUrl }).length) stage = 'refining';
  if (stage !== (patch.stage ?? current.stage)) patch.stage = stage;

  // 改完后的内容决定进度：已发布的不能新清空必填项；成片没了链接就退回「定稿」
  const missingAfter = stageMissing('published', { kind, body: current.body, mediaUrl });
  // 只拦这次编辑新清空的字段（老数据本来就缺的，补一个别的字段不该被拒）
  const missingBefore = stageMissing('published', current);
  const newlyCleared = missingAfter.some((f) => !missingBefore.includes(f));
  if (published && newlyCleared) return fail('已发布的不能清空成片链接或正文');
  const finalStage = patch.stage ?? current.stage;
  if (finalStage === 'cut' && !mediaUrl) {
    patch.stage = stageMissing('final', { kind, body: current.body, mediaUrl }).length ? 'refining' : 'final';
  }

  return ok(patch);
}
