import { formatPlainMoney, roundMoney, sumAmounts } from "./format";
import type { AnalysisItem, SnapshotAnalysis, SnapshotSummary } from "./types";

export function emptyAnalysisItem(type: "income" | "expense"): AnalysisItem {
  return { type, name: "", amounts: [""] };
}

export function normalizeAnalysisItems(items: AnalysisItem[]) {
  return items
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      amounts: item.amounts.map((amount) => amount.trim()).filter(Boolean),
    }))
    .filter((item) => item.name || item.amounts.length > 0);
}

export function previousSummaryFor(summaries: SnapshotSummary[], snapshotId: number) {
  const sorted = [...summaries].sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);
    return dateCompare === 0 ? left.snapshotId - right.snapshotId : dateCompare;
  });
  const index = sorted.findIndex((summary) => summary.snapshotId === snapshotId);
  return index > 0 ? sorted[index - 1] : undefined;
}

export function explainedAmount(items: AnalysisItem[]) {
  return items.reduce((total, item) => {
    const itemTotal = sumAmounts(item.amounts);
    return total + (item.type === "income" ? itemTotal : -itemTotal);
  }, 0);
}

export function snapshotAnalysisDesc(
  summary: SnapshotSummary,
  previous: SnapshotSummary | undefined,
  analysis: SnapshotAnalysis | undefined,
): string {
  if (!previous || !analysis || analysis.items.length === 0) return "—";
  const assetChange = Number(summary.totalAsset) - Number(previous.totalAsset);
  const gap = roundMoney(assetChange - explainedAmount(analysis.items));
  const desc = buildAnalysisDescription(analysis.items, assetChange, gap);
  return desc || "—";
}

export function buildAnalysisDescription(items: AnalysisItem[], assetChange: number, gap: number) {
  const normalized = normalizeAnalysisItems(items)
    .map((item) => ({
      ...item,
      amount: sumAmounts(item.amounts),
    }))
    .filter((item) => item.amount !== 0);

  const sentences: string[] = [];

  // Separate income and expense items
  const incomeParts: string[] = [];
  const expenseParts: string[] = [];
  for (const item of normalized) {
    if (item.type === "income") {
      incomeParts.push(`${item.name}收入${formatPlainMoney(Math.abs(item.amount))}元`);
    } else {
      expenseParts.push(`${item.name}支出${formatPlainMoney(Math.abs(item.amount))}元`);
    }
  }
  // Remaining gap: positive goes to income, negative goes to expense
  if (gap > 0) {
    incomeParts.push(`其余收入${formatPlainMoney(gap)}元`);
  } else if (gap < 0) {
    expenseParts.push(`其余支出${formatPlainMoney(Math.abs(gap))}元`);
  }
  if (incomeParts.length > 0) {
    sentences.push(incomeParts.join("，") + "。");
  }
  if (expenseParts.length > 0) {
    sentences.push(expenseParts.join("，") + "。");
  }

  // Summary sentence
  const summary =
    assetChange >= 0
      ? `总资产增加${formatPlainMoney(Math.abs(assetChange))}元。`
      : `总资产减少${formatPlainMoney(Math.abs(assetChange))}元。`;
  sentences.push(summary);

  return sentences.join("");
}
