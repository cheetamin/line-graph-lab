// 그래프 해석용 통계 (가장 큰 값, 가장 작은 값, 변화가 가장 큰 시기)
export function round1(v) { return Math.round(v * 10) / 10; }

export function computeStats(labels, values) {
  const idx = values.map((v, i) => [v, i]).filter(([v]) => v !== null && v !== undefined && Number.isFinite(Number(v)));
  if (!idx.length) return null;
  const vals = idx.map(([v]) => Number(v));
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const maxIdx = idx.filter(([v]) => Number(v) === max).map(([, i]) => i);
  const minIdx = idx.filter(([v]) => Number(v) === min).map(([, i]) => i);
  let best = -1; let changes = [];
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1]; const b = values[i];
    if (a === null || b === null || a === undefined || b === undefined) continue;
    const d = Math.abs(Number(b) - Number(a));
    if (d > best + 1e-9) { best = d; changes = [i]; } else if (Math.abs(d - best) < 1e-9) changes.push(i);
  }
  return {
    max, min,
    maxIdx, minIdx,
    maxLabels: maxIdx.map((i) => labels[i]),
    minLabels: minIdx.map((i) => labels[i]),
    change: best >= 0 ? round1(best) : null,
    changeIdx: changes, // i: labels[i-1] → labels[i]
    changeLabels: changes.map((i) => `${labels[i - 1]}~${labels[i]}`),
    changeDir: changes.map((i) => (Number(values[i]) > Number(values[i - 1]) ? '늘어남' : Number(values[i]) < Number(values[i - 1]) ? '줄어듦' : '같음')),
  };
}
