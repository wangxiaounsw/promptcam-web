// 风格库上传的计划：先传新文件，再换 manifest，最后删旧文件。
// - 中途断了：桶里的 manifest 还是旧的、它引用的文件都还在，页面不会坏。
// - 换下来的旧文件多留一轮（写进新 manifest 的 keep），下次上传才删：页面缓存最长约 10 分钟，
//   这段时间里旧页面引用的旧文件不能 404。

const filesOf = (items) => items.flatMap((i) => [i.file, i.poster].filter(Boolean));

/** local / remote：两份 manifest 的 items（remote 为 null = 第一次上传）；remoteKeep：桶里 manifest 的 keep。 */
export function planUpload(local, remote, remoteKeep = []) {
  const remoteItems = remote ?? [];
  const remoteFiles = new Set(filesOf(remoteItems));
  const localFiles = new Set(filesOf(local));
  const remoteBy = new Map(remoteItems.map((i) => [i.code, i]));
  const localCodes = new Set(local.map((i) => i.code));

  const puts = filesOf(local).filter((f) => !remoteFiles.has(f)).map((path) => ({ op: 'put', path }));
  const keep = [...remoteFiles].filter((f) => !localFiles.has(f));
  const keepSet = new Set(keep);
  const deletes = [...new Set(remoteKeep)].filter((f) => !localFiles.has(f) && !keepSet.has(f)).map((path) => ({ op: 'delete', path }));

  const added = local.filter((i) => !remoteBy.has(i.code)).map((i) => i.code);
  const replaced = local
    .filter((i) => remoteBy.has(i.code))
    .filter((i) => { const r = remoteBy.get(i.code); return r.file !== i.file || r.poster !== i.poster; })
    .map((i) => i.code);
  const retired = remoteItems.filter((i) => !localCodes.has(i.code)).map((i) => i.code);

  return { steps: [...puts, { op: 'put', path: 'manifest.json' }, ...deletes], keep, added, replaced, retired };
}

/**
 * 编号永不换意思，拿桶里的 manifest 当底账（本地 tmp 会被清掉，桶里的不会）：
 * 桶里有的编号，本地要么来源相同，要么已下架；桶里已下架的，本地必须还是下架、来源不变。
 */
export function assertSameSources(local, remote) {
  if (!remote) return;
  const live = new Map((local.items ?? []).map((i) => [i.code, i.source]));
  const gone = new Map((local.retired ?? []).map((r) => [r.code, r.source]));
  const problems = [];
  for (const r of remote.items ?? []) {
    if (live.has(r.code) && live.get(r.code) !== r.source) problems.push(`${r.code}: 桶里是 ${r.source}，本地变成了 ${live.get(r.code)}`);
    if (!live.has(r.code) && !gone.has(r.code)) problems.push(`${r.code}: 本地没了，也没写下架`);
  }
  for (const r of remote.retired ?? []) {
    if (live.has(r.code)) problems.push(`${r.code}: 已经下架（${r.source}），不能再用`);
    else if (gone.get(r.code) !== r.source) problems.push(`${r.code}: 下架记录不见了或来源变了`);
  }
  if (problems.length) throw new Error(`编号对不上桶里的版本：\n  ${problems.join('\n  ')}`);
}
