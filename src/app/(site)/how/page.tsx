import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '怎么运作 · Fordexa 口播助手',
  description:
    '选题我们调研、我们写；你举起手机念一遍；剪辑和发布也由我们做。稿子按你以前视频的语感写，刻意不写死金额和年份——那是你对着镜头说出去的话。',
  alternates: { canonical: 'https://app.fordexa.com/how' },
  openGraph: {
    title: '怎么运作 · Fordexa 口播助手',
    description: '你在整条链里只负责一件事 —— 对着手机念一遍。',
    url: 'https://app.fordexa.com/how',
  },
};

function Who({ mine }: { mine: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
        mine
          ? 'bg-[var(--accent-tint)] text-[var(--accent)]'
          : 'bg-[var(--row-line)] text-[var(--muted)]'
      }`}
    >
      {mine ? '我们做' : '你做'}
    </span>
  );
}

function Step({
  num,
  mine,
  title,
  children,
}: {
  num: string;
  mine: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[var(--bg-raised)] p-7">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-display text-sm font-semibold text-[var(--accent)]">
          {num}
        </span>
        <Who mine={mine} />
      </div>
      <h3 className="font-display mb-2 text-xl font-semibold">{title}</h3>
      <div className="space-y-3 text-[15px] leading-relaxed text-[var(--muted)]">
        {children}
      </div>
    </div>
  );
}

export default function HowPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-8 pt-16">
      <p className="mb-4 text-xs font-semibold tracking-wide text-[var(--accent)]">
        怎么运作
      </p>
      <h1 className="font-display text-balance text-4xl font-bold leading-[1.2] md:text-5xl">
        你只负责念那一遍
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
        律师、会计、移民中介都知道该发视频，但卡在三件事上：不知道讲什么、
        不会写稿、懒得剪。我们把前后两头接走，中间那段你本来就最擅长 ——
        把你每天跟客户讲的话，对着镜头再讲一遍。
      </p>

      <section className="mt-14 grid gap-5 md:grid-cols-2">
        <Step num="01" mine title="我们定选题">
          <p>
            选题不是拍脑袋想的。我们看你这一行客户反复在问什么、同行在讲什么、
            监管那边今年变了什么，再挑出值得你讲的那几条。
          </p>
          <p>
            你也可以反过来告诉我们。想到什么打开 App 说一句，
            我们接过去调研、写成稿子送回你的口播库。
          </p>
        </Step>

        <Step num="02" mine title="我们写稿子">
          <p>
            写的是<strong className="text-[var(--ink)]">说出来的话</strong>，
            不是文章。一句一行、句子短、开头就是客户真会问的那句，
            念起来不打结。
          </p>
          <p>每条都查过出处，出处公开在口播库里，你念之前可以自己核一遍。</p>
        </Step>

        <Step num="03" mine={false} title="你举起手机念">
          <p>
            台词贴着前置摄像头滚动，语音跟随 —— 你说快它跟着快，
            你停下它就等你。念错了点一下那个字，它从那儿重新跟。
          </p>
          <p>
            台词只画在你的屏幕上，
            <strong className="text-[var(--ink)]">不会进视频</strong>。
            录完一键发回给我们。
          </p>
        </Step>

        <Step num="04" mine title="我们剪辑发布">
          <p>
            加字幕、剪掉卡顿和重复、配封面，发到你的渠道。
            你不碰剪辑软件，也不用研究各个平台的规则。
          </p>
        </Step>
      </section>

      {/* 这一段是和「随便找个 AI 生成」的根本区别,值得单独讲 */}
      <section className="mt-20 rounded-2xl bg-[var(--bg-raised)] p-8 md:p-10">
        <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--accent)]">
          关于稿子
        </p>
        <h2 className="font-display mb-6 text-2xl font-bold md:text-3xl">
          为什么不是「拿 AI 随便生成一篇」
        </h2>
        <div className="space-y-8">
          <div>
            <h3 className="font-display mb-2 text-lg font-semibold">
              按你的语感写，不是按模板写
            </h3>
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              我们会把你以前视频的口播文字留一份。你习惯先讲一个客户故事、
              还是上来就给结论，语速偏快还是偏慢，爱不爱用比喻 ——
              这些从几段真实的口播里看得出来，比任何形容词都准。
              新稿子照着这个语感写，念出来才像你说的话，而不是念别人的稿。
            </p>
          </div>

          <div>
            <h3 className="font-display mb-2 text-lg font-semibold">
              刻意不写死金额、比例和年份
            </h3>
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              门槛和费率每年都在变。写死了，过几个月这条视频就是错的 ——
              而那是<strong className="text-[var(--ink)]">你对着镜头说出去的话</strong>，
              是你的执业责任，不是我们的。所以需要具体数字的地方，
              稿子里一律处理成「具体门槛我放在评论区」这类说法，
              由你按当下的规定补上。
            </p>
          </div>

          <div>
            <h3 className="font-display mb-2 text-lg font-semibold">
              出处公开，你念之前能自己核
            </h3>
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              每条稿子后面都挂着参考出处，而且是公开的 ——
              口播库里不登录也看得到。这不是为了好看：你拿去讲之前，
              应该能自己翻到原文确认一遍。
            </p>
          </div>

          <div>
            <h3 className="font-display mb-2 text-lg font-semibold">
              最后一道关永远是你
            </h3>
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              稿子送到你的口播库之后，你可以改几个字再念，也可以整条不要。
              我们不替你对专业内容负责，也不会把没过你眼的东西发出去。
            </p>
          </div>
        </div>
      </section>

      <section className="mt-16 rounded-2xl bg-[var(--accent-tint)] p-8 md:p-10">
        <h2 className="font-display mb-4 text-2xl font-bold">一周大概是这样</h2>
        <ol className="space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">
          {[
            '周一，新稿子到你的口播库，手机上会收到一封邮件。',
            '找个光线还行的地方，举起手机念一遍。通常十分钟内搞定，录砸了重来就是。',
            '点「发给 Fordexa」，选微信发给我们。',
            '剩下的交给我们。',
          ].map((t, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-raised)] text-sm font-semibold text-[var(--accent)]">
                {i + 1}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 flex flex-wrap items-center gap-4">
        <Link
          href="/ideas"
          className="rounded-xl bg-[var(--accent)] px-6 py-3.5 font-semibold text-white transition-opacity hover:opacity-90"
        >
          看看口播库
        </Link>
        <a
          href="mailto:info@fordexa.com"
          className="rounded-xl border border-[var(--accent)] px-6 py-3.5 font-semibold text-[var(--accent)]"
        >
          聊聊合作
        </a>
      </section>
    </main>
  );
}
