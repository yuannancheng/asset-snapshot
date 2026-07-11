import { Calculator, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PaginatedSnapshots, SnapshotSummary } from "../../lib/types";
import type { DashboardData } from "../../lib/types";
import { Button } from "../Button";
import { Pagination } from "../Pagination";
import { ResizableHeader } from "../ResizableHeader";

interface HistoryRow {
  summary: SnapshotSummary;
  snapshot: DashboardData["snapshots"][number] | undefined;
  analysisDesc: string;
}

interface SnapshotHistoryProps {
  pageData: PaginatedSnapshots;
  historyRows: HistoryRow[];
  colWidths: number[];
  defaultWidths: number[];
  onColWidthsChange: (widths: number[]) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  formatMoney: (value: string) => string;
  onNewSnapshot: () => void;
  onAnalysis: (summary: SnapshotSummary) => void;
  onEdit: (summary: SnapshotSummary) => void;
  onDelete: (summary: SnapshotSummary) => void;
}

export function SnapshotHistory({
  pageData,
  historyRows,
  colWidths,
  defaultWidths,
  onColWidthsChange,
  pageSize,
  onPageSizeChange,
  currentPage,
  totalPages,
  onPageChange,
  formatMoney,
  onNewSnapshot,
  onAnalysis,
  onEdit,
  onDelete,
}: SnapshotHistoryProps) {
  const { t } = useTranslation();
  const [isHistoryHeaderSticky, setIsHistoryHeaderSticky] = useState(false);

  return (
    <div className="space-y-6">
      <div className="overflow-clip rounded-xl bg-panel p-4 shadow-panel sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">{t("dashboard.historyTitle")}</h2>
          <Button variant="secondary" onClick={onNewSnapshot}>
            <Plus size={18} />
            {t("dashboard.newSnapshot")}
          </Button>
        </div>

        {pageData.totalCount === 0 ? (
          <div className="py-10 text-center text-sm text-ink/45">
            {t("dashboard.emptyHistory")}
          </div>
        ) : (
          <>
            <div
              className="overflow-auto"
              style={{ maxHeight: "calc(100vh - 13rem)" }}
              onScroll={(event) => {
                const isSticky = event.currentTarget.scrollTop > 0;
                setIsHistoryHeaderSticky((previous) =>
                  previous === isSticky ? previous : isSticky,
                );
              }}
            >
              <div className="w-max min-w-full">
                <div
                  className={`sticky top-0 z-10 pb-2 pt-1 transition-colors ${
                    isHistoryHeaderSticky ? "bg-panel" : "bg-transparent"
                  }`}
                >
                  <ResizableHeader
                    defaultWidths={defaultWidths}
                    labels={[
                      t("dashboard.colDate"),
                      t("dashboard.colTotalAsset"),
                      t("dashboard.colAvailableAsset"),
                      t("dashboard.colAnalysis"),
                      t("dashboard.colNote"),
                      t("dashboard.colActions"),
                    ]}
                    widths={colWidths}
                    onResize={onColWidthsChange}
                  />
                </div>
                <div className="space-y-2">
                  {historyRows.map(({ summary, snapshot, analysisDesc }) => (
                    <div
                      key={summary.snapshotId}
                      className="grid items-center gap-3 rounded-lg border border-ink/10 px-4 py-2.5 text-sm"
                      style={{ gridTemplateColumns: colWidths.map((w) => `${w}px`).join(" ") }}
                    >
                     <div className="font-medium text-ink truncate">
                        {snapshot?.snapshotTime && snapshot.snapshotTime !== "00:00" ? (
                          <span title={`${summary.date} ${snapshot.snapshotTime}`}>
                            {summary.date}
                          </span>
                        ) : (
                          summary.date
                        )}
                      </div>
                      <div className="font-medium text-ink">{formatMoney(summary.totalAsset)}</div>
                      <div className="text-ink/65">{formatMoney(summary.availableAsset)}</div>
                      <div className="text-ink/55 line-clamp-3" title={analysisDesc}>
                        {analysisDesc}
                      </div>
                      <div className="text-ink/45 line-clamp-3" title={snapshot?.note ?? ""}>
                        {snapshot?.note || "\u2014"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          className="size-9 px-0"
                          title={t("dashboard.viewAnalysis")}
                          onClick={() => onAnalysis(summary)}
                        >
                          <Calculator size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="size-9 px-0"
                          title={t("dashboard.editSnapshot")}
                          onClick={() => onEdit(summary)}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="size-9 px-0 text-coral"
                          title={t("dashboard.deleteSnapshot")}
                          onClick={() => onDelete(summary)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Pagination
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                onPageSizeChange(size);
                onPageChange(1);
              }}
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={pageData.totalCount}
              onPageChange={onPageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
