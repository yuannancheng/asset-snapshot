import { Download, Loader2, Repeat, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { Label } from "../Field";
import { Modal } from "../Modal";
import { AnalysisColumn } from "./AnalysisColumn";
import { money, signedAmount, sumAmounts } from "../../lib/format";
import { formatSnapshotMoment } from "../../lib/date";
import type { AnalysisItem, SnapshotSummary } from "../../lib/types";

export function AnalysisModal({
  open,
  onClose,
  analysisItems,
  analysisSummary,
  analysisPrevious,
  analysisChange,
  analysisGap,
  analysisDescription,
  recurringItems,
  recurringWindow,
  onSave,
  onImportRecurring,
  addAnalysisItem,
  updateAnalysisItem,
  removeAnalysisItem,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  analysisItems: AnalysisItem[];
  analysisSummary: SnapshotSummary | undefined;
  analysisPrevious: SnapshotSummary | undefined;
  analysisChange: number;
  analysisGap: number;
  analysisDescription: string;
  recurringItems: AnalysisItem[];
  recurringWindow: number;
  onSave: () => void;
  onImportRecurring: () => void;
  addAnalysisItem: (type: "income" | "expense") => void;
  updateAnalysisItem: (index: number, item: AnalysisItem) => void;
  removeAnalysisItem: (index: number) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      title={t("analysis.title")}
      description={t("analysis.description")}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
          {analysisPrevious ? (
            <Button
              type="button"
              variant="primary"
              onClick={onSave}
              disabled={saving}
            >
              <Save size={16} />
              {t("common.save")}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="relative space-y-5">
        {saving ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-panel/75">
            <div className="flex items-center gap-3 text-sm text-ink/70">
              <Loader2 size={20} className="animate-spin text-mint" />
              {t("common.saving")}
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-subtle p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-ink/55">{t("analysis.currentTotal")}</p>
              {analysisSummary ? (
                <p className="shrink-0 text-xs text-ink/40">
                  {formatSnapshotMoment(analysisSummary.date, analysisSummary.snapshotTime)}
                </p>
              ) : null}
            </div>
            <p className="mt-1 font-semibold text-ink">{money(analysisSummary?.totalAsset ?? 0)}</p>
          </div>
          <div className="rounded-md bg-subtle p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-ink/55">{t("analysis.previousTotal")}</p>
              {analysisPrevious ? (
                <p className="shrink-0 text-xs text-ink/40">
                  {formatSnapshotMoment(analysisPrevious.date, analysisPrevious.snapshotTime)}
                </p>
              ) : null}
            </div>
            <p className="mt-1 font-semibold text-ink">{money(analysisPrevious?.totalAsset ?? 0)}</p>
          </div>
          <div className="rounded-md bg-subtle p-3">
            <p className="text-sm text-ink/55">{t("analysis.assetChange")}</p>
            <p className="mt-1 font-semibold text-moss">{signedAmount(analysisChange)}</p>
          </div>
        </div>

        {!analysisPrevious ? (
          <div className="rounded-md border border-ink/10 bg-subtle px-3 py-6 text-center text-sm text-ink/55">
            {t("analysis.noPrevious")}
          </div>
        ) : (
          <>
            <div className="rounded-md border border-ink/10 p-3">
              <p className="text-sm text-ink/55">{t("analysis.unexplained")}</p>
              <p className="mt-1 font-semibold text-ink">{signedAmount(analysisGap)}</p>
            </div>

            {recurringItems.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-moss/40 bg-mint/20 px-3 py-2">
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-1.5 text-sm text-ink/60">
                    <Repeat size={14} className="shrink-0 text-moss" />
                    {t("analysis.recurringHint", { count: recurringWindow })}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {recurringItems.map((item, index) => (
                      <span
                        key={index}
                        className="rounded border border-ink/10 bg-panel px-1.5 py-0.5 text-xs text-ink/60"
                      >
                        {item.name} {money(sumAmounts(item.amounts))}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={onImportRecurring}
                  disabled={saving}
                >
                  <Download size={16} />
                  {t("analysis.importRecurring")}
                </Button>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <AnalysisColumn
                title={t("analysis.incomeItems")}
                type="income"
                items={analysisItems}
                saving={saving}
                onAdd={addAnalysisItem}
                onChange={updateAnalysisItem}
                onRemove={removeAnalysisItem}
              />
              <AnalysisColumn
                title={t("analysis.expenseItems")}
                type="expense"
                items={analysisItems}
                saving={saving}
                onAdd={addAnalysisItem}
                onChange={updateAnalysisItem}
                onRemove={removeAnalysisItem}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="analysis-description">{t("analysis.descriptionLabel")}</Label>
              <textarea
                id="analysis-description"
                readOnly
                value={analysisDescription}
                className="min-h-28 w-full resize-none rounded-md border border-ink/10 bg-subtle px-3 py-2 text-sm leading-6 text-ink outline-none"
              />
              {analysisGap === 0 ? <p className="text-sm font-medium text-moss">{t("analysis.fullyExplained")}</p> : null}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
