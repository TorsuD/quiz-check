/** Small, dependency-free statistics helpers for the results dashboard. */

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function pct(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

/** Share of paired ratings where both raters gave the same category (0–100). */
export function percentAgreement<T>(pairs: [T, T][]): number | null {
  if (pairs.length === 0) return null;
  return (pairs.filter(([a, b]) => a === b).length / pairs.length) * 100;
}

/**
 * Cohen's kappa for two raters and nominal categories: agreement corrected for chance.
 * Returns null when it is undefined (no pairs, or both raters used one identical category
 * for everything, so chance agreement is 100%).
 */
export function cohensKappa<T>(pairs: [T, T][]): number | null {
  const n = pairs.length;
  if (n === 0) return null;
  const observed = pairs.filter(([a, b]) => a === b).length / n;
  const countsA = new Map<T, number>();
  const countsB = new Map<T, number>();
  for (const [a, b] of pairs) {
    countsA.set(a, (countsA.get(a) ?? 0) + 1);
    countsB.set(b, (countsB.get(b) ?? 0) + 1);
  }
  let expected = 0;
  for (const [cat, ca] of countsA) expected += (ca / n) * ((countsB.get(cat) ?? 0) / n);
  if (expected >= 1) return null;
  return (observed - expected) / (1 - expected);
}

/** Landis & Koch (1977) labels, the conventional way to describe a kappa value. */
export function describeKappa(kappa: number | null): string {
  if (kappa === null) return "not defined";
  if (kappa < 0) return "poor";
  if (kappa <= 0.2) return "slight";
  if (kappa <= 0.4) return "fair";
  if (kappa <= 0.6) return "moderate";
  if (kappa <= 0.8) return "substantial";
  return "almost perfect";
}

/** Ranks with ties given their average rank (1-based). */
function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const result = new Array<number>(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) result[order[k][1]] = avg;
    i = j + 1;
  }
  return result;
}

function pearson(x: number[], y: number[]): number | null {
  const mx = mean(x)!;
  const my = mean(y)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Spearman's rank correlation (−1 to 1). Null with fewer than 3 points or when either
 * variable is constant. No p-value: with a handful of questions, report it as descriptive.
 */
export function spearman(pairs: [number, number][]): number | null {
  if (pairs.length < 3) return null;
  return pearson(ranks(pairs.map((p) => p[0])), ranks(pairs.map((p) => p[1])));
}

/** Counts of each value 1..max. */
export function distribution(values: number[], max = 5): number[] {
  const counts = new Array<number>(max).fill(0);
  for (const v of values) if (v >= 1 && v <= max) counts[v - 1]++;
  return counts;
}
