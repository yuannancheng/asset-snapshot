import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DatePicker } from "../DatePicker";
import { Label } from "../Field";
import { TimeRangeTabs, type TimeRangeKey } from "../TimeRangeTabs";
import { money } from "../../lib/format";
import type { Platform, SnapshotSummary } from "../../lib/types";

type TrendResult = {
  points: Array<{ date: string; [key: string]: string | number }>;
  rangeLabel: string;
  yearTicks: string[];
  totalKey: string;
  trendKey: string;
};

export function TrendCharts({
  trend,
  timeRange,
  setTimeRange,
  customRange,
  setCustomRange,
  lastSummary,
  platforms,
  platformColorFor,
}: {
  trend: TrendResult;
  timeRange: TimeRangeKey;
  setTimeRange: (v: TimeRangeKey) => void;
  customRange: { start: string; end: string };
  setCustomRange: (updater: (current: { start: string; end: string }) => { start: string; end: string }) => void;
  lastSummary: SnapshotSummary | undefined;
  platforms: Platform[];
  platformColorFor: (platformId: number, index: number) => string;
}) {
  const { t } = useTranslation();

  const sortedPlatformAssets = useMemo(() => {
    if (!lastSummary) return [];
    const orderMap = new Map(platforms.map((p, i) => [p.id, i]));
    return [...lastSummary.platformAssets].sort(
      (a, b) => (orderMap.get(a.platformId) ?? Infinity) - (orderMap.get(b.platformId) ?? Infinity)
    );
  }, [lastSummary, platforms]);

  const multiYear = trend.yearTicks.length > 1;
  const trendLineDataKey = trend.totalKey + "TrendLabel";

  return (
    <div className="rounded-xl bg-panel p-4 shadow-panel sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">{t("dashboard.trendTitle")}</h2>
        <TimeRangeTabs value={timeRange} onChange={setTimeRange} />
      </div>
      {timeRange === "custom" ? (
        <div className="mb-4 grid gap-3 rounded-md bg-subtle p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          <div className="space-y-2">
            <Label>{t("timeRange.startDate")}</Label>
            <DatePicker
              value={customRange.start}
              onChange={(value) => setCustomRange((current) => ({ ...current, start: value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("timeRange.endDate")}</Label>
            <DatePicker
              value={customRange.end}
              onChange={(value) => setCustomRange((current) => ({ ...current, end: value }))}
            />
          </div>
        </div>
      ) : null}
      {trend.points.length === 0 ? (
        <div className="py-16 text-center text-sm text-ink/45">{t("dashboard.noData")}</div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="shrink-0 lg:w-1/4">
            <h3 className="mb-3 text-sm font-medium text-ink/55">{t("dashboard.distributionTitle")}</h3>
            {lastSummary ? (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={sortedPlatformAssets.map((pa, idx) => ({
                        name: pa.platformName,
                        value: Number(pa.amount),
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                    >
                      {sortedPlatformAssets.map((pa, idx) => (
                        <Cell key={pa.platformName} fill={platformColorFor(pa.platformId, idx)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgb(var(--color-panel))",
                        border: "1px solid rgb(var(--color-ink) / 0.1)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "rgb(var(--color-ink))",
                      }}
                      wrapperStyle={{ outline: "none" }}
                      labelStyle={{ color: "rgb(var(--color-ink))" }}
                      itemStyle={{ color: "rgb(var(--color-ink))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 text-sm">
                  {sortedPlatformAssets.map((pa, idx) => (
                    <div key={pa.platformName} className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ background: platformColorFor(pa.platformId, idx) }}
                      />
                      <span className="text-ink/65">{pa.platformName}</span>
                      <span className="font-medium text-ink">{money(pa.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-ink/45">{t("dashboard.noSnapshotData")}</div>
            )}
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-ink) / 0.08)" />
                <XAxis
                  dataKey={multiYear ? "xTick" : "date"}
                  ticks={multiYear ? trend.yearTicks : undefined}
                  tickFormatter={multiYear ? (value: string) => (value ? value.slice(0, 4) : "") : undefined}
                  tick={{ fontSize: 12 }}
                  stroke="rgb(var(--color-ink) / 0.25)"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="rgb(var(--color-ink) / 0.25)" />
                <Tooltip
                  labelFormatter={(_label: any, payload: any[]) => payload?.[0]?.payload?.fullDate ?? ""}
                  contentStyle={{
                    background: "rgb(var(--color-panel))",
                    border: "1px solid rgb(var(--color-ink) / 0.1)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "rgb(var(--color-ink))",
                  }}
                  wrapperStyle={{ outline: "none" }}
                  labelStyle={{ color: "rgb(var(--color-ink))" }}
                  itemStyle={{ color: "rgb(var(--color-ink))" }}
                />
                <Line type="linear" dataKey={trend.totalKey} stroke="#70ad47" strokeWidth={2} dot={true} />
                {platforms.map((platform, idx) => (
                  <Line
                    key={platform.id}
                    type="linear"
                    dataKey={platform.name}
                    stroke={platformColorFor(platform.id, idx)}
                    strokeWidth={1.5}
                    dot={true}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey={trendLineDataKey}
                  stroke="#70ad47"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name={trend.trendKey}
                />
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink/55">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-full" style={{ background: "#48634f" }} />
                {trend.totalKey}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block size-3 rounded-full border-2 border-dotted"
                  style={{ borderColor: "#70ad47" }}
                />
                {trend.trendKey}
              </span>
              {platforms.map((platform, idx) => (
                <span key={platform.id} className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-full" style={{ background: platformColorFor(platform.id, idx) }} />
                  {platform.name}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink/45">
              {trend.rangeLabel} · {trend.points.length} {t("dashboard.nodeCount")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
