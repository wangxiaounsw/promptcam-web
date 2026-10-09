/**
 * app.fordexa.com 首页。
 *
 * 定位变了：这里不再是面向 C 端的 App 卖点页，而是**给 Fordexa 客户看的说明页**
 * ——律师/会计/移民中介打开 App 前先看这里，知道这东西怎么用、自己要做什么。
 * 所以去掉了订阅价格（客户付的是服务费，不是 App 订阅），
 * 改为讲清「我们写 → 你念 → 我们剪」这条服务链。
 *
 * 顺带一个现实考虑：App Store 的隐私政策链接指向本站，所以路人也可能进来。
 * 页面要明说「全部功能需要 Fordexa 客户账号」，免得有人下载后发现没有语音权限。
 *
 * 2026-10-09：加上灵感回路。「我们写→你念→我们剪」是单向的，
 * 客户只是被动接收；真正留得住人的是反过来那条——他想讲什么能告诉我们。
 */

/** 示例台词：故意用真实的客户场景（移民/法律咨询），而不是营销口号 */
const SCRIPT_LINES = [
  "很多人问我，父母团聚签证要等多久。",
  "先说结论：排队时间现在是 30 年起。",
  "所以关键不是等，是先把名额排上。",
  "今天讲三件要提前准备的材料。",
  "第一件，是经济担保的收入证明。",
  "具体门槛我放在评论区。",
];

/**
 * Hero 里的手机。画的是 App 的录制页:暗色、台词浮层、阅读线、
 * 底部七个控件录制键居中 —— 和真机上看到的一致。
 * 整站是浅色,这块必须是暗的,因为它就是一块正在录像的屏幕。
 */
function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      {/* 机身 */}
      <div className="relative rounded-[2.75rem] bg-[#1b211e] p-[10px] shadow-[0_40px_90px_-30px_rgba(18,24,21,0.5)]">
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.25rem] bg-[#121815]">
          {/* 人像位:不画脸,一团暖色块暗示镜头里有人 */}
          <div className="absolute inset-x-0 bottom-0 h-[62%] bg-[radial-gradient(ellipse_at_50%_100%,#3a4a42_0%,#1a211d_70%)]" />
          <div className="absolute left-1/2 top-[46%] h-32 w-32 -translate-x-1/2 rounded-full bg-[#46564c]/60 blur-[2px]" />

          {/* 灵动岛 */}
          <div className="absolute left-1/2 top-2.5 h-[22px] w-[82px] -translate-x-1/2 rounded-full bg-black" />

          {/* 退出 + 录制中 */}
          <div className="absolute left-3 top-12 text-white/85">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>

          {/* 提词浮层 */}
          <div className="absolute inset-x-0 top-[56px] bg-black/55 px-5 pb-2 pt-3">
            <div className="relative h-[108px] overflow-hidden">
              <div className="prompter-lines space-y-1.5">
                {[...SCRIPT_LINES, ...SCRIPT_LINES].map((line, i) => (
                  <p key={i} className="h-[2.1rem] text-[12.5px] font-semibold leading-[1.35] text-white/95">
                    {line}
                  </p>
                ))}
              </div>
              {/* 阅读线在第 2 行 —— 和 App 里一样,下面留着预读 */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-[-0.5rem] top-[2.25rem] h-[2.1rem] rounded-md border border-[#2ac76c]/45 bg-[#2ac76c]/12"
              />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/55 to-transparent" />
            </div>
            <div className="mt-1.5 flex justify-center">
              <span className="rounded-full bg-white/15 px-2.5 py-[3px] text-[9px] text-white/80">
                ⠿ 拖动
              </span>
            </div>
          </div>

          {/* 跟随中 */}
          <div className="absolute right-3 top-[232px] flex items-center gap-1 rounded-full bg-[#2ac76c] px-2 py-[3px]">
            <span className="rec-dot h-1.5 w-1.5 rounded-full bg-[#06210f]" />
            <span className="text-[9px] font-semibold text-[#06210f]">跟随中</span>
          </div>

          {/* 底部控件:七项,录制键居中 */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-5 pt-10">
            <div className="mb-3 flex justify-center">
              <span className="rounded-full bg-[#d42d30] px-2 py-[3px] text-[9px] font-semibold text-white">
                ● 00:18
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

/** 底栏图标。手画成 SVG,免得为六个小图标拉一整个图标库。 */
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
      {name === 'guide' && (
        <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
      )}
      {name === 'album' && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m10 9 5 3-5 3V9Z" />
        </>
      )}
    </svg>
  );
}

function Step({
  num,
  who,
  title,
  children,
}: {
  num: string;
  who: string;
  title: string;
  children: React.ReactNode;
}) {
  const mine = who === "Fordexa";
  return (
    <div className="rounded-2xl bg-[var(--bg-raised)] p-7">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-display text-sm font-semibold text-[var(--accent)]">
          {num}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            mine
              ? "bg-[var(--accent-tint)] text-[var(--accent)]"
              : "bg-[var(--row-line)] text-[var(--muted)]"
          }`}
        >
          {mine ? "我们做" : "你做"}
        </span>
      </div>
      <h3 className="font-display mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-[15px] leading-relaxed text-[var(--muted)]">{children}</p>
    </div>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--bg-raised)] p-6">
      <h3 className="font-display mb-2 text-base font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--muted)]">{children}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-20 md:grid-cols-2 md:pt-28">
        <div>
          <p
            className="rise mb-5 inline-block rounded-full bg-[var(--accent-tint)] px-4 py-1.5 text-xs font-semibold tracking-wide text-[var(--accent)]"
            style={{ animationDelay: "0.05s" }}
          >
            Fordexa 口播助手
          </p>
          <h1
            className="font-display rise text-balance text-4xl font-bold leading-[1.15] md:text-5xl"
            style={{ animationDelay: "0.15s" }}
          >
            选题我们写好，
            <br />
            你只管举起手机
            <br />
            <span className="text-[var(--accent)]">念一遍。</span>
          </h1>
          <p
            className="rise mt-6 max-w-md text-lg leading-relaxed text-[var(--muted)]"
            style={{ animationDelay: "0.3s" }}
          >
            律师、会计、移民中介都知道该发视频，但卡在「不知道讲什么、
            不会写稿、懒得剪」。我们把前后两头接走：按你的行业写好选题推到你的
            账号，剪辑和发布也由我们做。你只出镜念那一遍。
          </p>
          <div
            className="rise mt-9 flex flex-wrap items-center gap-4"
            style={{ animationDelay: "0.45s" }}
          >
            <a
              href="https://apps.apple.com/au/app/prompt-cam/id6805019682"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-6 py-3.5 font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
            >
              App Store 下载
            </a>
            <span className="text-sm text-[var(--muted)]">
              iPhone · 需要 Fordexa 客户账号
            </span>
          </div>
        </div>
        <div className="rise" style={{ animationDelay: "0.35s" }}>
          <PhoneMock />
        </div>
      </section>

      {/* 服务链:首页只给骨架,展开在 /how */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display mb-3 text-3xl font-bold">怎么运作</h2>
        <p className="mb-9 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          你在整条链里只负责一件事 —— 对着手机念一遍。
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          <Step num="01" who="Fordexa" title="我们写选题">
            按你的行业和客户常问的问题写好口播稿，直接推到你 App 里的
            「来自 Fordexa」。你打开就知道今天念什么，不用自己想。
          </Step>
          <Step num="02" who="你" title="你举起手机念">
            台词贴着前摄滚动，语音跟随 —— 说快说慢它跟着你，停下来它就等。
            台词只画在你的屏幕上，不进视频。念完发回给我们。
          </Step>
          <Step num="03" who="Fordexa" title="我们剪辑发布">
            加字幕、剪掉卡顿、配封面，发到你的渠道。你不碰剪辑软件，
            也不用研究平台规则。
          </Step>
        </div>
        <p className="mt-8 text-[15px] text-[var(--muted)]">
          <a className="font-medium text-[var(--accent)] hover:underline" href="/how">
            稿子是怎么写出来的、为什么不写死数字 →
          </a>
        </p>
      </section>

      {/* 灵感回路:这是客户唯一需要「主动」的地方,单独讲 */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl bg-[var(--accent-tint)] p-8 md:p-10">
          <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--accent)]">
            反过来也行
          </p>
          <h2 className="font-display mb-4 text-2xl font-bold md:text-3xl">
            你想讲什么，说一句就行
          </h2>
          <p className="mb-9 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
            你每天接的咨询里，哪些问题被反复问到，只有你知道。
            想到了就打开 App 说一句 —— 不用组织语言，不用写完整。
            剩下的调研和写稿交给我们。
          </p>
          <ol className="grid gap-6 sm:grid-cols-3">
            {[
              [
                "说一句",
                "从锁屏或控制中心一键打开，开口就说。自动转成文字存进灵感库 —— 你在车上、在走廊都能记。",
              ],
              [
                "提交给我们",
                "想拍成视频的那条，点「提交给 Fordexa 写稿」。可以附一句补充：想讲给谁听，有没有遇到过的真实例子。",
              ],
              [
                "等它变成稿子",
                "我们调研、核实、写成能直接念的口播稿，送回你的口播库。App 里能看到走到哪一步了。",
              ],
            ].map(([title, body], i) => (
              <li key={title}>
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-raised)] text-sm font-semibold text-[var(--accent)]">
                  {i + 1}
                </div>
                <h3 className="font-display mb-2 text-base font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-9 text-sm leading-relaxed text-[var(--muted)]">
            另外，我们也按你的行业整理了一批选题。懒得想的时候，翻一翻，
            看中哪条点一下就行。{' '}
            <a className="text-[var(--accent)] hover:underline" href="/ideas">
              看看口播库 →
            </a>
          </p>
        </div>
      </section>

      {/* App 里有什么 */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display mb-8 text-3xl font-bold">App 里有什么</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature title="台词不入镜">
            台词是画在屏幕上的浮层，相机流里根本没有它。不用反光板、不用额外设备、
            后期也不用裁。
          </Feature>
          <Feature title="语音跟随滚动">
            它听着你说，按你的实际语速滚。念错重来、中间停一下，它都跟得上。
            网络不好时自动退回匀速滚动。
          </Feature>
          <Feature title="随口记灵感">
            想到一个话题，从控制中心或锁屏一键打开就说一句，自动转成文字存下来。
            自己改成稿子，或者交给我们写。
          </Feature>
          <Feature title="眼神贴住镜头">
            提词窗口可以拖到正对前摄的位置，当前要念的那行固定在阅读线上，
            下面还留着预读 —— 眼神不用来回找。
          </Feature>
        </div>
      </section>

      {/* 不是客户的人进来了 */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="rounded-2xl bg-[var(--bg-raised)] p-8">
          <h2 className="font-display mb-3 text-xl font-semibold">
            还不是 Fordexa 客户？
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--muted)]">
            App 可以免费下载，提词和录像都能用。但「收到我们写好的选题」和
            「语音跟随滚动」需要客户账号 —— 那部分是服务的一环，不是 App 内购。
            想聊聊的话写信到{" "}
            <a
              className="text-[var(--accent)] hover:underline"
              href="mailto:info@auguide.com.au"
            >
              info@auguide.com.au
            </a>
            ，或者看看{" "}
            <a
              className="text-[var(--accent)] hover:underline"
              href="https://www.fordexa.com"
              target="_blank"
              rel="noopener"
            >
              fordexa.com
            </a>
            。
          </p>
        </div>
      </section>

    </main>
  );
}
