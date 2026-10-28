import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stagesFor, stageLabel, toneOf, parseSeriesLines, cleanMediaUrl, isXhsUrl, parseCount, cleanTags,
  checkStageChange, validateEdit, isUnread, copyText, stageMissing, stageAfterLink, POST_LIMITS, STAGES,
  type Stage, type PostKind,
} from './posts.ts';
import { publishPatch, unpublishPatch } from './posts-publish.ts';

test('stageLabel: data industry calls recorded 已配音', () => {
  assert.equal(stageLabel('recorded', 'data'), '已配音');
  assert.equal(stageLabel('recorded', 'accounting'), '已录');
  assert.equal(stageLabel('recorded', null), '已录');
  assert.equal(stageLabel('refining', null), '精修中');
});
test('stagesFor: image has no recorded', () => {
  assert.ok(!stagesFor('image').includes('recorded'));
  assert.deepEqual(stagesFor('video'), STAGES);
});
test('toneOf maps to four colours', () =>
  assert.deepEqual(STAGES.map(toneOf), ['todo', 'todo', 'final', 'made', 'made', 'done']));
test('stageMissing: final needs body for video, not for image; cut needs media', () => {
  assert.deepEqual(stageMissing('final', { kind: 'video', body: '', mediaUrl: null }), ['正文']);
  assert.deepEqual(stageMissing('final', { kind: 'image', body: '', mediaUrl: null }), []);
  assert.deepEqual(stageMissing('cut', { kind: 'video', body: 'x', mediaUrl: null }), ['成片链接']);
  assert.deepEqual(stageMissing('cut', { kind: 'video', body: ' ', mediaUrl: null }), ['正文', '成片链接']);
  assert.deepEqual(stageMissing('refining', { kind: 'video', body: '', mediaUrl: null }), []);
});
test('parseSeriesLines: blanks, spaces, 图文 prefixes in both widths, numbering kept', () => {
  const r = parseSeriesLines('  排行榜第一就最危险？ \n\n图文：商场的案子\n图文: 租房看哪个数\n视频：1. 拆不掉的区\n');
  assert.deepEqual(r.value, [
    { title: '排行榜第一就最危险？', kind: 'video' },
    { title: '商场的案子', kind: 'image' },
    { title: '租房看哪个数', kind: 'image' },
    { title: '1. 拆不掉的区', kind: 'video' },
  ]);
});
test('parseSeriesLines: empty → error; 61 lines → error; 41-char title → error', () => {
  assert.equal(parseSeriesLines(' \n ').error, '至少写一集');
  assert.match(parseSeriesLines(Array(61).fill('a').join('\n')).error!, /最多 60 集/);
  assert.match(parseSeriesLines('一'.repeat(41)).error!, /40 字/);
});
test('cleanMediaUrl: https OneDrive/Drive ok, trims; javascript:/http:/garbage rejected; empty → null', () => {
  assert.equal(cleanMediaUrl(' https://1drv.ms/v/s!abc ').value, 'https://1drv.ms/v/s!abc');
  assert.equal(cleanMediaUrl('https://drive.google.com/file/d/x/view').value, 'https://drive.google.com/file/d/x/view');
  for (const bad of ['javascript:alert(1)', 'http://1drv.ms/x', 'not a url']) assert.equal(cleanMediaUrl(bad).error, '成片链接要以 https:// 开头');
  assert.equal(cleanMediaUrl('  ').value, null);
});
test('isXhsUrl: real hosts and subdomains yes, look-alikes no', () => {
  for (const ok of ['https://www.xiaohongshu.com/explore/abc?xsec_token=x', ' http://xhslink.com/a/b ', 'https://xiaohongshu.com/discovery/item/1']) assert.ok(isXhsUrl(ok), ok);
  for (const bad of ['https://xiaohongshu.com.evil.com/x', 'https://evilxhslink.com/a', 'xiaohongshu.com/explore/1', '']) assert.ok(!isXhsUrl(bad), bad);
});
test('parseCount: 万 / w / + / commas', () => {
  assert.equal(parseCount('1.2万').value, 12000);
  assert.equal(parseCount('1万+').value, 10000);
  assert.equal(parseCount('3w').value, 30000);
  assert.equal(parseCount('1,234').value, 1234);
  assert.equal(parseCount(' 41 ').value, 41);
  assert.equal(parseCount('').value, null);
  assert.equal(parseCount('abc').error, '数字看不懂：abc');
});
test('cleanTags: strips # and splits on spaces/commas', () =>
  assert.deepEqual(cleanTags('#墨尔本租房 #犯罪率，墨尔本生活'), ['墨尔本租房', '犯罪率', '墨尔本生活']));
const FULL = { body: 'b', mediaUrl: 'https://1drv.ms/x' };
const EMPTY = { body: '', mediaUrl: null };
const cur = (o: Partial<{ stage: Stage; kind: PostKind; body: string; mediaUrl: string | null }> = {}) =>
  ({ stage: 'draft' as Stage, kind: 'video' as PostKind, ...EMPTY, xhsTitle: '', xhsBody: '', ...o });

test('checkStageChange: published only via link; un-publish only to cut; image has no recorded; needs fields', () => {
  assert.equal(checkStageChange({ from: 'cut', to: 'published', kind: 'video', ...FULL }), '要先贴发布链接');
  assert.equal(checkStageChange({ from: 'published', to: 'final', kind: 'video', ...FULL }), '已发布的只能撤回到「成片」');
  assert.equal(checkStageChange({ from: 'published', to: 'cut', kind: 'video', ...FULL }), null);
  assert.equal(checkStageChange({ from: 'final', to: 'recorded', kind: 'image', ...FULL }), '图文没有已录这一步');
  assert.equal(checkStageChange({ from: 'refining', to: 'final', kind: 'video', ...EMPTY }), '还缺：正文');
  assert.equal(checkStageChange({ from: 'final', to: 'cut', kind: 'video', ...EMPTY }), '还缺：正文、成片链接');
  assert.equal(checkStageChange({ from: 'refining', to: 'final', kind: 'image', ...EMPTY }), null);
  assert.equal(checkStageChange({ from: 'cut', to: 'draft', kind: 'video', ...EMPTY }), null);
});
test('validateEdit: media link bumps draft → cut; stats add stats_at', () => {
  assert.equal(validateEdit({ media_url: 'https://1drv.ms/x' }, cur({ body: 'b' })).value?.stage, 'cut');
  assert.equal(validateEdit({ media_url: 'https://1drv.ms/x' }, cur({ stage: 'recorded', body: 'b' })).value?.stage, 'cut');
  assert.equal(validateEdit({ media_url: 'https://1drv.ms/x' }, cur({ stage: 'published', ...FULL })).value?.stage, undefined);
  const s = validateEdit({ likes: '1.2万' }, cur({ stage: 'published', ...FULL }));
  assert.equal(s.value?.likes, 12000);
  assert.ok(typeof (s.value as Record<string, unknown>).stats_at === 'string');
});
test('validateEdit: published refuses date change and drag back (publish_on null), and stage change', () => {
  const p = cur({ stage: 'published', ...FULL });
  assert.equal(validateEdit({ publish_on: null }, p).error, '已发布的不能改日期');
  assert.equal(validateEdit({ publish_on: '2026-11-10' }, p).error, '已发布的不能改日期');
  assert.equal(validateEdit({ stage: 'cut' }, p).error, '要撤回请点「撤回已发布」');
});
test('validateEdit: body and script_id are not editable keys', () => {
  assert.deepEqual(validateEdit({ body: 'x', script_id: 'nope', title: 't' }, cur()).value, { title: 't' });
});
test('validateEdit: field limits, ignores unknown keys, rejects bad date/episode', () => {
  const c = cur();
  assert.equal(validateEdit({ xhs_title: '一'.repeat(21) }, c).error, '小红书标题最多 20 字');
  assert.equal(validateEdit({ xhs_body: '一'.repeat(1001) }, c).error, '小红书正文最多 1000 字');
  assert.equal(validateEdit({ title: '一'.repeat(41) }, c).error, '标题最多 40 字');
  assert.equal(validateEdit({ series: '一'.repeat(21) }, c).error, '系列名最多 20 字');
  assert.match(validateEdit({ xhs_tags: Array(11).fill('a') }, c).error!, /最多 10 个/);
  assert.match(validateEdit({ publish_on: '2026/11/10' }, c).error!, /日期/);
  assert.match(validateEdit({ publish_on: '2026-02-31' }, c).error!, /日期/);
  assert.match(validateEdit({ episode: 0 }, c).error!, /第几集/);
  assert.deepEqual(validateEdit({ evil: 1, publish_on: null, episode: '3', series: ' ' }, c).value, { publish_on: null, episode: 3, series: null });
  assert.equal(validateEdit({ media_url: 'javascript:x' }, c).error, '成片链接要以 https:// 开头');
  assert.equal(validateEdit({ stage: 'published' }, c).error, '要先贴发布链接');
  assert.equal(validateEdit({ stage: 'final' }, c).error, '还缺：正文');
});
test('isUnread: admin sees client notes newer than admin_seen_at; own notes never unread; never-seen counts', () => {
  const m = { lastNoteAt: '2026-11-01T10:00:00Z', lastNoteByAdmin: false, adminSeenAt: '2026-11-01T09:00:00Z', clientSeenAt: null };
  assert.equal(isUnread(m, true), true);
  assert.equal(isUnread(m, false), false);
  assert.equal(isUnread({ ...m, adminSeenAt: null }, true), true);
  assert.equal(isUnread({ ...m, lastNoteAt: null }, true), false);
  assert.equal(isUnread({ ...m, adminSeenAt: '2026-11-01T11:00:00Z' }, true), false);
});
test('copyText: title, blank line, body, blank line, #tags', () =>
  assert.equal(copyText({ xhsTitle: 'T', xhsBody: 'B', xhsTags: ['a', 'b'] }), 'T\n\nB\n\n#a #b'));
test('stageAfterLink / limits', () => {
  assert.deepEqual(STAGES.map((s) => stageAfterLink(s, { kind: 'video', body: 'b' })), ['cut', 'cut', 'cut', 'cut', 'cut', 'published']);
  // 空正文的视频贴了链接：不够「成片」的条件，原地不动
  assert.deepEqual(STAGES.map((s) => stageAfterLink(s, { kind: 'video', body: ' ' })), STAGES);
  // 图文不要正文，照样推进
  assert.equal(stageAfterLink('draft', { kind: 'image', body: '' }), 'cut');
  assert.equal(POST_LIMITS.coverBytes, 3 * 1024 * 1024);
});
test('validateEdit: switching to 图文 while at 已录 moves stage back to 定稿', () => {
  const c = cur({ stage: 'recorded', body: 'b' });
  assert.equal(validateEdit({ kind: 'image' }, c).value?.stage, 'final');
  assert.equal(validateEdit({ title: 'x' }, c).value?.stage, undefined);
  assert.equal(validateEdit({ title: 'x' }, { ...c, kind: 'image' }).value?.stage, 'final');
  assert.equal(validateEdit({ kind: 'image' }, cur({ stage: 'final', body: 'b' })).value?.stage, undefined);
});
test('publishPatch: only xhs links; already published keeps published_at', () => {
  const now = '2026-11-01T00:00:00.000Z';
  const today = '2026-11-01';
  const sched = { stage: 'cut' as Stage, publishOn: '2026-11-05', kind: 'video' as PostKind, ...FULL };
  assert.equal(publishPatch('https://evil.com', sched, now, today).error, '这不是小红书的链接');
  assert.equal(publishPatch(undefined, sched, now, today).error, '这不是小红书的链接');
  assert.deepEqual(publishPatch(' https://www.xiaohongshu.com/x?xsec_token=1 ', sched, now, today).value,
    { stage: 'published', published_url: 'https://www.xiaohongshu.com/x?xsec_token=1', published_at: now });
  assert.deepEqual(publishPatch('https://xhslink.com/a', { ...sched, stage: 'published' }, now, today).value, { stage: 'published', published_url: 'https://xhslink.com/a' });
});
test('publishPatch: unscheduled post gets publish_on = Melbourne today', () => {
  const r = publishPatch('https://xhslink.com/a', { stage: 'cut', publishOn: null, kind: 'video', ...FULL }, '2026-11-01T00:00:00.000Z', '2026-11-01');
  assert.equal(r.value?.publish_on, '2026-11-01');
  const keep = publishPatch('https://xhslink.com/a', { stage: 'cut', publishOn: '2026-11-09', kind: 'video', ...FULL }, '2026-11-01T00:00:00.000Z', '2026-11-01');
  assert.equal(keep.value?.publish_on, undefined);
});
test('unpublishPatch: only for published; goes back to cut and clears link/time', () => {
  assert.equal(unpublishPatch({ stage: 'cut', publishedUrl: null }).error, '只有已发布的才能撤回');
  const r = unpublishPatch({ stage: 'published', publishedUrl: 'https://xhslink.com/a' });
  assert.deepEqual(r.value, { stage: 'cut', published_url: null, published_at: null });
});
test('validateEdit: cut post that loses its media link falls back to 定稿', () => {
  const c = cur({ stage: 'cut', ...FULL });
  assert.equal(validateEdit({ media_url: '' }, c).value?.stage, 'final');
  assert.equal(validateEdit({ xhs_body: 'new' }, c).value?.stage, undefined);
  assert.equal(validateEdit({ media_url: '' }, cur({ stage: 'recorded', ...FULL })).value?.stage, undefined);
});
test('validateEdit: published post cannot clear media link', () => {
  const c = cur({ stage: 'published', ...FULL });
  assert.equal(validateEdit({ media_url: '' }, c).error, '已发布的不能清空成片链接或正文');
  assert.equal(validateEdit({ xhs_body: 'changed' }, c).value?.xhs_body, 'changed');
  assert.equal(validateEdit({ likes: '5' }, c).error, null);
});
test('validateEdit: published post only refuses edits that newly clear a filled field', () => {
  const noMedia = cur({ stage: 'published', body: 'b', mediaUrl: null });
  assert.equal(validateEdit({ media_url: null }, noMedia).error, null);
  assert.equal(validateEdit({ xhs_title: '新标题' }, noMedia).error, null);
});

test('validDate: only years 2020-2100', () => {
  const c = cur();
  assert.equal(validateEdit({ publish_on: '2020-01-01' }, c).value?.publish_on, '2020-01-01');
  assert.equal(validateEdit({ publish_on: '2100-12-31' }, c).value?.publish_on, '2100-12-31');
  assert.match(validateEdit({ publish_on: '2019-12-31' }, c).error!, /日期/);
  assert.match(validateEdit({ publish_on: '2101-01-01' }, c).error!, /日期/);
  assert.match(validateEdit({ publish_on: '0001-01-01' }, c).error!, /日期/);
});
test('validateEdit: media link on empty-body video draft does not bump to cut', () => {
  assert.equal(validateEdit({ media_url: 'https://1drv.ms/x' }, cur()).value?.stage, undefined);
  assert.equal(validateEdit({ media_url: 'https://1drv.ms/x' }, cur({ kind: 'image' })).value?.stage, 'cut');
});
test('validateEdit: image → video at 定稿+ with empty body goes back to 精修中', () => {
  assert.equal(validateEdit({ kind: 'video' }, cur({ stage: 'final', kind: 'image' })).value?.stage, 'refining');
  assert.equal(validateEdit({ kind: 'video' }, cur({ stage: 'cut', kind: 'image', mediaUrl: 'https://1drv.ms/x' })).value?.stage, 'refining');
  assert.equal(validateEdit({ kind: 'video' }, cur({ stage: 'final', kind: 'image', body: 'b' })).value?.stage, undefined);
  assert.equal(validateEdit({ kind: 'video' }, cur({ stage: 'draft', kind: 'image' })).value?.stage, undefined);
  // 已发布的不动
  assert.equal(validateEdit({ kind: 'video' }, cur({ stage: 'published', kind: 'image', mediaUrl: 'https://1drv.ms/x' })).value?.stage, undefined);
});
test('validateEdit: cut losing media link falls to 定稿, or 精修中 when a video has no body', () => {
  assert.equal(validateEdit({ media_url: '' }, cur({ stage: 'cut', kind: 'image', mediaUrl: 'https://1drv.ms/x' })).value?.stage, 'final');
  assert.equal(validateEdit({ media_url: '' }, cur({ stage: 'cut', kind: 'video', mediaUrl: 'https://1drv.ms/x' })).value?.stage, 'refining');
});
test('publishPatch: refuses a draft that lacks body or media link', () => {
  const now = '2026-11-01T00:00:00.000Z';
  const base = { stage: 'cut' as Stage, publishOn: '2026-11-05', kind: 'video' as PostKind };
  assert.equal(publishPatch('https://xhslink.com/a', { ...base, body: '', mediaUrl: null }, now, '2026-11-01').error, '还缺：正文、成片链接');
  assert.equal(publishPatch('https://xhslink.com/a', { ...base, body: 'b', mediaUrl: null }, now, '2026-11-01').error, '还缺：成片链接');
  assert.equal(publishPatch('https://xhslink.com/a', { ...base, body: 'b', mediaUrl: 'https://1drv.ms/x' }, now, '2026-11-01').error, null);
  // 已发布的只是改链接，不查
  assert.equal(publishPatch('https://xhslink.com/a', { ...base, stage: 'published', body: '', mediaUrl: null }, now, '2026-11-01').error, null);
});
