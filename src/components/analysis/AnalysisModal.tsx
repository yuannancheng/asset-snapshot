import { Plus } from "lucide-react";
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
  addAnalysisItem: (type: "income" | "expense") => void;
  updateAnalysisItem: (index: number, item: AnalysisItem) => void;
  removeAnalysisItem: (index: number) => void;
  saving: boolean;
}) {
  return (
    <Modal
      open={open}
      title="资产变动分析"
      description="解释两次快照之间的重要收入与支出，不记录完整流水。"
      onClose={onClose}
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-subtle p-3">
            <p className="text-sm text-ink/55">本期总资产</p>
            <p className="mt-1 font-semibold text-ink">{money(analysisSummary?.totalAsset ?? 0)}</p>
          </div>
          <div className="rounded-md bg-subtle p-3">
            <p className="text-sm text-ink/55">上期总资产</p>
            <p className="mt-1 font-semibold text-ink">{money(analysisPrevious?.totalAsset ?? 0)}</p>
          </div>
          <div className="rounded-md bg-subtle p-3">
            <p className="text-sm text-ink/55">资产变化</p>
            <p className="mt-1 font-semibold text-moss">{signedAmount(analysisChange)}</p>
          </div>
        </div>

        {!analysisPrevious ? (
          <div className="rounded-md border border-ink/10 bg-subtle px-3 py-6 text-center text-sm text-ink/55">
            这是第一条快照，还没有上期数据可用于分析。
          </div>
        ) : (
          <>
            <div className="rounded-md border border-ink/10 p-3">
              <p className="text-sm text-ink/55">未解释变动</p>
              <p className="mt-1 font-semibold text-ink">{signedAmount(analysisGap)}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <AnalysisColumn
                title="收入项目"
                type="income"
                items={analysisItems}
                saving={saving}
                onChange={updateAnalysisItem}
                onRemove={removeAnalysisItem}
              />
              <AnalysisColumn
                title="支出项目"
                type="expense"
                items={analysisItems}
                saving={saving}
                onChange={updateAnalysisItem}
                onRemove={removeAnalysisItem}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => addAnalysisItem("income")}
                disabled={saving}
              >
                <Plus size={16} />
                新增收入项目
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => addAnalysisItem("expense")}
                disabled={saving}
              >
                <Plus size={16} />
                新增支出项目
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="analysis-description">变动说明</Label>
              <textarea
                id="analysis-description"
                readOnly
                value={analysisDescription}
                className="min-h-28 w-full resize-none rounded-md border border-ink/10 bg-subtle px-3 py-2 text-sm leading-6 text-ink outline-none"
              />
              {analysisGap === 0 ? <p className="text-sm font-medium text-moss">已完全解释</p> : null}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
