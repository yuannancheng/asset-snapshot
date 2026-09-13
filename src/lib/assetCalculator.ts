import { formatPlainMoney, roundMoney, sumAmounts } from "./format";
import type { AnalysisItem, AnalysisItemType, SnapshotAnalysis, SnapshotSummary } from "./types";
import type { TFunction } from "i18next";

/** How many earlier snapshots are inspected when looking for recurring items. */
export const RECURRING_SNAPSHOT_WINDOW = 3;
/** How many of those snapshots must contain the same item for it to be suggested. */
export const RECURRING_MIN_OCCURRENCES = 2;

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

function recurringKey(type: AnalysisItemType, name: string, amount: number) {
  return `${type}\u0000${name.trim().toLowerCase()}\u0000${amount}`;
}

function itemNameKey(type: AnalysisItemType, name: string) {
  return `${type}\u0000${name.trim().toLowerCase()}`;
}

/**
 * Collect analysis items that repeat across the snapshots right before the given
 * one: an item counts as recurring when the same name and amount of the same type
 * appears in at least `RECURRING_MIN_OCCURRENCES` of the previous
 * `RECURRING_SNAPSHOT_WINDOW` snapshots. Items whose name already exists in
 * `existingItems` are skipped, so the suggestion disappears once everything has
 * been imported.
 */
export function recurringAnalysisItems(
  summaries: SnapshotSummary[],
  analyses: SnapshotAnalysis[],
  snapshotId: number,
  existingItems: AnalysisItem[],
  window = RECURRING_SNAPSHOT_WINDOW,
) {
  const sorted = [...summaries].sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);
    return dateCompare === 0 ? left.snapshotId - right.snapshotId : dateCompare;
  });
  const index = sorted.findIndex((summary) => summary.snapshotId === snapshotId);
  if (index <= 0) return [];

  const recent = sorted.slice(Math.max(0, index - window), index);
  if (recent.length < RECURRING_MIN_OCCURRENCES) return [];

  const existingNames = new Set(existingItems.map((item) => itemNameKey(item.type, item.name)));
  const found = new Map<
    string,
    { type: AnalysisItemType; name: string; amount: number; snapshots: Set<number> }
  >();

  for (const summary of recent) {
    const analysis = analyses.find((entry) => entry.snapshotId === summary.snapshotId);
    if (!analysis) continue;
    for (const item of normalizeAnalysisItems(analysis.items)) {
      const amount = sumAmounts(item.amounts);
      if (amount === 0) continue;
      const key = recurringKey(item.type, item.name, amount);
      const entry = found.get(key);
      if (entry) {
        entry.snapshots.add(summary.snapshotId);
      } else {
        found.set(key, {
          type: item.type,
          name: item.name,
          amount,
          snapshots: new Set([summary.snapshotId]),
        });
      }
    }
  }

  return [...found.entries()]
    .filter(
      ([, entry]) =>
        entry.snapshots.size >= RECURRING_MIN_OCCURRENCES &&
        !existingNames.has(itemNameKey(entry.type, entry.name)),
    )
    .sort(([, left], [, right]) => {
      if (left.snapshots.size !== right.snapshots.size) return right.snapshots.size - left.snapshots.size;
      const typeCompare = left.type.localeCompare(right.type);
      return typeCompare === 0 ? left.name.localeCompare(right.name) : typeCompare;
    })
    .map(([, entry]) => ({
      type: entry.type,
      name: entry.name,
      amounts: [formatPlainMoney(entry.amount)],
    }));
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
