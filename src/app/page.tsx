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

function ViewfinderCorner({ className }: { className: string }) {
  return (
    <div aria-hidden className={`absolute h-7 w-7 border-white/80 ${className}`} />
  );
}

function PrompterDemo() {
  return (
    <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--bg-raised)] shadow-[0_40px_120px_-30px_rgba(42,199,108,0.25)]">
      <ViewfinderCorner className="left-5 top-5 border-l-[3px] border-t-[3px] rounded-tl-md" />
      <ViewfinderCorner className="right-5 top-5 border-r-[3px] border-t-[3px] rounded-tr-md" />
      <ViewfinderCorner className="bottom-5 left-5 border-b-[3px] border-l-[3px] rounded-bl-md" />
      <ViewfinderCorner className="bottom-5 right-5 border-b-[3px] border-r-[3px] rounded-br-md" />
      <div className="absolute right-9 top-8 flex items-center gap-2">
        <span className="rec-dot h-3 w-3 rounded-full bg-[var(--record)]" />
        <span className="text-xs font-semibold tracking-widest text-white/70">REC</span>
      </div>

      <div className="px-10 pb-12 pt-20">
        <div className="relative h-[10.4rem] overflow-hidden">
          <div className="prompter-lines space-y-3">
            {[...SCRIPT_LINES, ...SCRIPT_LINES].map((line, i) => (
              <p key={i} className="h-[2.6rem] text-[15px] leading-snug text-white/25">
                {line}
              </p>
            ))}
          </div>
          {/* 阅读线固定在第二行：下面始终留着预读，不用等文字滚到底才翻 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-0.75rem] top-[2.85rem] h-[2.45rem] rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[var(--bg-raised)] to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[var(--bg-raised)] to-transparent"
          />
        </div>
        <p className="mt-8 text-center text-xs tracking-wide text-[var(--muted)]">
          你录的时候看到的 — 观众看不到
        </p>
      </div>
    </div>
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
    <div className="rounded-2xl border border-white/8 bg-[var(--bg-raised)] p-7">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-display text-sm font-semibold text-[var(--accent)]">
          {num}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            mine
              ? "bg-[var(--accent)]/15 text-[var(--accent)]"
              : "bg-white/10 text-[var(--ink)]"
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
    <div className="rounded-xl border border-white/8 p-6">
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
            className="rise mb-5 inline-block rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-[var(--accent)]"
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
          <PrompterDemo />
        </div>
      </section>

      {/* 服务链：讲清各自做什么 */}
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
            想到一个话题，从控制中心或锁屏一键打开就说一句，自动转成文字存下来，
            之后一键做成口播稿。
          </Feature>
          <Feature title="眼神贴住镜头">
            提词窗口可以拖到正对前摄的位置，当前要念的那行固定在阅读线上，
            下面还留着预读 —— 眼神不用来回找。
          </Feature>
        </div>
      </section>

      {/* 不是客户的人进来了 */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="rounded-2xl border border-white/8 bg-[var(--bg-raised)] p-8">
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

      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--muted)]">
          <p>
            © {new Date().getFullYear()} AU GUIDE PTY LTD
            <span className="mx-2">·</span>
            <a
              className="hover:text-[var(--ink)]"
              href="https://www.fordexa.com"
              target="_blank"
              rel="noopener"
            >
              Powered by Fordexa
            </a>
          </p>
          <nav className="flex gap-6">
            <a className="hover:text-[var(--ink)]" href="/privacy">
              隐私政策
            </a>
            <a className="hover:text-[var(--ink)]" href="/terms">
              使用条款
            </a>
            <a className="hover:text-[var(--ink)]" href="mailto:info@auguide.com.au">
              联系
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
