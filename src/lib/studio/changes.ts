/**
 * 修改记录一行的说法。数据库触发器只存「哪个字段、改前、改后」，这里翻成人话。
 */
import { STAGES, stageLabel, type Stage } from './posts.ts';

export type ChangeInput = {
  action: 'create' | 'update' | 'delete';
  field: string | null;
  old: string | null;
  new: string | null;
};

/** 2026-10-21 → 10/21 */
function md(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function describeStatus(to: string | null): string {
  if (to === 'recorded') return '标成了已录';
  if (to === 'archived') return '移出了口播库';
  return '标回了待录';
}

function stageName(s: string | null): string {
  return s && STAGES.includes(s as Stage) ? stageLabel(s as Stage, null) : (s ?? '');
}

export function describeChange(c: ChangeInput): string {
  if (c.action === 'create') return '新建了这条稿子';
  if (c.action === 'delete') return '删除了这条稿子';
  switch (c.field) {
    case 'title':
      return `改了标题：${c.old ?? ''} → ${c.new ?? ''}`;
    case 'body':
      return '改了正文';
    case 'record_by':
      if (!c.old && c.new) return `排到 ${md(c.new)} 录完`;
      if (c.old && !c.new) return `取消了排期（原来 ${md(c.old)}）`;
      return `把要录完日期从 ${md(c.old ?? '')} 改到 ${md(c.new ?? '')}`;
    case 'status':
      return describeStatus(c.new);
    case 'publish_on':
      if (!c.old && c.new) return `排到 ${md(c.new)} 发布`;
      if (c.old && !c.new) return '取消了发布日期';
      return `把发布日期从 ${md(c.old ?? '')} 改到 ${md(c.new ?? '')}`;
    case 'stage':
      if (c.new === 'published') return '标成已发布';
      return `进度：${stageName(c.old)} → ${stageName(c.new)}`;
    case 'kind':
      return c.new === 'image' ? '改成了图文' : '改成了视频';
    case 'is_extra':
      return c.new === 'true' ? '标成了热点' : '取消了热点';
    case 'series':
      return `改了系列：${c.old ?? ''} → ${c.new ?? ''}`;
    case 'episode':
      return `改了第几集：${c.old ?? ''} → ${c.new ?? ''}`;
    case 'media_url':
      return c.new ? '贴了成片链接' : '清掉了成片链接';
    case 'cover_path':
      return '换了封面';
    case 'xhs_title':
      return '改了小红书标题';
    case 'xhs_body':
      return '改了小红书正文';
    case 'xhs_tags':
      return '改了小红书标签';
    case 'published_url':
      return c.new ? '贴了发布链接' : '清掉了发布链接';
    case 'likes':
      return `赞 ${c.old ?? 0} → ${c.new ?? 0}`;
    case 'saves':
      return `藏 ${c.old ?? 0} → ${c.new ?? 0}`;
    case 'comments':
      return `评 ${c.old ?? 0} → ${c.new ?? 0}`;
    case 'note':
      return c.new ? '加了一条备注' : '删了一条备注';
    default:
      return '改了这条稿子';
  }
}
