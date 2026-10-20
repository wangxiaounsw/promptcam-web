'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, send, studioFetch } from './api';
import { forgetAudio, PREVIEW_PLAY_EVENT as PLAY_EVENT, stopPlayback } from './player';
import { showToast } from './ui';

type Target = { scriptId?: string; versionId?: string };
type Status = 'checking' | 'none' | 'ready' | 'generating';
/** 合成速度实测约每秒 35 字,给个预计时间(同试听键) */
const estimateSeconds = (chars: number) => Math.max(5, Math.round(chars / 35));
const BACK_SECONDS = 5;

function clock(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/**
 * 试听稿:念不念由人点(「生成试听稿」/「再次生成试听稿」),念好了给一个能停、能往回 5 秒、能拖的播放器。
 * 只留最新一份。打开时先问一句有没有现成的(peek,不念),正文改了(revision 变)就再问。
 * 要对比两版,看「和上一版比」的文字对比,不靠多份音频。
 */
export default function AudioPreview({ target, chars, revision }: { target: Target; chars: number; revision: string }) {
  const [status, setStatus] = useState<Status>('checking');
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const autoplay = useRef(false);
  const retried = useRef(false);
  const selfId = useRef(Math.random().toString(36).slice(2));
  const { scriptId, versionId } = target;

  // 每次 peek / 生成都领一个号,回来时号不是最新的就丢掉 —— 免得慢回来的旧结果把新正文的状态盖掉
  const seq = useRef(0);

  const peek = useCallback(async () => {
    const mine = ++seq.current;
    setStatus('checking');
    try {
      const { url: found } = await studioFetch<{ url: string | null }>('/api/studio/audio', send('POST', { scriptId, versionId, peek: true }));
      if (mine !== seq.current) return;
      setUrl(found);
      setStatus(found ? 'ready' : 'none');
    } catch {
      if (mine !== seq.current) return;
      setUrl(null);
      setStatus('none');
    }
  }, [scriptId, versionId]);

  useEffect(() => {
    void peek();
  }, [peek, revision]);

  // 换了一份音频(新生成、或链接重取):进度和播放状态从头算
  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setDuration(0);
  }, [url]);

  useEffect(() => {
    const onOther = (e: Event) => (e as CustomEvent<string>).detail !== selfId.current && audio.current?.pause();
    window.addEventListener(PLAY_EVENT, onOther);
    return () => window.removeEventListener(PLAY_EVENT, onOther);
  }, []);

  useEffect(() => {
    if (status !== 'generating') return;
    const started = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status]);

  const generate = async () => {
    const force = status === 'ready';
    const hadUrl = Boolean(url);
    const mine = ++seq.current;
    audio.current?.pause();
    setStatus('generating');
    try {
      const { url: fresh } = await studioFetch<{ url: string }>('/api/studio/audio', send('POST', { scriptId, versionId, force }));
      // 口播库列表的快捷试听缓存着旧链接,旧文件可能已被删:让它下次重取
      forgetAudio({ scriptId, versionId });
      // 念的过程中正文又改了:这份是旧正文的,不用(新正文那边已经重新 peek 过)
      if (mine !== seq.current) return;
      autoplay.current = true;
      setUrl(fresh);
      setStatus('ready');
    } catch (e) {
      if (mine !== seq.current) return;
      showToast(errorText(e));
      setStatus(hadUrl ? 'ready' : 'none');
    }
  };

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch((e) => showToast(errorText(e)));
    else el.pause();
  };

  const back = () => {
    const el = audio.current;
    if (el) el.currentTime = Math.max(0, el.currentTime - BACK_SECONDS);
  };

  const estimate = estimateSeconds(chars);
  const label =
    status === 'checking'
      ? '…'
      : status === 'generating'
        ? `正在用你的声音念 ${elapsed}s / 约 ${estimate}s`
        : status === 'ready'
          ? '再次生成试听稿'
          : '生成试听稿';

  return (
    <div className="flex-1 space-y-2">
      {url && (
        <div className="flex items-center gap-2 rounded-2xl border-[1.5px] border-[var(--accent)] px-3 py-2">
          <audio
            ref={audio}
            src={url}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              setDuration(Number.isFinite(d) ? d : 0);
              if (autoplay.current) {
                autoplay.current = false;
                // 手机 Safari 不让念完自动播:提示一句,别让人以为没声音
                void e.currentTarget.play().catch(() => showToast('试听稿好了，点播放键听'));
              }
            }}
            onDurationChange={(e) => {
              const d = e.currentTarget.duration;
              setDuration(Number.isFinite(d) ? d : 0);
            }}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => {
              // 全页只放一个:停掉口播库列表里的试听,并通知别的试听稿播放器
              stopPlayback();
              window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: selfId.current }));
              setPlaying(true);
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            // 签名链接一小时过期:放久了再点就重新取一次(只重取一次,文件真坏了不死循环)
            onError={() => {
              autoplay.current = false;
              if (retried.current) return;
              retried.current = true;
              void peek();
            }}
            onCanPlay={() => {
              retried.current = false;
            }}
          />
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? '暂停' : '播放'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white"
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button
            type="button"
            onClick={back}
            aria-label={`往回 ${BACK_SECONDS} 秒`}
            className="h-11 shrink-0 rounded-xl px-2 text-[14px] font-bold text-[var(--accent)] hover:bg-[var(--accent-tint)]"
          >
            ↺ {BACK_SECONDS}s
          </button>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => {
              if (audio.current) audio.current.currentTime = Number(e.target.value);
            }}
            aria-label="播放进度"
            className="min-w-0 flex-1 accent-[var(--accent)]"
          />
          <span className="shrink-0 font-mono text-[12px] text-[var(--muted)]">
            {clock(time)} / {clock(duration)}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={generate}
        disabled={status === 'checking' || status === 'generating'}
        className={`h-12 w-full rounded-2xl text-[15px] font-bold disabled:opacity-60 ${
          url ? 'text-[var(--accent)] hover:bg-[var(--accent-tint)]' : 'border-[1.5px] border-[var(--accent)] text-[var(--accent)]'
        }`}
      >
        {label}
      </button>
    </div>
  );
}
