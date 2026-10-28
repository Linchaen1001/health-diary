// n 項目に合計が厳密に 100 となるよう按分する。余りは先頭から 1 点ずつ。
export function allocateWeights(n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n must be a positive integer');
  const base = Math.floor(100 / n);
  const rem = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}
