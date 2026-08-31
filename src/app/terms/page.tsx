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
    </main>
  );
}
