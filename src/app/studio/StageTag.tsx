import { stageLabel, toneOf, type Stage, type Tone } from '@/lib/studio/posts';

/** 进度小标签：颜色照全局约定（草稿灰虚线 / 定稿黄 / 已录成片绿 / 已发布紫） */
const STYLE: Record<Tone, string> = {
  todo: 'border border-dashed border-[#bbb] bg-[#fafafa] text-[#666]',
  final: 'bg-[#FDE7B0] text-[#7a4d00]',
  made: 'bg-[#DDF3E4] text-[#14532d]',
  done: 'bg-[#EDE4FA] text-[#4c1d95]',
};

export default function StageTag({ stage, industry = null }: { stage: Stage; industry?: string | null }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ${STYLE[toneOf(stage)]}`}>
      {stageLabel(stage, industry)}
    </span>
  );
}
