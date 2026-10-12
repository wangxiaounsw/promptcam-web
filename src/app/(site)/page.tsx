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

import PhoneMock from "@/components/PhoneMock";

/** 全站唯一的主按钮样式:绿色胶囊。页头、首屏、底部 CTA 都是它 */
const primary =
  'inline-flex items-center rounded-full bg-[var(--accent)] px-6 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90';
/** 次级:描边胶囊,给「了解更多」这类 */
const secondary =
  'mt-8 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-raised)] px-5 py-2.5 text-[15px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--ink)]';

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
    <div className="border-l-2 border-[var(--accent)] pl-5">
      <dt className="font-display mb-1.5 text-base font-semibold">{title}</dt>
      <dd className="text-[15px] leading-relaxed text-[var(--muted)]">{children}</dd>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      {/* Hero。手机端顺序:标题 → 手机 → 正文和按钮,最抓眼的东西不藏在一屏半以下 */}
      <section className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-12 sm:px-6 md:grid-cols-2 md:items-center md:gap-x-14 md:gap-y-7 md:pb-24 md:pt-28">
        <div className="md:self-end">
          <p
            className="rise mb-5 inline-block rounded-full bg-[var(--accent-tint)] px-4 py-1.5 text-xs font-semibold tracking-wide text-[var(--accent)]"
            style={{ animationDelay: "0.05s" }}
          >
            给律师、会计、移民中介的口播服务
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
        </div>
        <div className="rise md:col-start-2 md:row-span-2 md:row-start-1" style={{ animationDelay: "0.35s" }}>
          <PhoneMock />
        </div>
        <div className="md:col-start-1 md:self-start">
          <p
            className="rise max-w-md text-lg leading-relaxed text-[var(--muted)]"
            style={{ animationDelay: "0.3s" }}
          >
            你知道该发视频，但卡在没东西讲、没空写、懒得剪。
            我们把这三头都接走，你只出镜念那一遍。
          </p>
          <div
            className="rise mt-8 flex flex-wrap items-center gap-x-5 gap-y-3"
            style={{ animationDelay: "0.45s" }}
          >
            <a href="/apply" className={primary}>
              申请开通
            </a>
            <a
              href="https://apps.apple.com/au/app/prompt-cam/id6805019682"
              className="text-[15px] font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--ink)]"
            >
              已是客户？下载 App
            </a>
          </div>
        </div>
      </section>

      {/* 服务链:首页只给骨架,展开在 /how */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6 md:pb-24">
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
        <a href="/how" className={secondary}>
          稿子是怎么写出来的、为什么不写死数字
          <span aria-hidden>→</span>
        </a>
      </section>

      {/* 灵感回路:这是客户唯一需要「主动」的地方,单独讲。编号和分工标签和上面一套 */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6 md:pb-24">
        <div className="rounded-2xl bg-[var(--accent-tint)] p-6 md:p-10">
          <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--accent)]">
            反过来也行
          </p>
          <h2 className="font-display mb-4 text-2xl font-bold md:text-3xl">
            你想讲什么，说一句就行
          </h2>
          <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
            你每天接的咨询里，哪些问题被反复问到，只有你知道。
            想到了就打开 App 说一句 —— 不用组织语言，不用写完整。
            剩下的调研和写稿交给我们。
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Step num="01" who="你" title="说一句">
              从锁屏或控制中心一键打开，开口就说。自动转成文字存进灵感库 —— 你在车上、在走廊都能记。
            </Step>
            <Step num="02" who="你" title="提交给我们">
              想拍成视频的那条，点「提交给 Fordexa 写稿」。可以附一句补充：想讲给谁听，有没有遇到过的真实例子。
            </Step>
            <Step num="03" who="Fordexa" title="等它变成稿子">
              我们调研、核实、写成能直接念的口播稿，送回你的口播库。App 里能看到走到哪一步了。
            </Step>
          </div>
          <p className="mt-8 text-sm leading-relaxed text-[var(--muted)]">
            懒得想的时候，我们也按行业整理了一批选题，翻一翻看中哪条点一下就行。{' '}
            <a className="font-medium text-[var(--accent)] hover:underline" href="/ideas">
              看看口播库 →
            </a>
          </p>
        </div>
      </section>

      {/* App 里有什么:四条功能,不再套卡片,换一种节奏 */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6 md:pb-24">
        <h2 className="font-display mb-8 text-3xl font-bold">App 里有什么</h2>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
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
        </dl>
      </section>

      {/* 路人的出口:和全页一样左对齐、通宽,主动作还是那一个绿按钮 */}
      <section className="mx-auto max-w-6xl px-5 pb-6 sm:px-6 md:pb-10">
        <div className="rounded-2xl bg-[var(--ink)] p-7 text-[var(--bg)] md:flex md:items-end md:justify-between md:gap-10 md:p-10">
          <div className="max-w-2xl">
            <h2 className="font-display mb-3 text-2xl font-bold md:text-3xl">还不是 Fordexa 客户？</h2>
            <p className="text-[15px] leading-relaxed text-white/70">
              App 可以免费下载，提词和录像都能用。但「收到我们写好的选题」「语音跟随」和「剪辑发布」是服务的一环，
              不是 App 内购。留下公司和行业，我们会联系你聊聊适合讲什么。
            </p>
          </div>
          <div className="mt-6 flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3 md:mt-0">
            <a href="/apply" className={primary}>
              申请开通
            </a>
            <a className="text-[15px] text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white" href="mailto:info@fordexa.com">
              info@fordexa.com
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
