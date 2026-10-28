'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { splitAppendix } from '@/lib/prompt-pick';
import { diffSentences } from '@/lib/studio/script-diff';
import type { Version } from '../../api';
import AudioPreview from '../../AudioPreview';
import { Pill } from '../../ui';
import { useIsDesktop } from '../../useScripts';
import CheckedBody from './CheckedBody';
import ChangeLog from './ChangeLog';
import PromptPanel from './PromptPanel';
import RecordControls from './RecordControls';
import ScheduleRow from './ScheduleRow';
import { useScriptEditor } from './useScriptEditor';
import VersionTabs, { versionLabel, type Tab } from './VersionTabs';

/**
 * 稿子页：改正文、看各版本、就地改提示词再生成、核对、试听。
 * 手机上单独一页（底部有提示词面板）；电脑上嵌在口播库右栏，提示词常驻右边。
 * drawer：公开文章页的侧栏里用，一列往下排(稿子 → 提示词展开 → 修改记录)，不放排期和「已录」。
 * autoGenerate：别家已占、刚拉来的空稿子，打开就按这家的提示词生成一版。
 */
const SOURCE_NAME = { org: '本公司的提示词', industry: '本行业的提示词', general: '通用提示词', default: '默认骨架' } as const;

/** 「和上一版比」:按句子标出改动,删掉的划线标红,新加的标绿,没变的照常 */
function DiffBody({ before, after }: { before: string; after: string }) {
  return (
    <div className="text-[17px] leading-[1.8]">
      {diffSentences(before, after).map((d, i) =>
        d.text === '\n' ? (
          d.kind === 'del' ? null : <br key={i} />
        ) : (
          <span
            key={i}
            className={d.kind === 'add' ? 'rounded bg-[var(--accent-tint)] text-[var(--accent)]' : d.kind === 'del' ? 'rounded bg-[#FBE9E7] text-[#b3261e] line-through' : ''}
          >
            {d.text}
          </span>
        ),
      )}
    </div>
  );
}

function VersionView({
  v,
  previous,
  checking,
  onRetry,
  inUse,
  onUse,
}: {
  v: Version;
  previous: Version | null;
  checking: boolean;
  onRetry: () => void;
  inUse: boolean;
  onUse: () => void;
}) {
  const [compare, setCompare] = useState(false);
  return (
    <div className="rounded-2xl bg-[var(--bg-raised)] p-4">
      {previous && (
        <label className="mb-3 flex h-9 w-fit cursor-pointer items-center gap-2 text-[14px] font-medium text-[var(--accent)]">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          和上一版比（{versionLabel(previous)}）
        </label>
      )}
      {compare && previous ? (
        <DiffBody before={previous.body} after={v.body} />
      ) : (
        <CheckedBody body={v.body} checks={v.kind === 'generated' ? v.checks : null} checking={checking} onRetry={onRetry} />
      )}
      {v.appendix && (
        <details className="mt-4">
          <summary className="flex h-11 cursor-pointer items-center text-[15px] font-medium text-[var(--accent)]">每个数字的出处</summary>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-[var(--bg)] p-3 text-[13px] leading-relaxed">{v.appendix}</pre>
        </details>
      )}
      <div className="mt-4 space-y-2.5">
        <AudioPreview target={{ versionId: v.id }} chars={v.body.length} revision={v.id} />
        <button
          type="button"
          disabled={inUse}
          onClick={onUse}
          className="h-14 w-full rounded-2xl bg-[var(--accent)] text-[17px] font-bold text-white disabled:bg-[var(--accent-tint)] disabled:text-[var(--accent)]"
        >
          {inUse ? '正在用这版' : '用这版'}
        </button>
      </div>
    </div>
  );
}

/** 生成中：字边写边出来。出处表（--- 之后）先不显示，存好后在「每个数字的出处」里看 */
function Drafting({ text }: { text: string }) {
  const body = splitAppendix(text).body;
  return (
    <div className="rounded-2xl bg-[var(--bg-raised)] p-4" aria-live="polite">
      <p className="mb-3 flex items-center gap-2 text-[13px] font-medium text-[var(--accent)]">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        {body ? '正在按你的风格写…' : '正在读文章…'}
      </p>
      <div className="whitespace-pre-wrap text-[17px] leading-[1.8]">
        {body}
        <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-[var(--accent)] align-middle" />
      </div>
      <p className="mt-3 text-[13px] text-[var(--muted)]">写完会自动核对；想听就点下面的「生成试听稿」。</p>
    </div>
  );
}

export default function ScriptPanel({
  id,
  onChanged,
  embedded,
  drawer = false,
  autoGenerate = false,
}: {
  id: string;
  onChanged?: () => void;
  embedded?: boolean;
  drawer?: boolean;
  autoGenerate?: boolean;
}) {
  const desktop = useIsDesktop();
  const ed = useScriptEditor(id, onChanged);
  const { script, versions, prompt } = ed;
  const [tab, setTab] = useState<Tab>('body');
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    setTab('body');
    setEditing(false);
    setCompareWith(null);
  }, [id]);

  // 版本和稿子是一起取回来的，所以看到 script 时 versions 已经是全的，不会误判「还没生成过」
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoGenerate || autoStarted.current || !script?.code || !prompt || ed.busy) return;
    autoStarted.current = true;
    if (versions.some((v) => v.kind === 'generated')) return;
    void ed.generate(prompt.prompt).then((v) => v && setTab(v.id));
  }, [autoGenerate, script, prompt, versions, ed]);
  // 只在换稿子或正文/标题真的变了才同步；排期、录完日期、状态这类元数据更新不冲掉没存的修改
  const scriptId = script?.id;
  const scriptBody = script?.body;
  const scriptTitle = script?.title;
  useEffect(() => {
    if (scriptId === undefined) return;
    setDraft(scriptBody ?? '');
    setTitle(scriptTitle ?? '');
  }, [scriptId, scriptBody, scriptTitle]);

  if (ed.missing) return <p className="mt-10 text-center text-[var(--muted)]">找不到这条稿子（可能已归档或删除）。</p>;
  if (!script || !prompt) return <div className="mt-4 h-64 animate-pulse rounded-2xl bg-[var(--row-line)]" />;

  const inUse = [...versions].reverse().find((v) => v.body === script.body) ?? null;
  const selected = versions.find((v) => v.id === tab) ?? null;
  const generated = versions.filter((v) => v.kind === 'generated');
  const prevPrompt = selected?.n ? (versions.find((v) => v.n === selected.n - 1)?.prompt ?? null) : null;
  const compare = compareWith ? versions.find((v) => v.id === compareWith) ?? null : null;
  const canGenerate = Boolean(script.code);
  /** 上一版:编号小一号的那版(第 1 版的上一版是 Fordexa 原稿) */
  const previousOf = (v: Version) => (v.n > 0 ? versions.find((x) => x.n === v.n - 1) ?? null : null);

  const onGenerate = async (text: string) => {
    const v = await ed.generate(text);
    if (v) setTab(v.id);
  };

  const promptPanel = canGenerate && (
    <PromptPanel
      layout={desktop || drawer ? 'column' : 'sheet'}
      base={selected?.prompt ?? prompt.prompt}
      previous={selected?.prompt ? prevPrompt : null}
      sourceLabel={selected?.prompt ? `${versionLabel(selected)}用的提示词` : `现在用的：${prompt.name}（${SOURCE_NAME[prompt.source]}）`}
      factRules={prompt.factRules}
      canGenerate={canGenerate}
      generating={ed.busy === 'generate'}
      onGenerate={onGenerate}
      onSave={ed.savePrompt}
    />
  );

  return (
    <div className={desktop && canGenerate && !drawer ? 'grid grid-cols-[minmax(0,1fr)_320px] gap-4' : ''}>
      <div className={canGenerate && !desktop && !drawer ? 'pb-24' : ''}>
        {!embedded && !drawer && (
          <Link href="/studio" className="flex h-11 items-center text-[15px] text-[var(--accent)]">‹ 口播库</Link>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== script.title && ed.save({ title: title.trim() })}
          aria-label="标题"
          className="w-full bg-transparent text-[22px] font-bold leading-snug outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {script.code && <Pill tone="gray">{script.code}</Pill>}
          {!drawer && (
            <>
              <RecordControls script={script} onSave={ed.save} />
              <ScheduleRow script={script} industry={ed.industry} onApply={ed.applyServer} onChanged={onChanged} />
            </>
          )}
        </div>

        {canGenerate ? (
          <div className="mt-4">
            <VersionTabs versions={versions} current={tab} inUseId={inUse?.id ?? null} onSelect={(t) => { setTab(t); setEditing(false); }} />
            {!generated.length && (
              <button
                type="button"
                disabled={ed.busy === 'generate'}
                onClick={() => onGenerate(prompt.prompt)}
                className="mt-3 h-14 w-full rounded-2xl border-[1.5px] border-[var(--accent)] text-[17px] font-bold text-[var(--accent)] disabled:opacity-40"
              >
                {ed.busy === 'generate' ? '生成中…（约 10–20 秒）' : '按我的风格生成一版'}
              </button>
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-[var(--bg-raised)] p-4 text-[15px] text-[var(--muted)]">这条是自己写的，没有文章可依据，只能手动改。</p>
        )}

        <div className="mt-3">
          {ed.drafting !== null ? (
            <Drafting text={ed.drafting} />
          ) : tab === 'body' || !selected ? (
            <div className="rounded-2xl bg-[var(--bg-raised)] p-4">
              {editing ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="正文"
                  className="min-h-[50vh] w-full resize-y bg-transparent text-[17px] leading-[1.8] outline-none"
                />
              ) : (
                <CheckedBody body={script.body} checks={script.checks} checking={ed.reviewing === 'body'} onRetry={() => ed.review({ scriptId: id })} />
              )}
              {editing ? (
                <div className="mt-4 flex gap-2.5">
                  <button type="button" onClick={() => { setDraft(script.body); setEditing(false); }} className="h-14 flex-1 rounded-2xl border-[1.5px] border-[#8A9690] text-[17px] font-medium">取消</button>
                  <button
                    type="button"
                    disabled={ed.busy === 'save' || !draft.trim()}
                    onClick={async () => { await ed.save({ body: draft }); setEditing(false); }}
                    className="h-14 flex-1 rounded-2xl bg-[var(--accent)] text-[17px] font-bold text-white disabled:opacity-40"
                  >
                    保存
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {script.body.trim() && <AudioPreview target={{ scriptId: id }} chars={script.body.length} revision={script.body} />}
                  <button type="button" onClick={() => setEditing(true)} className="h-14 w-full rounded-2xl border-[1.5px] border-[var(--accent)] text-[17px] font-bold text-[var(--accent)]">改稿</button>
                </div>
              )}
              {!editing && (
                <div className="mt-1 flex justify-center gap-4">
                  {canGenerate && (
                    <button type="button" disabled={ed.reviewing === 'body'} onClick={() => ed.review({ scriptId: id })} className="h-11 px-2 text-[15px] font-medium text-[var(--accent)] disabled:opacity-40">
                      {ed.reviewing === 'body' ? '核对中…' : '重新核对正文'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={desktop && compare ? 'grid grid-cols-2 gap-3' : ''}>
              <VersionView key={selected.id} v={selected} previous={previousOf(selected)} checking={ed.reviewing === selected.id} onRetry={() => ed.review({ versionId: selected.id })} inUse={inUse?.id === selected.id} onUse={() => ed.adoptVersion(selected)} />
              {desktop && compare && compare.id !== selected.id && (
                <VersionView key={compare.id} v={compare} previous={previousOf(compare)} checking={ed.reviewing === compare.id} onRetry={() => ed.review({ versionId: compare.id })} inUse={inUse?.id === compare.id} onUse={() => ed.adoptVersion(compare)} />
              )}
            </div>
          )}
          {desktop && !drawer && selected && versions.length > 1 && (
            <label className="mt-2 flex h-11 items-center gap-2 text-[14px] text-[var(--muted)]">
              并排对比
              <select value={compareWith ?? ''} onChange={(e) => setCompareWith(e.target.value || null)} className="h-10 rounded-xl border-[1.5px] border-[#8A9690] bg-white px-2 text-[14px] text-[var(--ink)]">
                <option value="">不对比</option>
                {versions.filter((v) => v.id !== selected.id).map((v) => (
                  <option key={v.id} value={v.id}>{versionLabel(v)}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {drawer && promptPanel && <div className="mt-4">{promptPanel}</div>}
        <ChangeLog key={id} scriptId={id} />
      </div>
      {!drawer && promptPanel}
    </div>
  );
}
