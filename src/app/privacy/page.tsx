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
          href="mailto:wangxiaounsw@gmail.com"
        >
          wangxiaounsw@gmail.com
        </a>
      </p>
    </main>
  );
}
