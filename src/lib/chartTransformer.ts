import { formatDate, parseDate, startOfDay, today } from "./date";
import type { SnapshotSummary } from "./types";
import type { TimeRangeKey } from "../components/TimeRangeTabs";

export type TrendPoint = {
  date: string;
  fullDate: string;
  /** fullDate for year-start data points; used as XAxis tick when multi-year */
  xTick?: string;
  总资产: number;
  "总资产（趋势线）"?: number;
} & Record<string, string | number>;

/**
 * Fit a polynomial trend line to the total-asset series
 * y = a0 + a1·x + a2·x² + … + an·xⁿ
 * using least-squares regression.
 *
 * The polynomial degree is dynamically adjusted based
 * on the number of data points to avoid overfitting.
 *
 * X values are normalized to [0, 1] based on time.
 */
export function polynomialRegression(points: TrendPoint[]): TrendPoint[] {
  const n = points.length;
  if (n < 2) return points;

  const DEGREE = Math.min(2, n - 2);
  const M = DEGREE + 1;

  const first = parseDate(points[0].fullDate)?.getTime() ?? 0;
  const last = parseDate(points[n - 1].fullDate)?.getTime() ?? 1;
  const span = Math.max(last - first, 1);

  // Normalize x to [0, 1]
  const xs = points.map((p) => {
    const t = parseDate(p.fullDate)?.getTime() ?? first;
    return (t - first) / span;
  });
  const ys = points.map((p) => p["总资产"]);

  // Build normal equations: A[i][j] = sum(x^(i+j)), B[i] = sum(y * x^i)
  const A: number[][] = Array.from({ length: M }, () => Array(M).fill(0));
  const B: number[] = Array(M).fill(0);

  for (let k = 0; k < n; k++) {
    const x = xs[k];
    const y = ys[k];
    let xp = 1;
    for (let i = 0; i < M; i++) {
      B[i] += y * xp;
      let xq = xp;
      for (let j = 0; j < M; j++) {
        A[i][j] += xq;
        xq *= x;
      }
      xp *= x;
    }
  }

  // Augmented matrix for Gaussian elimination
  const mat: number[][] = A.map((row, i) => [...row, B[i]]);

  for (let col = 0; col < M; col++) {
    // Partial pivot
    let maxRow = col;
    let maxVal = Math.abs(mat[col][col]);
    for (let row = col + 1; row < M; row++) {
      const v = Math.abs(mat[row][col]);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }
    [mat[col], mat[maxRow]] = [mat[maxRow], mat[col]];

    const pivot = mat[col][col];
    if (Math.abs(pivot) < 1e-15) continue;

    for (let j = col; j <= M; j++) {
      mat[col][j] /= pivot;
    }

    for (let row = 0; row < M; row++) {
      if (row === col) continue;
      const factor = mat[row][col];
      for (let j = col; j <= M; j++) {
        mat[row][j] -= factor * mat[col][j];
      }
    }
  }

  const coeffs = mat.map((row) => row[M]);

  // Evaluate the polynomial at each original point's normalized x
  return points.map((pt, i) => {
    const t = xs[i];
    let y = 0;
    let tp = 1;
    for (let d = 0; d < M; d++) {
      y += coeffs[d] * tp;
      tp *= t;
    }
    return { ...pt, "总资产（趋势线）": Number(y.toFixed(2)) };
  });
}

export function buildTrendData(
  summaries: SnapshotSummary[],
  range: TimeRangeKey,
  customRange: { start: string; end: string },
) {
  const sortedSummaries = [...summaries].sort((left, right) => left.date.localeCompare(right.date));
  const lastSummary = sortedSummaries[sortedSummaries.length - 1];
  const anchorDate = parseDate(lastSummary?.date) ?? today();
  const bounds = rangeBounds(range, customRange, anchorDate);
  const startTime = bounds.start.getTime();
  const endTime = bounds.end.getTime();
  const visibleSummaries = sortedSummaries.filter((summary) => {
    const date = parseDate(summary.date);
    if (!date) return false;
    const time = date.getTime();
    return time >= startTime && time <= endTime;
  });

  const rawPoints = visibleSummaries.map((summary) => trendPoint(summary));
  const points = polynomialRegression(rawPoints);

  // Mark first data point of each year for XAxis year ticks
  const yearTicks: string[] = [];
  let prevYear: number | null = null;
  for (const pt of points) {
    const d = parseDate(pt.fullDate);
    if (d) {
      const y = d.getFullYear();
      if (y !== prevYear) {
        pt.xTick = pt.fullDate;
        yearTicks.push(pt.fullDate);
        prevYear = y;
      }
    }
  }

  return {
    points,
    yearTicks,
    visibleCount: visibleSummaries.length,
    rangeLabel: `${formatDate(bounds.start)} 至 ${formatDate(bounds.end)}`,
  };
}

function rangeBounds(
  range: TimeRangeKey,
  customRange: { start: string; end: string },
  anchorDate: Date,
) {
  if (range === "custom") {
    const start = parseDate(customRange.start) ?? anchorDate;
    const end = parseDate(customRange.end) ?? anchorDate;
    return normalizeBounds(start, end);
  }

  const end = new Date(anchorDate);
  const start = new Date(anchorDate);
  if (range === "1y") {
    start.setFullYear(start.getFullYear() - 1);
  } else if (range === "3y") {
    start.setFullYear(start.getFullYear() - 3);
  } else {
    start.setFullYear(start.getFullYear() - 5);
  }
  return normalizeBounds(start, end);
}

function normalizeBounds(start: Date, end: Date) {
  const normalizedStart = startOfDay(start);
  const normalizedEnd = startOfDay(end);
  if (normalizedStart.getTime() <= normalizedEnd.getTime()) {
    return { start: normalizedStart, end: normalizedEnd };
  }
  return { start: normalizedEnd, end: normalizedStart };
}

function trendPoint(summary: SnapshotSummary): TrendPoint {
  const date = parseDate(summary.date) ?? today();
  return {
    date: `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`,
    fullDate: summary.date,
    总资产: Number(summary.totalAsset),
    ...Object.fromEntries(
      summary.platformAssets.map((item) => [item.platformName, Number(item.amount)]),
    ),
  };
}

