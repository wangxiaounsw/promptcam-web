/**
 * 备注的纯函数：校验正文、决定动哪一侧的「已读」时间、拼出页面用的一行。
 * 不 import 任何只能在服务端用的东西。
 */
import { POST_LIMITS } from './posts.ts';

type Result<T> = { value: T; error: null } | { value: null; error: string };

/** 去前后空格；不能空；最多 1000 字（按字符数，不按 UTF-16 单元） */
export function validateNoteBody(raw: unknown): Result<string> {
  if (typeof raw !== 'string') return { value: null, error: '备注不能为空' };
  const body = raw.trim();
  if (!body) return { value: null, error: '备注不能为空' };
  if ([...body].length > POST_LIMITS.note) return { value: null, error: `备注最多 ${POST_LIMITS.note} 字` };
  return { value: body, error: null };
}

/** 管理员看的是 admin_seen_at，公司成员看的是 client_seen_at */
export function seenColumn(isAdmin: boolean): 'admin_seen_at' | 'client_seen_at' {
  return isAdmin ? 'admin_seen_at' : 'client_seen_at';
}

export type NoteRow = {
  id: string; kind: 'note' | 'system'; body: string; created_at: string; author_id: string | null;
};

export type NoteAuthor = { id: string; name: string; avatarUrl: string | null; isAdmin: boolean };

export type NoteView = {
  id: string; kind: 'note' | 'system'; body: string; createdAt: string; author: NoteAuthor | null; mine: boolean;
};

/** 从旧到新；mine = 我写的 */
export function toNoteViews(rows: NoteRow[], people: Map<string, NoteAuthor>, userId: string): NoteView[] {
  return [...rows]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      body: r.body,
      createdAt: r.created_at,
      author: r.author_id ? people.get(r.author_id) ?? null : null,
      mine: r.author_id === userId,
    }));
}
