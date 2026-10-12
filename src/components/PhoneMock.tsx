'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 首页 Hero 里的手机。画的是 App 的录制页：暗色、台词浮层、阅读线、
 * 底部七个控件录制键居中 —— 和真机上看到的一致。
 * 整站是浅色，这块必须是暗的，因为它就是一块正在录像的屏幕。
 *
 * 屏幕里是一段真实口播（「个人名下买车还是公司名下买车」开头 30 秒）。
 * 台词不是定时滚的，而是按视频进度翻：每句的起止点来自音频停顿检测，
 * 所以开了声音之后，她念到哪个字，哪个字就变灰；一句说完整行滚上去 —— 这就是 App 里「语音跟随」的样子。
 *
 * 声音默认关：浏览器不允许带声自动播放。点一下屏上的喇叭从头带声重放。
 */

/** [起点秒, 终点秒, 台词]。起点 = 上一个停顿结束，终点 = 这句说完开始停顿。 */
const CUES: [number, number, string][] = [
  [0, 3.1, '你买车的时候，是不是也纠结过这个问题。'],
  [3.4, 5.8, '写我名字，还是写公司名字？'],
  [6.2, 8.5, '先说一个很多人搞反的顺序。'],
  [8.8, 10.6, '不是先决定写谁的名字，'],
  [10.8, 12.4, '而是先看这车怎么用。'],
  [13.0, 15.6, '如果这车基本就是你上下班代步，'],
  [15.8, 17.2, '周末接孩子买菜，'],
  [17.4, 19.3, '那它主要是私人用途。'],
  [19.5, 21.5, '这种情况下挂在公司名下，'],
  [21.7, 23.0, '反而可能带来麻烦。'],
  [23.3, 24.7, '因为你得能说清楚，'],
  [24.9, 27.7, '这笔开销跟公司经营到底什么关系。'],
  [27.9, 29.7, '说不清楚，后面被问到，'],
  [29.9, 30.8, '就很被动。'],
];

const SCRIPT = CUES.map(([, , t]) => t).join('');
const OFFSETS = CUES.reduce<number[]>((acc, [, , t], i) => [...acc, (acc[i - 1] ?? 0) + (i ? CUES[i - 1][2].length : 0)], []);

/**
 * 到当前时刻念到了整段的第几个字。
 * 一句话内按时间平均到每个字；说完停顿时整句已灰，等下一句开口才继续。
 */
function readChars(t: number): number {
  let line = 0;
  for (let k = 0; k < CUES.length; k++) if (t >= CUES[k][0]) line = k;
  const [s0, s1, text] = CUES[line];
  const ratio = Math.min(1, Math.max(0, (t - s0) / (s1 - s0)));
  return OFFSETS[line] + Math.round(ratio * text.length);
}

function fmt(t: number) {
  const s = Math.floor(t);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function PhoneMock() {
  const video = useRef<HTMLVideoElement>(null);
  const text = useRef<HTMLParagraphElement>(null);
  const [read, setRead] = useState(0);
  const [shift, setShift] = useState(0);
  const [time, setTime] = useState(0);
  const [sound, setSound] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true);
      return;
    }
    // React 服务端渲染不会把 muted 写进 HTML，iOS Safari 因此拒绝自动播放，只能用 ref 补
    v.muted = true;
    v.defaultMuted = true;
    v.play().catch(() => {});

    let raf = 0;
    const tick = () => {
      const n = readChars(v.currentTime);
      setRead(n);
      // 正在念的那个字在哪一行，浮层就滚到让那一行顶在第一行 —— 和 App 一样念完的整行滚出去
      const el = text.current?.children[Math.min(n, SCRIPT.length - 1)] as HTMLElement | undefined;
      if (el) setShift(el.offsetTop);
      setTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function toggleSound() {
    const v = video.current;
    if (!v) return;
    const next = !sound;
    setSound(next);
    v.muted = !next;
    if (next) {
      // 开声从头来，第一句就对得上
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      {/* 机身 */}
      <div className="relative rounded-[2.75rem] bg-[#1b211e] p-[10px] shadow-[0_40px_90px_-30px_rgba(18,24,21,0.5)]">
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.25rem] bg-[#121815]">
          {/* 镜头里的人 */}
          <video
            ref={video}
            className="absolute inset-0 h-full w-full object-cover"
            src="/media/hero-avatar.mp4"
            poster="/media/hero-avatar.jpg"
            autoPlay={!still}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
          />

          {/* 灵动岛 */}
          <div className="absolute left-1/2 top-2.5 h-[22px] w-[82px] -translate-x-1/2 rounded-full bg-black" />

          {/* 退出 */}
          <div className="absolute left-3 top-12 text-white/85">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>

          {/* 提词浮层：整段连续排版自动换行，三行可见，念到的那行顶在第一行 */}
          <div className="absolute inset-x-0 top-[76px] bg-black/45 px-5 pb-2 pt-4">
            <div className="relative h-[4.5rem] overflow-hidden">
              <p
                ref={text}
                className="text-[15px] font-semibold leading-[1.6] tracking-[0.01em] transition-transform duration-500 ease-out"
                style={{ transform: `translateY(-${shift}px)` }}
              >
                {Array.from(SCRIPT).map((ch, j) => (
                  <span
                    key={j}
                    className={`transition-colors duration-300 ${j < read ? 'text-white/40' : 'text-white'}`}
                  >
                    {ch}
                  </span>
                ))}
              </p>
            </div>
            <div className="mt-2 flex justify-center">
              <span className="rounded-full bg-white/20 px-3 py-[4px] text-[10px] text-white/90">
                ⚌ 拖动
              </span>
            </div>
          </div>

          {/* 声音开关：浏览器规矩，带声必须用户点一下 */}
          <button
            type="button"
            onClick={toggleSound}
            className={`absolute left-3 top-[206px] flex items-center gap-1.5 rounded-full px-2.5 py-[4px] text-[10px] font-semibold backdrop-blur transition-colors ${
              sound ? 'bg-white/20 text-white' : 'bg-white text-[#121815]'
            }`}
            aria-pressed={sound}
            aria-label={sound ? '关闭声音' : '打开声音'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 10v4h4l5 4V6L8 10H4Z" />
              {sound ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <path d="m17 9 4 6M21 9l-4 6" />}
            </svg>
            {sound ? '声音已开' : '点我听她念'}
          </button>

          {/* 跟随中 */}
          <div className="absolute right-3 top-[206px] flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-[4px] backdrop-blur">
            <span className="rec-dot h-1.5 w-1.5 rounded-full bg-[#2ac76c]" />
            <span className="text-[10px] text-white/90">跟随中</span>
          </div>

          {/* 底部控件：七项，录制键居中 */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-5 pt-10">
            <div className="mb-3 flex justify-center">
              <span className="flex items-center gap-1 rounded-full bg-[#d42d30] px-2 py-[3px] text-[9px] font-semibold text-white">
                <span className="rec-dot h-1.5 w-1.5 rounded-full bg-white" />
                REC {fmt(time)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              {['tune', 'top', 'mic'].map((k) => (
                <Glyph key={k} name={k} on={k === 'mic'} />
              ))}
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-[2.5px] border-white">
                <span className="h-[15px] w-[15px] rounded-[3px] bg-[#e5383b]" />
              </span>
              {['flip', 'guide', 'album'].map((k) => (
                <Glyph key={k} name={k} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-5 text-center text-xs text-[var(--muted)]">
        你录的时候看到的 — 观众看不到台词
      </p>
    </div>
  );
}

/** 底栏图标。手画成 SVG，免得为六个小图标拉一整个图标库。 */
function Glyph({ name, on = false }: { name: string; on?: boolean }) {
  const c = on ? '#2ac76c' : 'rgba(255,255,255,0.9)';
  const common = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: c,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg {...common} aria-hidden>
      {name === 'tune' && (
        <>
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </>
      )}
      {name === 'top' && <path d="M5 4h14M12 20V8m0 0-4 4m4-4 4 4" />}
      {name === 'mic' && (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </>
      )}
      {name === 'flip' && (
        <>
          <path d="M4 9a8 8 0 0 1 13-3M20 15a8 8 0 0 1-13 3" />
          <path d="M4 5v4h4M20 19v-4h-4" />
        </>
      )}
      {name === 'guide' && <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />}
      {name === 'album' && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m10 9 5 3-5 3V9Z" />
        </>
      )}
    </svg>
  );
}
