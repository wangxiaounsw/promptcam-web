'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/browser-supabase';
import { errorText, send, studioFetch } from '../api';
import { showToast } from '../ui';

/** 我的声音：填 Fish 声音 ID，或者上传几段录音现场训练一个。设一次基本就不动 */
type Voice = { voiceId: string; from: 'me' | 'org' | 'default' };
const FROM = { me: '我的声音', org: '公司的声音', default: '默认声音' };
const MAX_MB = 20;

/** 念完才返回：按钮一直显示「播放中…」，不然一秒多的句子念完了人还没反应过来 */
async function playUrl(url: string, onPlaying?: () => void) {
  const a = new Audio(url);
  const done = new Promise<void>((resolve, reject) => {
    a.addEventListener('ended', () => resolve(), { once: true });
    a.addEventListener('error', () => reject(new Error('音频放不出来')), { once: true });
  });
  await a.play();
  onPlaying?.();
  await done;
}

export default function VoiceCard() {
  const [voice, setVoice] = useState<Voice | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [slots, setSlots] = useState<string | null>(null);

  useEffect(() => {
    studioFetch<Voice>('/api/studio/voice').then(setVoice).catch((e) => showToast(errorText(e)));
  }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const test = () =>
    run('test', async () => playUrl((await studioFetch<{ url: string }>('/api/studio/voice', send('POST', {}))).url, () => setBusy('playing')));
  const saveId = (voiceId: string | null) =>
    run('save', async () => {
      setVoice(await studioFetch<Voice>('/api/studio/voice', send('PUT', { voiceId })));
      setInput('');
      showToast(voiceId ? '声音已换好' : '已清掉，回到默认声音');
    });

  const train = () =>
    run('train', async () => {
      if (files.some((f) => f.size > MAX_MB * 1024 * 1024)) throw new Error(`每段录音不超过 ${MAX_MB}MB`);
      const prep = await studioFetch<{ uploads: { path: string; token: string }[]; slots: { used: number | null; limit: number } }>(
        '/api/studio/voice/train',
        send('POST', { files: files.map((f) => ({ name: f.name, type: f.type || 'audio/mpeg' })) }),
      );
      setSlots(prep.slots.used === null ? null : `已用 ${prep.slots.used} / ${prep.slots.limit} 个私有声音`);
      const sb = await browserSupabase();
      if (!sb) throw new Error('连不上存储');
      for (const [i, u] of prep.uploads.entries()) {
        const { error } = await sb.storage.from('studio-private').uploadToSignedUrl(u.path, u.token, files[i]);
        if (error) throw new Error(`第 ${i + 1} 段上传失败`);
      }
      const out = await studioFetch<{ voice: Voice }>('/api/studio/voice/train', send('PUT', { paths: prep.uploads.map((u) => u.path) }));
      setVoice(out.voice);
      setFiles([]);
      showToast('声音训练好了，念一句给你听');
      await playUrl((await studioFetch<{ url: string }>('/api/studio/voice', send('POST', {}))).url);
    });

  return (
    <section className="rounded-2xl bg-[var(--bg-raised)] p-4">
      <div className="flex min-h-11 items-center justify-between">
        <h2 className="text-base font-bold">试听用的声音</h2>
        <span className="text-[13px] text-[var(--muted)]">{voice ? FROM[voice.from] : '…'}</span>
      </div>
      {voice && <p className="break-all text-[13px] text-[var(--muted)]">{voice.voiceId}</p>}
      <button type="button" disabled={!voice || busy !== null} onClick={test} className="mt-3 h-14 w-full rounded-2xl border-[1.5px] border-[var(--accent)] text-[17px] font-bold text-[var(--accent)] disabled:opacity-40">
        {busy === 'test' ? '生成中…' : busy === 'playing' ? '播放中…（你好，这是我的声音）' : '念一句试试'}
      </button>

      <details className="mt-3">
        <summary className="flex h-11 cursor-pointer items-center text-[15px] font-medium text-[var(--accent)]">换成 Fish 上训练好的声音</summary>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.trim())}
          placeholder="32 位声音 ID（Fish 声音页网址里 modelId= 后面那串）"
          className="h-14 w-full rounded-2xl border-[1.5px] border-[#8A9690] bg-white px-4 text-[15px] outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-2 flex gap-2.5">
          <button type="button" disabled={!input || busy !== null} onClick={() => saveId(input)} className="h-14 flex-1 rounded-2xl bg-[var(--accent)] text-[17px] font-bold text-white disabled:opacity-40">保存</button>
          {voice?.from === 'me' && (
            <button type="button" disabled={busy !== null} onClick={() => saveId(null)} className="h-14 flex-1 rounded-2xl border-[1.5px] border-[#8A9690] text-[17px] font-medium">用回默认</button>
          )}
        </div>
      </details>

      <details className="mt-1">
        <summary className="flex h-11 cursor-pointer items-center text-[15px] font-medium text-[var(--accent)]">上传录音训练一个新声音</summary>
        <p className="text-[14px] leading-relaxed text-[var(--muted)]">
          传 1 到 20 段自己的录音，每段 15 秒以上、安静环境、正常语速最好。录音只用来建声音，建完就删掉。
          {slots && <span className="block font-medium text-[var(--ink)]">{slots}</span>}
        </p>
        <input type="file" accept="audio/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 20))} className="mt-2 block w-full text-[14px]" />
        <button type="button" disabled={!files.length || busy !== null} onClick={train} className="mt-2 h-14 w-full rounded-2xl bg-[var(--accent)] text-[17px] font-bold text-white disabled:opacity-40">
          {busy === 'train' ? '上传和训练中…（约半分钟）' : `用这 ${files.length} 段训练`}
        </button>
      </details>
    </section>
  );
}
