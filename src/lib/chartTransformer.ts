import { formatDate, parseDate, startOfDay, today } from "./date";
import type { SnapshotSummary } from "./types";
import type { TimeRangeKey } from "../components/TimeRangeTabs";
import type { TFunction } from "i18next";

export type TrendPoint = {
  date: string;
  fullDate: string;
  xTick?: string;
} & Record<string, string | number>;

export function polynomialRegression(points: TrendPoint[], totalKey: string): TrendPoint[] {
  const n = points.length;
  if (n < 2) return points;

  const DEGREE = Math.min(2, n - 2);
  const M = DEGREE + 1;

  const first = parseDate(points[0].fullDate)?.getTime() ?? 0;
  const last = parseDate(points[n - 1].fullDate)?.getTime() ?? 1;
  const span = Math.max(last - first, 1);

  const xs = points.map((p) => {
    const t = parseDate(p.fullDate)?.getTime() ?? first;
    return (t - first) / span;
  });
  const ys = points.map((p) => p[totalKey] as number);

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

  const mat: number[][] = A.map((row, i) => [...row, B[i]]);

  for (let col = 0; col < M; col++) {
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
  const trendKey = totalKey + "TrendLabel";

  return points.map((pt, i) => {
    const t = xs[i];
    let y = 0;
    let tp = 1;
    for (let d = 0; d < M; d++) {
      y += coeffs[d] * tp;
      tp *= t;
    }
    return { ...pt, [trendKey]: Number(y.toFixed(2)) };
  });
}

export function buildTrendData(
  summaries: SnapshotSummary[],
  range: TimeRangeKey,
  customRange: { start: string; end: string },
  t: TFunction,
) {
  const totalKey = t("dashboard.totalAssetLegend");
  const trendKey = t("dashboard.totalAssetTrend");

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

  const rawPoints = visibleSummaries.map((summary) => trendPoint(summary, totalKey));
  const points = polynomialRegression(rawPoints, totalKey);

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
    rangeLabel: `${formatDate(bounds.start)}${t("dashboard.rangeSeparator")}${formatDate(bounds.end)}`,
    totalKey,
    trendKey,
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

function trendPoint(summary: SnapshotSummary, totalKey: string): TrendPoint {
  const date = parseDate(summary.date) ?? today();
  return {
    date: `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`,
    fullDate: summary.date,
    [totalKey]: Number(summary.totalAsset),
    ...Object.fromEntries(
      summary.platformAssets.map((item) => [item.platformName, Number(item.amount)]),
    ),
  };
}
