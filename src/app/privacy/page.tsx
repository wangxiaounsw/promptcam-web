import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt Cam — Privacy Policy",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display mb-3 mt-10 text-xl font-semibold">
      {children}
    </h2>
  );
}

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[15px] leading-relaxed text-[var(--ink)]">
      <a href="/" className="text-sm text-[var(--accent)]">
        ← Prompt Cam
      </a>
      <h1 className="font-display mb-2 mt-6 text-3xl font-bold">
        Privacy Policy
      </h1>
      <p className="mb-8 text-sm text-[var(--muted)]">
        Last updated: 31 August 2026
      </p>

      <H2>Overview</H2>
      <p className="mb-4 text-[var(--muted)]">
        Prompt Cam is a teleprompter video recording app. It has no user
        accounts. Your scripts and recorded videos never leave your device
        unless you share them yourself.
      </p>

      <H2>Data stored on your device</H2>
      <ul className="mb-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>
          <strong className="text-[var(--ink)]">Scripts</strong> you write are
          stored locally inside the app.
        </li>
        <li>
          <strong className="text-[var(--ink)]">Videos</strong> you record are
          saved to your device photo library (album &ldquo;Prompter&rdquo;).
          We never upload them.
        </li>
        <li>
          <strong className="text-[var(--ink)]">Preferences</strong> (font
          size, scroll speed, overlay position) are stored locally.
        </li>
      </ul>

      <H2>Voice-follow scrolling (Pro feature)</H2>
      <p className="mb-4 text-[var(--muted)]">
        When voice-follow scrolling is enabled during recording, your
        microphone audio is streamed in real time to Google&rsquo;s Gemini API
        to transcribe your speech so the teleprompter can follow your pace.
        Audio is processed transiently for transcription and is not used by us
        to identify you. The resulting transcription is used only on your
        device to position the script and is discarded afterwards. See{" "}
        <a
          className="text-[var(--accent)] underline"
          href="https://policies.google.com/privacy"
        >
          Google&rsquo;s Privacy Policy
        </a>{" "}
        for how Google processes API data.
      </p>

      <H2>Subscriptions</H2>
      <p className="mb-4 text-[var(--muted)]">
        Pro subscriptions are processed by Apple through your App Store
        account. We use RevenueCat to validate subscription status; RevenueCat
        receives an anonymous app-generated identifier and purchase receipts,
        never your name or contact details. See{" "}
        <a
          className="text-[var(--accent)] underline"
          href="https://www.revenuecat.com/privacy"
        >
          RevenueCat&rsquo;s Privacy Policy
        </a>
        .
      </p>

      <H2>Permissions</H2>
      <ul className="mb-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>
          <strong className="text-[var(--ink)]">Camera &amp; microphone</strong>{" "}
          — required to record video.
        </li>
        <li>
          <strong className="text-[var(--ink)]">
            Photo library (add only)
          </strong>{" "}
          — required to save your recordings.
        </li>
      </ul>

      <H2>What we do NOT do</H2>
      <ul className="mb-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>No accounts, no sign-in, no personal data collection.</li>
        <li>No analytics or advertising SDKs.</li>
        <li>No selling or sharing of data with third parties.</li>
      </ul>

      <H2>Contact</H2>
      <p className="mb-4 text-[var(--muted)]">
        Questions about this policy:{" "}
        <a
          className="text-[var(--accent)] underline"
          href="mailto:info@auguide.com.au"
        >
          info@auguide.com.au
        </a>
      </p>

      <hr className="my-14 border-white/10" />

      <h1 className="font-display mb-2 text-3xl font-bold">隐私政策</h1>
      <p className="mb-8 text-sm text-[var(--muted)]">
        最后更新：2026 年 8 月 31 日
      </p>

      <H2>概述</H2>
      <p className="mb-4 text-[var(--muted)]">
        提词相机（Prompt Cam）是一款提词器录像
        App，没有用户账号体系。除非你自己分享，你的台词和录制的视频不会离开你的设备。
      </p>

      <H2>存储在你设备上的数据</H2>
      <ul className="mb-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>
          <strong className="text-[var(--ink)]">台词</strong>
          ：存储在 App 本地。
        </li>
        <li>
          <strong className="text-[var(--ink)]">视频</strong>
          ：保存到你设备的相册（"Prompter" 相簿），我们从不上传。
        </li>
        <li>
          <strong className="text-[var(--ink)]">偏好设置</strong>
          （字号、滚动速度、提词框位置）：存储在本地。
        </li>
      </ul>

      <H2>语音跟随滚动（Pro 功能）</H2>
      <p className="mb-4 text-[var(--muted)]">
        录制中开启语音跟随时，你的麦克风音频会实时传输给 Google Gemini API
        进行语音转文字，用于让提词器跟随你的语速滚动。音频仅为转录而临时处理，我们不会用它识别你的身份；转录结果只在你的设备上用于定位台词，用完即弃。Google
        如何处理 API 数据请见{" "}
        <a
          className="text-[var(--accent)] underline"
          href="https://policies.google.com/privacy"
        >
          Google 隐私政策
        </a>
        。
      </p>

      <H2>订阅</H2>
      <p className="mb-4 text-[var(--muted)]">
        Pro 订阅由 Apple 通过你的 App Store 账户处理。我们使用 RevenueCat
        验证订阅状态；RevenueCat 只会收到 App
        生成的匿名标识符和购买凭证，不会收到你的姓名或联系方式。详见{" "}
        <a
          className="text-[var(--accent)] underline"
          href="https://www.revenuecat.com/privacy"
        >
          RevenueCat 隐私政策
        </a>
        。
      </p>

      <H2>权限</H2>
      <ul className="mb-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>
          <strong className="text-[var(--ink)]">相机与麦克风</strong>
          ——录制视频所必需。
        </li>
        <li>
          <strong className="text-[var(--ink)]">相册（仅添加）</strong>
          ——保存录制的视频所必需。
        </li>
      </ul>

      <H2>我们不做的事</H2>
      <ul className="mb-4 list-disc space-y-2 pl-5 text-[var(--muted)]">
        <li>没有账号、无需登录、不收集个人信息。</li>
        <li>没有任何分析或广告 SDK。</li>
        <li>不出售、不与第三方共享数据。</li>
      </ul>

      <H2>联系我们</H2>
      <p className="mb-4 text-[var(--muted)]">
        对本政策有疑问：{" "}
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
