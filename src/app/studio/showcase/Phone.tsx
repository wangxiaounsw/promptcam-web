'use client';

import type { ShowcaseNote, ShowcaseProfile } from '@/lib/studio/showcase';
import s from './phone.module.css';

/** 小红书「我」页面的样子，装在 iPhone 17 Pro Max 里。只负责画，不取数据 */

const FRAME_COLOR: Record<ShowcaseProfile['frame'], string> = { orange: '#D9692E', blue: '#2F3B55', silver: '#CFD2D6' };

type Props = { profile: ShowcaseProfile; avatarUrl: string | null; bgUrl: string | null; notes: ShowcaseNote[]; scale: number };

const Svg = ({ d, size = 24 }: { d: string; size?: number }) => (
  <svg className={s.ico} viewBox="0 0 24 24" style={{ width: size, height: size }} aria-hidden="true"><path d={d} /></svg>
);
const LOCK = 'M7 11h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2zM8 11V8a4 4 0 018 0v3';

export default function Phone({ profile: p, avatarUrl, bgUrl, notes, scale }: Props) {
  const av = avatarUrl ? `url(${JSON.stringify(avatarUrl)})` : undefined;
  return (
    <div
      className={s.dev}
      style={{ ['--frame' as string]: FRAME_COLOR[p.frame], transform: `scale(${scale})`, marginBottom: -982 * (1 - scale), marginInline: (-466 * (1 - scale)) / 2 }}
      role="img"
      aria-label={`${p.name} 的小红书主页预览`}
    >
      <div className={s.frame} />
      <div className={s.bezel} />
      <i className={`${s.btn} ${s.bAct}`} /><i className={`${s.btn} ${s.bVu}`} /><i className={`${s.btn} ${s.bVd}`} />
      <i className={`${s.btn} ${s.bPw}`} /><i className={`${s.btn} ${s.bCc}`} />
      <div className={s.screen}>
        <div className={s.island} />
        <div className={s.status}>
          <span>9:41</span>
          <span className={s.statusR}><Svg d="M4 18v-2M9 18v-5M14 18V9M19 18V5" size={18} />4G<span className={s.bat}>80</span></span>
        </div>
        <div className={s.scroll}>
          <div className={s.head}>
            <div className={s.bg} style={bgUrl ? { backgroundImage: `url(${JSON.stringify(bgUrl)})` } : undefined} />
            <div className={s.topbar}>
              <Svg d="M4 6h16M4 12h16M4 18h16" />
              <span className={s.sp} />
              <span className={s.pill}><Svg d="M4 20l4-1 11-11-3-3L5 16z" size={15} />编辑主页</span>
              <Svg d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M4 12h16" />
              <Svg d="M14 5l6 6-6 6M20 11H10a6 6 0 00-6 6v2" />
            </div>
            <div className={s.me}>
              <div className={s.av} style={{ backgroundImage: av }} />
              <div>
                <div className={s.nm}>{p.name}<Svg d="M6 9l6 6 6-6" size={16} /></div>
                <div className={s.mt}>小红书号：{p.redId || '—'}<br />IP：{p.ip}</div>
              </div>
            </div>
            <div className={s.stats}>
              <div><b>{p.follows}</b><span>关注</span></div>
              <div><b>{p.fans}</b><span>粉丝</span></div>
              <div><b>{p.likes}</b><span>获赞与收藏</span></div>
            </div>
            {p.bio && <div className={s.bio}>{p.bio}</div>}
            {p.tags.length > 0 && <div className={s.tags}>{p.tags.map((t) => <span key={t}>{t}</span>)}</div>}
            <div className={s.tiles}>
              <div><b><Svg d="M6 5h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V8a3 3 0 013-3zM12 9a3 3 0 110 6 3 3 0 010-6z" size={17} />直播动态</b><small>进入直播管理</small></div>
              <div><b><Svg d="M12 4a8 8 0 110 16 8 8 0 010-16zM12 8v4l3 2" size={17} />浏览记录</b><small>看过的笔记</small></div>
              <div><b><Svg d="M9 5.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM3 19c0-3 3-5 6-5s6 2 6 5M16 6a3 3 0 010 6M18 14c2 .5 3 2 3 5" size={17} />群聊</b><small>查看详情</small></div>
            </div>
          </div>
          <div className={s.sheet}>
            <div className={s.tabs}>
              <span className={s.tabOn}>笔记</span>
              <span><Svg d={LOCK} size={13} />评论</span>
              <span>收藏</span>
              <span><Svg d={LOCK} size={13} />赞过</span>
              <span className={s.search}><Svg d="M11 4a7 7 0 110 14 7 7 0 010-14zM20 20l-4-4" size={21} /></span>
            </div>
            <div className={s.cols}>
              <div><Svg d={LOCK} size={17} />私密笔记 <span className={s.dim}>0 ›</span></div>
              {p.collections.map((c) => <div key={c}><Svg d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" size={17} />{c}</div>)}
            </div>
            <div className={s.feed}>
              {notes.length === 0 && <div className={s.empty}>还没有笔记。在左边上传封面，就会出现在这里。</div>}
              {notes.map((n) => (
                <div key={n.id} className={s.card}>
                  <div className={s.cv}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed storage links, no image optimisation */}
                    <img src={n.url} alt="" loading="lazy" />
                    {n.isVideo && <span className={s.play} />}
                  </div>
                  {n.title && <div className={s.tt}>{n.title}</div>}
                  <div className={s.au}>
                    <i className={s.auAv} style={{ backgroundImage: av }} />
                    <div className={s.who}>{p.name}{n.date && <small>{n.date}</small>}</div>
                    <span className={s.lk}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" /></svg>
                      {n.likes || '赞'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={s.nav}>
          <span>首页</span><span>市集</span>
          <span className={s.add}><Svg d="M12 5v14M5 12h14" /></span>
          <span>消息</span><span className={s.navOn}>我</span>
        </div>
        <div className={s.home} />
      </div>
    </div>
  );
}
