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
  title: "Fordexa 口播助手 — 选题我们写好，你只管举起手机念",
  description:
    "Fordexa 为客户准备的口播视频工具。我们按你的行业写好选题推到你的账号里，你打开 App 照着念、录完发回来，剪辑和发布由我们做。台词只在你的屏幕上，不进视频。Fordexa Teleprompter for law, accounting and migration practices.",
  openGraph: {
    title: "Fordexa 口播助手",
    description:
      "选题我们写好，你只管举起手机念一遍。台词不入镜，语音跟随滚动。",
    url: "https://app.fordexa.com",
    siteName: "Fordexa 口播助手",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${display.variable} ${body.variable}`}>
        {children}
      </body>
    </html>
  );
}
