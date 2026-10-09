import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt Cam — Terms of Use",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display mb-3 mt-10 text-xl font-semibold">
      {children}
    </h2>
  );
}

export default function Terms() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[15px] leading-relaxed text-[var(--ink)]">
      <a href="/" className="text-sm text-[var(--accent)]">
        ← Prompt Cam
      </a>
      <h1 className="font-display mb-2 mt-6 text-3xl font-bold">
        Terms of Use
      </h1>
      <p className="mb-8 text-sm text-[var(--muted)]">
        Last updated: 31 August 2026
      </p>

      <H2>Acceptance</H2>
      <p className="mb-4 text-[var(--muted)]">
        By downloading or using Prompt Cam you agree to these terms. Prompt
        Cam is operated by AU GUIDE PTY LTD (Australia).
      </p>

      <H2>The service</H2>
      <p className="mb-4 text-[var(--muted)]">
        Prompt Cam lets you record video with an on-screen teleprompter
        overlay. The overlay is rendered only on your screen and is not part
        of the recorded video. The optional Pro subscription adds voice-follow
        scrolling powered by third-party speech transcription. Voice features
        require an internet connection; when unavailable, the app falls back
        to constant-speed scrolling.
      </p>

      <H2>Subscriptions</H2>
      <ul className="mb-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>
          Prompt Cam Pro is an auto-renewing monthly subscription billed
          through your Apple&nbsp;ID.
        </li>
        <li>
          It renews automatically unless cancelled at least 24 hours before
          the end of the current period. Manage or cancel in App Store
          Settings → Subscriptions.
        </li>
        <li>
          Prices are shown in the app before purchase and may vary by region.
        </li>
      </ul>

      <H2>Your content</H2>
      <p className="mb-4 text-[var(--muted)]">
        Scripts you write and videos you record are yours. They stay on your
        device; we have no access to them. You are responsible for the content
        you create and for complying with applicable laws when recording.
      </p>

      <H2>Disclaimer</H2>
      <p className="mb-4 text-[var(--muted)]">
        Prompt Cam is provided &ldquo;as is&rdquo;. Speech transcription
        accuracy is not guaranteed. To the maximum extent permitted by law, we
        are not liable for any indirect or consequential loss arising from use
        of the app.
      </p>

      <H2>Changes</H2>
      <p className="mb-4 text-[var(--muted)]">
        We may update these terms from time to time; continued use after an
        update constitutes acceptance.
      </p>

      <H2>Contact</H2>
      <p className="mb-4 text-[var(--muted)]">
        <a
          className="text-[var(--accent)] underline"
          href="mailto:info@auguide.com.au"
        >
          info@auguide.com.au
        </a>
      </p>

      <hr className="my-14 border-white/10" />

      <h1 className="font-display mb-2 text-3xl font-bold">使用条款</h1>
      <p className="mb-8 text-sm text-[var(--muted)]">
        最后更新：2026 年 8 月 31 日
      </p>

      <H2>接受条款</H2>
      <p className="mb-4 text-[var(--muted)]">
        下载或使用提词相机（Prompt Cam）即表示你同意本条款。Prompt Cam 由
        AU GUIDE PTY LTD（澳大利亚）运营。
      </p>

      <H2>服务内容</H2>
      <p className="mb-4 text-[var(--muted)]">
        提词相机让你在录制视频时使用屏幕提词浮层。浮层只渲染在你的屏幕上，不会成为录制视频的一部分。可选的
        Pro 订阅提供由第三方语音转文字驱动的语音跟随滚动。语音功能需要联网；不可用时
        App 自动回退为匀速滚动。
      </p>

      <H2>订阅</H2>
      <ul className="mb-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>
          Prompt Cam Pro 为按月自动续订的订阅，通过你的 Apple ID 扣费。
        </li>
        <li>
          除非在当前订阅期结束前至少 24 小时取消，订阅将自动续订。可在
          App Store 设置 → 订阅中管理或取消。
        </li>
        <li>价格在购买前于 App 内展示，可能因地区而异。</li>
      </ul>

      <H2>你的内容</H2>
      <p className="mb-4 text-[var(--muted)]">
        你写的台词和录制的视频归你所有，它们保存在你的设备上，我们无法访问。你须对自己创作的内容负责，并在录制时遵守适用法律。
      </p>

      <H2>免责声明</H2>
      <p className="mb-4 text-[var(--muted)]">
        提词相机按"现状"提供。语音转文字的准确性无法保证。在法律允许的最大范围内，我们不对使用本
        App 造成的任何间接或衍生损失承担责任。
      </p>

      <H2>条款变更</H2>
      <p className="mb-4 text-[var(--muted)]">
        我们可能不时更新本条款；更新后继续使用即视为接受。
      </p>

      <H2>联系我们</H2>
      <p className="mb-4 text-[var(--muted)]">
        <a
          className="text-[var(--accent)] underline"
          href="mailto:info@auguide.com.au"
        >
          info@auguide.com.au
        </a>
      </p>
    </main>
  );
}
