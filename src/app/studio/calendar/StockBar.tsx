import type { CalendarData } from '@/lib/studio/posts-map';

/** 月历上方一行：做好的够发到哪天 */
export default function StockBar({ stock }: { stock: CalendarData['stock'] }) {
  const head = stock.until
    ? `做好的够发到 ${Number(stock.until.slice(5, 7))} 月 ${Number(stock.until.slice(8, 10))} 日`
    : '还没有做好的';
  const parts = [head];
  if (stock.making > 0) parts.push(`还在做 ${stock.making} 条`);
  if (stock.unread > 0) parts.push(`${stock.unread} 条新备注`);
  return <p className="mt-3 rounded-2xl bg-[var(--bg-raised)] px-4 py-3 text-[15px] font-medium">{parts.join(' · ')}</p>;
}
