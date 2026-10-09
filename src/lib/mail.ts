/**
 * 发信。只有两封:
 *   1. 客户提交灵感  → 发给 Fordexa(否则没人知道队列里来了新东西)
 *   2. Fordexa 下发稿子 → 发给客户
 *
 * 没配环境变量时整个发信静默跳过 —— 发信失败绝不能让「下发稿子」这件事失败。
 * 稿子已经进了客户的口播库,他打开 App 照样看得到,只是少一封提醒。
 */

const FROM = process.env.MAIL_FROM ?? '';
const ADMIN = process.env.MAIL_ADMIN ?? '';
const KEY = process.env.RESEND_API_KEY ?? '';

export const mailReady = Boolean(FROM && KEY);

type Mail = { to: string; subject: string; html: string; replyTo?: string };

async function send({ to, subject, html, replyTo }: Mail): Promise<boolean> {
  if (!mailReady || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error('mail failed', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('mail error', e);
    return false;
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 纯文本邮件外壳。不用图片、不用外链 CSS —— 律师的 Outlook 能原样渲染。 */
const shell = (body: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Microsoft YaHei',sans-serif;
            max-width:560px;margin:0 auto;padding:28px 24px;color:#121815;line-height:1.7;font-size:15px">
${body}
<p style="margin-top:32px;padding-top:20px;border-top:1px solid #e8ecea;font-size:13px;color:#55605a">
  Fordexa 口播助手 · <a href="https://app.fordexa.com" style="color:#0f7b45;text-decoration:none">app.fordexa.com</a>
</p>
</div>`;

/** 稿子写好了,通知客户。带上标题和开头几句 —— 他在地铁上扫一眼就知道该不该现在录。 */
export function mailScriptReady(opts: {
  to: string;
  title: string;
  body: string;
}): Promise<boolean> {
  const excerpt = opts.body.replace(/\s+/g, ' ').trim().slice(0, 120);
  return send({
    to: opts.to,
    subject: `你的新口播稿到了：${opts.title}`,
    html: shell(`
<p style="margin:0 0 6px;font-size:13px;color:#0f7b45;font-weight:700">新口播稿</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.35">${esc(opts.title)}</h1>
<p style="margin:0 0 20px;color:#55605a">${esc(excerpt)}${opts.body.length > 120 ? '……' : ''}</p>
<p style="margin:0 0 6px">打开「Fordexa 口播助手」，它就在<strong>口播库</strong>的最上面。</p>
<p style="margin:0;color:#55605a">举起手机照着念一遍，录完发回给我们，剪辑和发布我们来。</p>`),
  });
}

/** 客户提交了灵感,通知 Fordexa。reply_to 设成客户邮箱,直接回信就能问他。 */
export function mailIdeaSubmitted(opts: {
  from: string;
  body: string;
  note?: string | null;
  fromBank: boolean;
}): Promise<boolean> {
  if (!ADMIN) return Promise.resolve(false);
  return send({
    to: ADMIN,
    replyTo: opts.from || undefined,
    subject: `新提交：${opts.body.replace(/\s+/g, ' ').trim().slice(0, 40)}`,
    html: shell(`
<p style="margin:0 0 6px;font-size:13px;color:#0f7b45;font-weight:700">
  ${opts.fromBank ? '选题库' : '客户自己记的'}
</p>
<h1 style="margin:0 0 6px;font-size:20px;line-height:1.4">${esc(opts.body)}</h1>
<p style="margin:0 0 18px;font-size:13px;color:#55605a">来自 ${esc(opts.from || '未知账号')}</p>
${
  opts.note
    ? `<p style="margin:0 0 18px;padding-left:14px;border-left:3px solid #e8ecea;color:#55605a">
         ${esc(opts.note)}
       </p>`
    : ''
}
<p style="margin:0">
  <a href="https://app.fordexa.com/admin"
     style="display:inline-block;background:#0f7b45;color:#fff;text-decoration:none;
            padding:12px 22px;border-radius:10px;font-weight:600">去后台写稿</a>
</p>`),
  });
}
