'use client';

import { useEffect, useState } from 'react';
import { errorText, send, studioFetch } from '../api';
import { showToast } from '../ui';

/**
 * 写稿提示词：我所在公司那条（初期会常改，所以放在「我的」里好找）。
 * 保存 = 新存一版，旧版留在历史里，可以看每版改了什么、为什么。
 */
type PromptVersion = { id: string; status: string; body: string; note: string | null; created_at: string };
type Info = {
  prompt: string;
  name: string;
  source: 'org' | 'industry' | 'general' | 'default';
  history: PromptVersion[];
  defaultPrompt: string;
  factRules: string;
  hasOrg: boolean;
};
const SOURCE = { org: '本公司专属', industry: '本行业通用', general: '通用（所有文章）', default: '默认骨架' };

export default function PromptCard() {
  const [info, setInfo] = useState<Info | null>(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () =>
    studioFetch<Info>('/api/studio/prompt')
      .then((d) => {
        setInfo(d);
        setDraft(d.prompt);
      })
      .catch((e) => showToast(errorText(e)));
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await studioFetch('/api/studio/prompt', send('PUT', { body: draft, note }));
      setNote('');
      showToast('已存成新的一版');
      await load();
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  if (!info) return <div className="h-40 animate-pulse rounded-2xl bg-[var(--row-line)]" />;
  const changed = draft.trim() !== info.prompt.trim();

  return (
    <section className="rounded-2xl bg-[var(--bg-raised)] p-4">
      <div className="flex min-h-11 items-center justify-between">
        <h2 className="text-base font-bold">写稿提示词</h2>
        <span className="text-[13px] text-[var(--muted)]">{info.name} · {SOURCE[info.source]}</span>
      </div>
      {info.source !== 'org' && (
        <p className="text-[14px] text-[var(--muted)]">现在用的是{SOURCE[info.source]}那份。在这里改了存下来，就成了本公司专属的。</p>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="写稿提示词"
        className="mt-2 h-80 w-full resize-y rounded-2xl border-[1.5px] border-[#8A9690] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[var(--accent)]"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="版本说明：这版改了什么、为什么（选填）"
        className="mt-2 h-14 w-full rounded-2xl border-[1.5px] border-[#8A9690] bg-white px-4 text-[15px] outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-2 flex gap-2.5">
        <button type="button" onClick={() => setDraft(info.prompt)} disabled={!changed} className="h-14 flex-1 rounded-2xl border-[1.5px] border-[#8A9690] text-[17px] font-medium disabled:opacity-40">撤销修改</button>
        <button type="button" onClick={save} disabled={!changed || saving || !info.hasOrg} className="h-14 flex-1 rounded-2xl bg-[var(--accent)] text-[17px] font-bold text-white disabled:opacity-40">
          {saving ? '保存中…' : '存成新的一版'}
        </button>
      </div>
      {!info.hasOrg && <p className="mt-2 text-[13px] text-[var(--record)]">你还没挂公司，提示词没地方存。</p>}

      {info.history.length > 0 && (
        <details className="mt-3">
          <summary className="flex h-11 cursor-pointer items-center text-[15px] font-medium text-[var(--accent)]">历史版本（{info.history.length}）</summary>
          <ul className="flex flex-col gap-2">
            {info.history.map((h) => (
              <li key={h.id} className="rounded-xl bg-[var(--bg)] p-3 text-[14px]">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{new Date(h.created_at).toLocaleString('zh-CN', { timeZone: 'Australia/Melbourne' })}</span>
                  <span className={h.status === 'active' ? 'font-bold text-[var(--accent)]' : 'text-[var(--muted)]'}>{h.status === 'active' ? '在用' : '已停用'}</span>
                </div>
                {h.note && <p className="mt-1 text-[var(--muted)]">{h.note}</p>}
                {h.status !== 'active' && (
                  <button type="button" onClick={() => setDraft(h.body)} className="h-11 font-medium text-[var(--accent)]">把这版放进编辑框</button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="mt-1">
        <summary className="flex h-11 cursor-pointer items-center text-[13px] text-[var(--muted)]">系统固定规则（不可改，永远拼在提示词后面）</summary>
        <pre className="whitespace-pre-wrap rounded-xl bg-[var(--bg)] p-3 text-[12px] leading-relaxed text-[var(--muted)]">{info.factRules}</pre>
      </details>
    </section>
  );
}
