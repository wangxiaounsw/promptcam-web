import type { Metadata } from 'next';
import ApplyGate from './ApplyGate';

export const metadata: Metadata = {
  title: '申请开通 · Fordexa 口播助手',
  description: '律师、会计、移民中介的口播内容服务：我们写选题、你念一遍、我们剪辑发布。留下公司名申请开通。',
  alternates: { canonical: 'https://app.fordexa.com/apply' },
};

/** 路人的出口。首页和页头都指到这里 */
export default function ApplyPage() {
  return (
    <main className="mx-auto max-w-md px-6 pb-24 pt-16">
      <p className="mb-4 text-xs font-semibold tracking-wide text-[var(--accent)]">申请开通</p>
      <h1 className="font-display text-3xl font-bold leading-[1.25]">成为 Fordexa 客户</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
        这是一项服务，不是 App 内购：我们按你的行业写选题、你照着念、我们剪好发出去。
        先留下公司和行业，我们会联系你聊聊适合讲什么。
      </p>
      <ApplyGate />
    </main>
  );
}
