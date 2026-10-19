/**
 * 修改记录一行的说法。数据库触发器只存「哪个字段、改前、改后」，这里翻成人话。
 */
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
    default:
      return '改了这条稿子';
  }
}
