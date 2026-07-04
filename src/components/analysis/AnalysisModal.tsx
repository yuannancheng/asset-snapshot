import { Loader2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { Label } from "../Field";
import { Modal } from "../Modal";
import { AnalysisColumn } from "./AnalysisColumn";
import { money, signedAmount } from "../../lib/format";
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
  onSave,
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
  onSave: () => void;
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
            <p className="text-sm text-ink/55">{t("analysis.currentTotal")}</p>
            <p className="mt-1 font-semibold text-ink">{money(analysisSummary?.totalAsset ?? 0)}</p>
          </div>
          <div className="rounded-md bg-subtle p-3">
            <p className="text-sm text-ink/55">{t("analysis.previousTotal")}</p>
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
