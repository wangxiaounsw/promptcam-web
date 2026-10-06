import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // 旧域名现已 308 重定向到这里，canonical/OG 要指最终地址
  metadataBase: new URL("https://app.fordexa.com"),
  title: "Prompt Cam — the teleprompter that never shows in your video",
  description:
    "Record talking-head videos with a scrolling script overlay that stays on your screen only. Voice-follow scrolling matches your natural speaking pace. 提词相机——台词不入镜的提词器录像机。",
  openGraph: {
    title: "Prompt Cam — read your script, look at the camera",
    description:
      "The teleprompter overlay never appears in your recording. Voice-follow scrolling included.",
    url: "https://www.promptcam.app",
    siteName: "Prompt Cam",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        {children}
      </body>
    </html>
  );
}
