const SCRIPT_LINES = [
  "Hey everyone — welcome back.",
  "Today: three tools I use daily.",
  "The first changed my videos.",
  "No more forgetting my lines.",
  "Eyes stay next to the camera.",
  "And none of this is recorded.",
];

function ViewfinderCorner({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`absolute h-7 w-7 border-white/80 ${className}`}
    />
  );
}

function PrompterDemo() {
  return (
    <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--bg-raised)] shadow-[0_40px_120px_-30px_rgba(42,199,108,0.25)]">
      {/* 取景框四角 */}
      <ViewfinderCorner className="left-5 top-5 border-l-[3px] border-t-[3px] rounded-tl-md" />
      <ViewfinderCorner className="right-5 top-5 border-r-[3px] border-t-[3px] rounded-tr-md" />
      <ViewfinderCorner className="bottom-5 left-5 border-b-[3px] border-l-[3px] rounded-bl-md" />
      <ViewfinderCorner className="bottom-5 right-5 border-b-[3px] border-r-[3px] rounded-br-md" />
      {/* REC */}
      <div className="absolute right-9 top-8 flex items-center gap-2">
        <span className="rec-dot h-3 w-3 rounded-full bg-[var(--record)]" />
        <span className="text-xs font-semibold tracking-widest text-white/70">
          REC
        </span>
      </div>

      <div className="px-10 pb-12 pt-20">
        {/* 提词窗口:一行高亮,上下渐隐 */}
        <div className="relative h-[10.4rem] overflow-hidden">
          <div className="prompter-lines space-y-3">
            {[...SCRIPT_LINES, ...SCRIPT_LINES].map((line, i) => (
              <p
                key={i}
                className="h-[2.6rem] text-[15px] leading-snug text-white/25"
              >
                {line}
              </p>
            ))}
          </div>
          {/* 阅读线高亮:固定在第二行位置 */}
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
          What you see while recording — not what your viewers see.
        </p>
      </div>
    </div>
  );
}

function Feature({
  step,
  title,
  zh,
  children,
}: {
  step: string;
  title: string;
  zh: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[var(--bg-raised)] p-7">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-display text-sm font-semibold text-[var(--accent)]">
          {step}
        </span>
        <span className="text-xs text-[var(--muted)]">{zh}</span>
      </div>
      <h3 className="font-display mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-[15px] leading-relaxed text-[var(--muted)]">
        {children}
      </p>
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
            Prompt Cam · 提词相机
          </p>
          <h1
            className="font-display rise text-balance text-5xl font-bold leading-[1.05] md:text-6xl"
            style={{ animationDelay: "0.15s" }}
          >
            Read your script.
            <br />
            Look at the camera.
            <br />
            <span className="text-[var(--accent)]">Nothing shows.</span>
          </h1>
          <p
            className="rise mt-6 max-w-md text-lg leading-relaxed text-[var(--muted)]"
            style={{ animationDelay: "0.3s" }}
          >
            Prompt Cam scrolls your script right next to the front camera
            while you record — and the overlay is never in the video. With
            voice-follow, it listens and scrolls at your pace. Stop talking,
            it waits.
          </p>
          <div
            className="rise mt-9 flex flex-wrap items-center gap-4"
            style={{ animationDelay: "0.45s" }}
          >
            <a
              href="https://apps.apple.com/au/app/prompt-cam/id6805019682"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-6 py-3.5 font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
            >
              Download on the App Store
            </a>
            <span className="text-sm text-[var(--muted)]">
              iPhone · Free to start
            </span>
          </div>
        </div>
        <div className="rise" style={{ animationDelay: "0.35s" }}>
          <PrompterDemo />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 md:grid-cols-3">
          <Feature step="01" title="Invisible teleprompter" zh="台词不入镜">
            The script is drawn on your screen only — it is never part of the
            recording. No mirrors, no rigs, no cropping in post.
          </Feature>
          <Feature step="02" title="Voice-follow scrolling" zh="语音跟随滚动">
            Pro feature. The prompter listens as you speak and scrolls exactly
            at your pace. Go off-script, pause, restart a sentence — it keeps
            up. Falls back to constant speed offline.
          </Feature>
          <Feature step="03" title="Eyes on the lens" zh="眼神贴住镜头">
            Drag the script window to sit right at your front camera, choose
            2–5 visible lines, and the line you are reading stays highlighted
            next to the lens.
          </Feature>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="font-display mb-8 text-center text-3xl font-bold">
          Simple pricing
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-[var(--bg-raised)] p-7">
            <h3 className="font-display text-lg font-semibold">Free</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Unlimited scripts and recordings with constant-speed scrolling.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--bg-raised)] p-7">
            <h3 className="font-display text-lg font-semibold text-[var(--accent)]">
              Pro
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Voice-follow scrolling — the prompter moves at your speaking
              pace. Monthly subscription, cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--muted)]">
          <p>
            © {new Date().getFullYear()} AU GUIDE PTY LTD
            <span className="mx-2">·</span>
            <a className="hover:text-[var(--ink)]" href="https://www.fordexa.com" target="_blank" rel="noopener">
              Powered by Fordexa
            </a>
          </p>
          <nav className="flex gap-6">
            <a className="hover:text-[var(--ink)]" href="/privacy">
              Privacy
            </a>
            <a className="hover:text-[var(--ink)]" href="/terms">
              Terms
            </a>
            <a
              className="hover:text-[var(--ink)]"
              href="mailto:info@auguide.com.au"
            >
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
