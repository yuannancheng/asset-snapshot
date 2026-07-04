import { formatPlainMoney, roundMoney, sumAmounts } from "./format";
import type { AnalysisItem, SnapshotAnalysis, SnapshotSummary } from "./types";
import type { TFunction } from "i18next";

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
  t: TFunction,
): string {
  if (!previous || !analysis || analysis.items.length === 0) return "\u2014";
  const assetChange = Number(summary.totalAsset) - Number(previous.totalAsset);
  const gap = roundMoney(assetChange - explainedAmount(analysis.items));
  const desc = buildAnalysisDescription(analysis.items, assetChange, gap, t);
  return desc || "\u2014";
}

export function buildAnalysisDescription(items: AnalysisItem[], assetChange: number, gap: number, t: TFunction) {
  const normalized = normalizeAnalysisItems(items)
    .map((item) => ({
      ...item,
      amount: sumAmounts(item.amounts),
    }))
    .filter((item) => item.amount !== 0);

  const sentences: string[] = [];

  const incomeParts: string[] = [];
  const expenseParts: string[] = [];
  for (const item of normalized) {
    if (item.type === "income") {
      incomeParts.push(t("analysis.incomeTemplate", { name: item.name, amount: formatPlainMoney(Math.abs(item.amount)) }));
    } else {
      expenseParts.push(t("analysis.expenseTemplate", { name: item.name, amount: formatPlainMoney(Math.abs(item.amount)) }));
    }
  }
  if (gap > 0) {
    incomeParts.push(t("analysis.otherIncome", { amount: formatPlainMoney(gap) }));
  } else if (gap < 0) {
    expenseParts.push(t("analysis.otherExpense", { amount: formatPlainMoney(Math.abs(gap)) }));
  }
  if (incomeParts.length > 0) {
    sentences.push(incomeParts.join("\uFF0C") + "\u3002");
  }
  if (expenseParts.length > 0) {
    sentences.push(expenseParts.join("\uFF0C") + "\u3002");
  }

  const summary =
    assetChange >= 0
      ? t("analysis.increaseTemplate", { amount: formatPlainMoney(Math.abs(assetChange)) })
      : t("analysis.decreaseTemplate", { amount: formatPlainMoney(Math.abs(assetChange)) });
  sentences.push(summary);

  return sentences.join("");
}
