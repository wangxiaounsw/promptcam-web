import { admin, configured } from '@/lib/auth';

/**
 * 审稿页的「事实核对」:调研的事实表 + 官网原句标黄截图。
 * 由 scripts/review.mjs facts 写进私有桶 fact-check/<编号>/(facts.json + <n>.png),
 * 只有管理员接口读得到,截图用临时签名链接给出去。
 */

export const FACTS_BUCKET = 'fact-check';
const SIGN_SECONDS = 60 * 60;

export type FactShot = { ok: true; file: string; url: string; found: string } | { ok: false; reason: string };

export type ReviewFact = {
  n: number;
  claim: string;
  quote: string;
  source: string;
  urls: string[];
  /** 出处写「同第 N 条」时,链接沿用的是第几条 */
  urlsFrom?: number;
  published: string;
  key: boolean;
  shot: FactShot;
  /** 截图的临时链接(读的时候签的) */
  shotUrl?: string;
};

export type ReviewFacts = {
  updatedAt: string;
  title: string;
  warnings: string[];
  missing: string[];
  facts: ReviewFact[];
};

/** 跑过事实核对的编号(桶里一个编号一个文件夹),审稿列表标「有截图」用 */
export async function listFactCodes(): Promise<Set<string>> {
  if (!configured) return new Set();
  const { data } = await admin().storage.from(FACTS_BUCKET).list('', { limit: 1000 });
  return new Set((data ?? []).map((d) => d.name).filter((n) => /^FX-\d{4}$/.test(n)));
}

/**
 * 编号对应的事实核对;没跑过 facts 就是 null。
 * sign=false 不签截图链接(审稿页轮询只看 updatedAt 变没变,省一次请求)。
 */
export async function loadReviewFacts(code: string, { sign = true }: { sign?: boolean } = {}): Promise<ReviewFacts | null> {
  if (!configured || !/^FX-\d{4}$/.test(code)) return null;
  const store = admin().storage.from(FACTS_BUCKET);
  const { data: blob, error } = await store.download(`${code}/facts.json`);
  if (error || !blob) return null;
  let parsed: ReviewFacts;
  try {
    parsed = JSON.parse(await blob.text()) as ReviewFacts;
  } catch {
    return null;
  }
  if (!sign) return parsed;
  const files = parsed.facts.flatMap((f) => (f.shot.ok ? [`${code}/${f.shot.file}`] : []));
  const signed = files.length ? (await store.createSignedUrls(files, SIGN_SECONDS)).data ?? [] : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return {
    ...parsed,
    facts: parsed.facts.map((f) => (f.shot.ok ? { ...f, shotUrl: urlOf.get(`${code}/${f.shot.file}`) ?? undefined } : f)),
  };
}
