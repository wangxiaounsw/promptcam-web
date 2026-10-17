import type { Claim } from './claims.ts';
import { researchMarks } from './markers.ts';

/**
 * 把正文切成几段给编辑器上色：
 *   unsupported  黄：程序或 AI 在文章里没找到依据（数字、句子）
 *   research     红：【需要联系 Fordexa 补充调研】标记
 * AI 给的句子在正文里定位不到（它改了几个字），放进 unplaced 列在旁边。
 */
export type SegmentKind = 'plain' | 'unsupported' | 'research';
export type Segment = { text: string; kind: SegmentKind };

type Range = { start: number; end: number; kind: Exclude<SegmentKind, 'plain'> };

function ranges(body: string, needle: string, kind: Range['kind']): Range[] {
  const out: Range[] = [];
  if (!needle) return out;
  for (let at = body.indexOf(needle); at >= 0; at = body.indexOf(needle, at + needle.length)) {
    out.push({ start: at, end: at + needle.length, kind });
  }
  return out;
}

export function highlight(
  body: string,
  checks: { figures: string[]; claims: Claim[] | null } | null,
): { segments: Segment[]; unplaced: Claim[] } {
  const marked: Range[] = researchMarks(body).flatMap((m) => ranges(body, m, 'research'));
  const unplaced: Claim[] = [];
  for (const c of checks?.claims ?? []) {
    const found = ranges(body, c.sentence, 'unsupported');
    if (found.length) marked.push(...found);
    else unplaced.push(c);
  }
  for (const f of checks?.figures ?? []) marked.push(...ranges(body, f, 'unsupported'));

  // 红的优先；同色重叠的合并（句子里含被标的数字）
  const kindAt: (SegmentKind | undefined)[] = new Array(body.length);
  for (const r of marked.sort((a, b) => (a.kind === 'research' ? 1 : 0) - (b.kind === 'research' ? 1 : 0))) {
    for (let i = r.start; i < r.end; i++) kindAt[i] = r.kind;
  }
  const segments: Segment[] = [];
  for (let i = 0; i < body.length; i++) {
    const kind = kindAt[i] ?? 'plain';
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += body[i];
    else segments.push({ text: body[i], kind });
  }
  return { segments: segments.length ? segments : [{ text: body, kind: 'plain' }], unplaced };
}
