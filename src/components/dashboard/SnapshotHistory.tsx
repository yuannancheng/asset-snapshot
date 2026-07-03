import { Calculator, Pencil, Plus, Trash2 } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="overflow-clip rounded-xl bg-panel p-4 shadow-panel sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">历史快照</h2>
          <Button variant="secondary" onClick={onNewSnapshot}>
            <Plus size={18} />
            新建快照
          </Button>
        </div>

        {pageData.totalCount === 0 ? (
          <div className="py-10 text-center text-sm text-ink/45">
            还没有历史快照，点击上方按钮创建第一个。
          </div>
        ) : (
          <>
            <div
              className="overflow-auto"
              style={{ maxHeight: "calc(100vh - 13rem)" }}
            >
              <div className="w-max min-w-full">
                <div className="sticky top-0 z-10 bg-panel pb-2 pt-1">
                  <ResizableHeader
                    defaultWidths={defaultWidths}
                    labels={["日期", "总资产", "可用资产", "变动分析", "备注", "操作"]}
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
                        {snapshot?.snapshotTime && snapshot.snapshotTime !== "00:00"
                          ? `${summary.date} ${snapshot.snapshotTime}`
                          : summary.date}
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
                          title="查看变动分析"
                          onClick={() => onAnalysis(summary)}
                        >
                          <Calculator size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="size-9 px-0"
                          title="编辑快照"
                          onClick={() => onEdit(summary)}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="size-9 px-0 text-coral"
                          title="删除快照"
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
