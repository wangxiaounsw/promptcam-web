/** 两份提示词逐行对比：界面上显示「比上一版改了 N 处」并把改动行标出来。 */
export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string };

export function diffLines(before: string, after: string): DiffLine[] {
  return diffSeq(before.split('\n'), after.split('\n'));
}

/** 任意两串片段(行、句子)的对比 */
export function diffSeq(a: string[], b: string[]): DiffLine[] {
  // 最长公共子序列表，提示词几十行、口播稿几十句，O(n·m) 足够
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i++] });
      j++;
    } else if (j < b.length && (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      if (i < a.length && lcs[i][j + 1] === lcs[i + 1][j]) out.push({ kind: 'del', text: a[i++] });
      else out.push({ kind: 'add', text: b[j++] });
    } else {
      out.push({ kind: 'del', text: a[i++] });
    }
  }
  return out;
}

/** 连续的增删算一处 */
export function changeCount(before: string, after: string): number {
  let count = 0;
  let inChange = false;
  for (const line of diffLines(before, after)) {
    if (line.kind === 'same') {
      inChange = false;
    } else if (!inChange) {
      count++;
      inChange = true;
    }
  }
  return count;
}
