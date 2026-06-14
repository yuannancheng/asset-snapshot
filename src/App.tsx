import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  Database,
  Download,
  FilePlus2,
  FolderOpen,
  KeyRound,
  Lock,
  Moon,
  Palette,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Sun,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./components/Button";
import { ChoiceSelect } from "./components/ChoiceSelect";
import { DatePicker } from "./components/DatePicker";
import { Input, Label } from "./components/Field";
import { PathDisplay } from "./components/PathDisplay";
import { ResizableHeader } from "./components/ResizableHeader";
import { Modal } from "./components/Modal";
import { PasswordChangeModal } from "./components/PasswordChangeModal";
import { PasswordSetupModal } from "./components/PasswordSetupModal";
import { Stat } from "./components/Stat";
import { TimeRangeTabs, type TimeRangeKey } from "./components/TimeRangeTabs";
import { UnlockScreen } from "./components/UnlockScreen";
import {
  backupDataFile,
  createAndSwitchDataFile,
  changeDatabasePassword,
  createAccount,
  createPlatform,
  createSnapshot,
  deleteAccount,
  deletePlatform,
  deleteSnapshot,
  getDashboardData,
  getDataFileInfo,
  getDatabaseStatus,
  getSnapshotAnalysis,
  lockDatabase,
  removeDatabasePassword,
  moveAccount,
  movePlatform,
  saveSnapshotAnalysis,
  setDatabasePassword,
  switchDataFile,
  unlockDatabase,
  updateAccount,
  updateAccountActive,
  updateAccountType,
  updatePlatform,
  updateSnapshot,
} from "./lib/api";
import { formatPlainMoney, money, roundMoney, signedAmount, sumAmounts } from "./lib/format";
import { formatDate, parseDate, startOfDay, today } from "./lib/date";
import type {
  Account,
  AccountType,
  AnalysisItem,
  DashboardData,
  DataFileInfo,
  DatabaseStatus,
  SnapshotSummary,
  SnapshotAnalysis,
} from "./lib/types";
import { buildTrendData } from "./lib/chartTransformer";
import {
  buildAnalysisDescription,
  emptyAnalysisItem,
  explainedAmount,
  normalizeAnalysisItems,
  previousSummaryFor,
  snapshotAnalysisDesc,
} from "./lib/assetCalculator";
import { AnalysisColumn } from "./components/analysis/AnalysisColumn";
import { useSnapshotForm } from "./hooks/useSnapshotForm";
import { DashboardHeader } from "./components/dashboard/DashboardHeader";
import { TrendCharts } from "./components/dashboard/TrendCharts";
import { DataFileModal } from "./components/datafile/DataFileModal";
import { ConfigModal } from "./components/config/ConfigModal";
import { ColorInput } from "./components/platform/ColorInput";
import { SnapshotModal } from "./components/snapshot/SnapshotModal";
import { AnalysisModal } from "./components/analysis/AnalysisModal";
import { usePassword } from "./hooks/usePassword";
import { usePlatformAccounts } from "./hooks/usePlatformAccounts";
import { useAnalysis } from "./hooks/useAnalysis";
import { useDashboardData, useDatabaseStatus } from "./hooks/useDashboardData";
import { confirm } from "@tauri-apps/plugin-dialog";
import {
  accountTypeLabel,
  accountTypeOptions,
  dataFileFilters,
  dayMs,
  platformColorDefaults,
  presetColorLabels,
  presetColors,
} from "./lib/constants";


const MemoStat = memo(Stat);

export default function App() {
  const [darkMode, setDarkMode] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  const { data, isLoading: loading } = useDashboardData();
  const { data: databaseStatus } = useDatabaseStatus();
  const queryClient = useQueryClient();

  const [configOpen, setConfigOpen] = useState(false);
  const [dataFileOpen, setDataFileOpen] = useState(false);
  const [dataFileInfo, setDataFileInfo] = useState<DataFileInfo | null>(null);
  const [locked, setLocked] = useState(false);
  const [passwordSetupOpen, setPasswordSetupOpen] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [colWidths, setColWidths] = useState([200, 120, 120, 100, 100, 120]);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("1y");
  const [customRange, setCustomRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });

  const showToast = useCallback((text: string, kind: "success" | "error") => {
    setToast({ text, kind });
  }, []);

  // Default empty data when query is still loading
  const dashboardData: DashboardData = useMemo(
    () => data ?? { platforms: [], accounts: [], snapshots: [], summaries: [], analyses: [] },
    [data],
  );

  const {
    platformName,
    setPlatformName,
    platformColor,
    setPlatformColor,
    platformEdits,
    setPlatformEdits,
    accountEdits,
    setAccountEdits,
    accountForm,
    setAccountForm,
    inlineAccountForms,
    setInlineAccountForms,
    setDefaultPlatformId,
    openConfigModal,
    submitPlatform,
    submitAccount,
    toggleAccountActive,
    removeAccount,
    removePlatform,
    savePlatformName,
    savePlatformColor,
    movePlatformOrder,
    saveAccountName,
    changeAccountType,
    moveAccountOrder,
    inlineAddAccount,
  } = usePlatformAccounts({
    platforms: dashboardData.platforms,
    accounts: dashboardData.accounts,
    setData: (nextData) => queryClient.setQueryData(["dashboardData"], nextData),
    showToast,
    setSaving,
    setConfigOpen,
  });

  // Check lock status from databaseStatus query
  useEffect(() => {
    if (!databaseStatus) return;
    if (databaseStatus.locked) {
      setLocked(true);
    }
  }, [databaseStatus]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Tauri event listeners
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    let disposed = false;
    let unlistenDataFile: (() => void) | undefined;
    let unlistenDataFileError: (() => void) | undefined;
    let unlistenDataFileEncrypted: (() => void) | undefined;

    import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        const dataFileUnlisten = await listen<DataFileInfo>("data-file-switched", async (event) => {
          setDataFileInfo(event.payload);
          setUnlockError(null);
          setLocked(false);
          queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
          queryClient.invalidateQueries({ queryKey: ["databaseStatus"] });
          showToast("已通过文件打开切换数据文件", "success");
        });
        const errorUnlisten = await listen<string>("data-file-open-error", (event) => {
          showToast(event.payload, "error");
        });
        const encryptedUnlisten = await listen<string>("data-file-encrypted", async () => {
          queryClient.invalidateQueries({ queryKey: ["databaseStatus"] });
          setLocked(true);
          setUnlockError(null);
          setUnlockWaitSeconds(0);
        });

        if (disposed) {
          dataFileUnlisten();
          errorUnlisten();
          encryptedUnlisten();
          return;
        }
        unlistenDataFile = dataFileUnlisten;
        unlistenDataFileError = errorUnlisten;
        unlistenDataFileEncrypted = encryptedUnlisten;
      })
      .catch((reason) => showToast(String(reason), "error"));

    return () => {
      disposed = true;
      unlistenDataFile?.();
      unlistenDataFileError?.();
      unlistenDataFileEncrypted?.();
    };
  }, [showToast]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const duration = toast.kind === "error" ? 5000 : 3000;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast]);

  const {
    unlockError,
    unlockWaitSeconds,
    passwordLoading,
    handleUnlock,
    handleSetPassword,
    handleChangePassword,
    handleRemovePassword,
    handleLock,
    setUnlockError,
    setUnlockWaitSeconds,
  } = usePassword({
    setData: (nextData) => queryClient.setQueryData(["dashboardData"], nextData),
    setLocked,
    setDatabaseStatus: (status) => queryClient.setQueryData(["databaseStatus"], status),
    showToast,
    setDataFileOpen,
    setPasswordSetupOpen,
    setPasswordChangeOpen,
  });

  const activeAccounts = useMemo(
    () => dashboardData.accounts.filter((account) => account.isActive),
    [dashboardData.accounts],
  );

  const {
    snapshotOpen,
    editingSnapshotId,
    snapshotForm,
    setSnapshotForm,
    snapshotAccounts,
    openNewSnapshot,
    openEditSnapshot,
    closeModal: closeSnapshotModal,
    submitSnapshot,
  } = useSnapshotForm({
    activeAccounts,
    accounts: dashboardData.accounts,
    snapshots: dashboardData.snapshots,
    setData: (nextData) => queryClient.setQueryData(["dashboardData"], nextData),
    showToast,
    setSaving,
  });

  const {
    analysisOpen,
    analysisSnapshotId,
    analysisItems,
    analysisSummary,
    analysisPrevious,
    analysisChange,
    analysisGap,
    analysisDescription,
    openAnalysisModal,
    addAnalysisItem,
    updateAnalysisItem,
    removeAnalysisItem,
    closeAnalysisModal,
  } = useAnalysis({
    summaries: dashboardData.summaries,
    showToast,
    setSaving,
  });

  const platformColorFor = useCallback(
    (platformId: number, index: number) => {
      const platform = dashboardData.platforms.find((p) => p.id === platformId);
      if (platform?.color) return platform.color;
      return platformColorDefaults[index % platformColorDefaults.length];
    },
    [dashboardData.platforms],
  );

  const editSnapshot = useCallback(
    (summary: SnapshotSummary) => {
      const snapshot = dashboardData.snapshots.find((item) => item.id === summary.snapshotId);
      if (!snapshot) {
        showToast("快照明细不存在", "error");
        return;
      }
      openEditSnapshot(snapshot);
    },
    [dashboardData.snapshots, openEditSnapshot, showToast],
  );

  const removeSnapshot = useCallback(
    async (summary: SnapshotSummary) => {
      if (!await confirm(`确定删除 ${summary.date} 的快照吗？`)) return;
      setSaving(true);
      try {
        const nextData = await deleteSnapshot({ snapshotId: summary.snapshotId });
        queryClient.setQueryData(["dashboardData"], nextData);
        showToast("快照已删除", "success");
      } catch (reason) {
        showToast(String(reason), "error");
      } finally {
        setSaving(false);
      }
    },
    [showToast],
  );

  const summaries = dashboardData.summaries;
  const lastSummary = summaries[summaries.length - 1];
  const lastDate = lastSummary?.date ?? "";
  const lastTotalAsset = lastSummary?.totalAsset ?? "0";
  const lastAvailableAsset = lastSummary?.availableAsset ?? "0";
  const enabledAccountCount = activeAccounts.length;

  const trend = useMemo(
    () => buildTrendData(summaries, timeRange, customRange),
    [summaries, timeRange, customRange],
  );

  const platformGroups = useMemo(() => {
    const map = new Map<number, { platform: typeof dashboardData.platforms[0]; accounts: Account[] }>();
    dashboardData.platforms.forEach((p) => map.set(p.id, { platform: p, accounts: [] }));
    dashboardData.accounts.forEach((a) => {
      const group = map.get(a.platformId);
      if (group) group.accounts.push(a);
    });
    return [...map.values()];
  }, [dashboardData.platforms, dashboardData.accounts]);

  const platformSelectOptions = useMemo(
    () =>
      dashboardData.platforms.map((p) => ({
        value: String(p.id),
        label: p.name,
      })),
    [dashboardData.platforms],
  );

  const historyRows = useMemo(
    () =>
      [...summaries].reverse().map((summary) => {
        const snapshot = dashboardData.snapshots.find((s) => s.id === summary.snapshotId);
        const prevSummary = previousSummaryFor(summaries, summary.snapshotId);
        const summaryAnalysis = dashboardData.analyses.find((a) => a.snapshotId === summary.snapshotId);
        const analysisDesc = snapshotAnalysisDesc(summary, prevSummary, summaryAnalysis);
        return { summary, snapshot, prevSummary, summaryAnalysis, analysisDesc };
      }),
    [summaries, dashboardData.snapshots, dashboardData.analyses],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-moss border-t-transparent" />
          <p className="mt-3 text-sm text-ink/55">加载中...</p>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <UnlockScreen
        currentPath={databaseStatus?.currentPath ?? (databaseStatus?.encrypted ? "" : "加载中...")}
        error={unlockError}
        waitSeconds={unlockWaitSeconds}
        onUnlock={handleUnlock}
      />
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-6 sm:px-6 sm:py-10">
      <DashboardHeader
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        databaseStatus={databaseStatus ?? null}
        creating={creating}
        openConfigModal={openConfigModal}
        setDataFileOpen={setDataFileOpen}
        setPasswordSetupOpen={setPasswordSetupOpen}
        setPasswordChangeOpen={setPasswordChangeOpen}
        handleLock={handleLock}
      />

      <div className="flex items-center gap-x-4 rounded-md border border-ink/10 bg-subtle px-4 py-2 text-xs">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-ink/50">
          <Database size={14} />
          数据文件:
        </span>
        <span
          className="inline-flex min-w-0 cursor-pointer font-mono text-ink/70 transition-colors hover:text-ink"
          title={databaseStatus?.currentPath ? `点击复制: ${databaseStatus.currentPath}` : ""}
          onClick={() => {
            const p = databaseStatus?.currentPath;
            if (!p) return;
            navigator.clipboard.writeText(p).then(
              () => showToast("已复制文件路径", "success"),
              () => showToast("复制失败", "error"),
            );
          }}
        >
          <PathDisplay path={databaseStatus?.currentPath ?? ""} />
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            databaseStatus?.encrypted
              ? "bg-mint/60 text-moss"
              : "bg-ink/5 text-ink/45"
          }`}
        >
          {databaseStatus?.encrypted ? "已加密" : "未加密"}
        </span>
        {databaseStatus?.encrypted ? (
          <button
            type="button"
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink/50 transition hover:text-coral"
            onClick={handleLock}
          >
            锁定
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MemoStat label="总资产" value={money(lastTotalAsset)} icon={<WalletCards size={20} />} />
        <MemoStat label="可用资产" value={money(lastAvailableAsset)} icon={<PlayCircle size={20} />} />
        <MemoStat label="启用账户" value={String(enabledAccountCount)} icon={<Calculator size={20} />} />
      </div>

      <TrendCharts
        trend={trend}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        customRange={customRange}
        setCustomRange={setCustomRange}
        lastSummary={lastSummary}
        platforms={dashboardData.platforms}
        platformColorFor={platformColorFor}
      />

      {/* History */}
      <div className="space-y-6">
        <div className="rounded-xl bg-panel p-4 shadow-panel sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-ink">历史快照</h2>
            <Button
              variant="secondary"
              onClick={() => {
                openNewSnapshot();
              }}
            >
              <Plus size={18} />
              新建快照
            </Button>
          </div>

          {historyRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink/45">还没有历史快照，点击上方按钮创建第一个。</div>
          ) : (
            <div className="space-y-2 overflow-x-auto">
              <ResizableHeader
                labels={["日期", "总资产", "可用资产", "备注", "变动分析", "操作"]}
                widths={colWidths}
                onResize={setColWidths}
              />
              {historyRows.map(({ summary, snapshot, analysisDesc }) => (
                <div
                  key={summary.snapshotId}
                  className="grid items-center gap-3 rounded-lg border border-ink/10 px-4 py-2.5 text-sm w-max min-w-full"
                  style={{ gridTemplateColumns: colWidths.map(w => `${w}px`).join(" ") }}
                >
                  <div className="font-medium text-ink truncate">
                    {snapshot?.snapshotTime && snapshot.snapshotTime !== "00:00"
                      ? `${summary.date} ${snapshot.snapshotTime}`
                      : summary.date}
                  </div>
                  <div className="font-medium text-ink">{money(summary.totalAsset)}</div>
                  <div className="text-ink/65">{money(summary.availableAsset)}</div>
                  <div className="text-ink/45 truncate" title={snapshot?.note ?? ""}>
                    {snapshot?.note || "—"}
                  </div>
                  <div className="text-ink/55 truncate" title={analysisDesc}>
                    {analysisDesc}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      className="size-9 px-0"
                      title="查看变动分析"
                      onClick={() => openAnalysisModal(summary)}
                    >
                      <Calculator size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      className="size-9 px-0"
                      title="编辑快照"
                      onClick={() => editSnapshot(summary)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      className="size-9 px-0 text-coral"
                      title="删除快照"
                      onClick={() => removeSnapshot(summary)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DataFileModal
        open={dataFileOpen}
        onClose={() => setDataFileOpen(false)}
        databaseStatus={databaseStatus ?? null}
        setCreating={setCreating}
        setData={(nextData) => queryClient.setQueryData(["dashboardData"], nextData)}
        setLocked={setLocked}
        setDataFileInfo={setDataFileInfo}
        setDatabaseStatus={(status) => queryClient.setQueryData(["databaseStatus"], status)}
        showToast={showToast}
        handleRemovePassword={handleRemovePassword}
        passwordLoading={passwordLoading}
        setPasswordChangeOpen={setPasswordChangeOpen}
        setPasswordSetupOpen={setPasswordSetupOpen}
      />

      <ConfigModal
        open={configOpen}
        onClose={() => {
          setConfigOpen(false);
          setPlatformEdits({});
          setAccountEdits({});
        }}
        saving={saving}
        platformName={platformName}
        setPlatformName={setPlatformName}
        platformColor={platformColor}
        setPlatformColor={setPlatformColor}
        platformEdits={platformEdits}
        setPlatformEdits={setPlatformEdits}
        accountEdits={accountEdits}
        setAccountEdits={setAccountEdits}
        inlineAccountForms={inlineAccountForms}
        setInlineAccountForms={setInlineAccountForms}
        platformGroups={platformGroups}
        submitPlatform={submitPlatform}
        savePlatformName={savePlatformName}
        savePlatformColor={savePlatformColor}
        movePlatformOrder={movePlatformOrder}
        removePlatform={removePlatform}
        saveAccountName={saveAccountName}
        changeAccountType={changeAccountType}
        moveAccountOrder={moveAccountOrder}
        toggleAccountActive={toggleAccountActive}
        removeAccount={removeAccount}
        inlineAddAccount={inlineAddAccount}
        platformColorFor={platformColorFor}
      />

      <SnapshotModal
        open={snapshotOpen}
        editingSnapshotId={editingSnapshotId}
        onClose={closeSnapshotModal}
        snapshotForm={snapshotForm}
        setSnapshotForm={setSnapshotForm}
        snapshotAccounts={snapshotAccounts}
        submitSnapshot={submitSnapshot}
        saving={saving}
        platforms={dashboardData.platforms}
        platformColorFor={platformColorFor}
        openConfigModal={openConfigModal}
      />

      <AnalysisModal
        open={analysisOpen}
        onClose={closeAnalysisModal}
        analysisItems={analysisItems}
        analysisSummary={analysisSummary}
        analysisPrevious={analysisPrevious}
        analysisChange={analysisChange}
        analysisGap={analysisGap}
        analysisDescription={analysisDescription}
        addAnalysisItem={addAnalysisItem}
        updateAnalysisItem={updateAnalysisItem}
        removeAnalysisItem={removeAnalysisItem}
        saving={saving}
      />

      <PasswordSetupModal
        open={passwordSetupOpen}
        onClose={() => setPasswordSetupOpen(false)}
        onSetPassword={handleSetPassword}
        saving={passwordLoading}
        error={null}
      />

      <PasswordChangeModal
        open={passwordChangeOpen}
        onClose={() => setPasswordChangeOpen(false)}
        onChangePassword={handleChangePassword}
        saving={passwordLoading}
        error={null}
      />

      {toast ? (
        <div
          className={`fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg transition-all duration-300 ${
            toast.kind === "success"
              ? "bg-moss text-white"
              : "bg-coral text-white"
          }`}
        >
          {toast.text}
        </div>
      ) : null}
      {creating ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-panel px-6 py-4 shadow-panel text-center">
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-moss border-t-transparent" />
            <p className="mt-2 text-sm text-ink/70">正在处理，请稍候...</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
