import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  Calculator,
  Database,
  PlayCircle,
  WalletCards,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { PathDisplay } from "./components/PathDisplay";
import { PasswordChangeModal } from "./components/PasswordChangeModal";
import { PasswordSetupModal } from "./components/PasswordSetupModal";
import { Stat } from "./components/Stat";
import { UnlockScreen } from "./components/UnlockScreen";
import { deleteSnapshot, getSnapshotsPage } from "./lib/api";
import { money } from "./lib/format";
import type {
  Account,
  DashboardData,
  DataFileInfo,
  SnapshotSummary,
  PaginatedSnapshots,
} from "./lib/types";
import type { TimeRangeKey } from "./components/TimeRangeTabs";
import { buildTrendData } from "./lib/chartTransformer";
import {
  previousSummaryFor,
  snapshotAnalysisDesc,
} from "./lib/assetCalculator";
import { useSnapshotForm } from "./hooks/useSnapshotForm";
import { DashboardHeader } from "./components/dashboard/DashboardHeader";
import { TrendCharts } from "./components/dashboard/TrendCharts";
import { DataFileModal } from "./components/datafile/DataFileModal";
import { AboutModal } from "./components/AboutModal";
import { ConfigModal } from "./components/config/ConfigModal";
import { SnapshotModal } from "./components/snapshot/SnapshotModal";
import { SnapshotHistory } from "./components/dashboard/SnapshotHistory";
import { AnalysisModal } from "./components/analysis/AnalysisModal";
import { SettingsModal } from "./components/SettingsModal";
import { usePassword } from "./hooks/usePassword";
import { usePlatformAccounts } from "./hooks/usePlatformAccounts";
import { useAnalysis } from "./hooks/useAnalysis";
import { useDashboardData, useDatabaseStatus } from "./hooks/useDashboardData";
import { confirm } from "@tauri-apps/plugin-dialog";
import { platformColorDefaults } from "./lib/constants";



const COL_WIDTHS_KEY = "snapshot-history-column-widths";
const DEFAULT_COL_WIDTHS = [100, 120, 120, 180, 120, 120];
const MemoStat = memo(Stat);

export default function App() {
  const { t } = useTranslation();
  const [darkMode, setDarkMode] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  const { data, isLoading: loading } = useDashboardData();
  const { data: databaseStatus } = useDatabaseStatus();
  const queryClient = useQueryClient();

  const [configOpen, setConfigOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataFileOpen, setDataFileOpen] = useState(false);
  const [, setDataFileInfo] = useState<DataFileInfo | null>(null);
  const [locked, setLocked] = useState(false);
  const [passwordSetupOpen, setPasswordSetupOpen] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [colWidths, setColWidths] = useState(() => {
    try {
      const stored = localStorage.getItem(COL_WIDTHS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === "number" && v > 0)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_COL_WIDTHS;
  });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("1y");
  const [customRange, setCustomRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });


  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [pageData, setPageData] = useState<PaginatedSnapshots>({ snapshots: [], summaries: [], analyses: [], totalCount: 0 });
  const [pageVersion, setPageVersion] = useState(0);
  const pageLoadingRef = useRef(false);

  const refreshPage = useCallback(() => {
    setCurrentPage(1);
    setPageVersion((v) => v + 1);
  }, []);

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
    inlineAccountForms,
    setInlineAccountForms,
    openConfigModal,
    submitPlatform,
    toggleAccountActive,
    removeAccount,
    removePlatform,
    savePlatformName,
    savePlatformColor,
    movePlatformOrder,
    saveAccountName,
    changeAccountType,
    changeAccountPlatform,
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

  // Refresh paginated table after database unlock
  const prevLockedRef = useRef(locked);
  useEffect(() => {
    if (prevLockedRef.current && !locked) {
      setCurrentPage(1);
      setPageVersion((v) => v + 1);
    }
    prevLockedRef.current = locked;
  }, [locked]);


  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths));
  }, [colWidths]);

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
          showToast(t("snapshot.switchedViaFile"), "success");
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
  }, [showToast, t]);

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
    onSnapshotMutated: refreshPage,
  });

  const {
    analysisOpen,
    analysisItems,
    analysisSummary,
    analysisPrevious,
    analysisChange,
    analysisGap,
    analysisDescription,
    openAnalysisModal,
    saveAnalysis,
    addAnalysisItem,
    updateAnalysisItem,
    removeAnalysisItem,
    closeAnalysisModal,
  } = useAnalysis({
    summaries: dashboardData.summaries,
    showToast,
    onSaved: refreshPage,
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
        showToast(t("snapshot.snapshotNotFound"), "error");
        return;
      }
      openEditSnapshot(snapshot);
    },
    [dashboardData.snapshots, openEditSnapshot, showToast, t],
  );

  const removeSnapshot = useCallback(
    async (summary: SnapshotSummary) => {
      if (!await confirm(t("snapshot.confirmDelete", { date: summary.date }))) return;
      setSaving(true);
      try {
        const nextData = await deleteSnapshot({ snapshotId: summary.snapshotId });
        queryClient.setQueryData(["dashboardData"], nextData);
        setCurrentPage(1);
        setPageVersion((v) => v + 1);
        showToast(t("snapshot.snapshotDeleted"), "success");
      } catch (reason) {
        showToast(String(reason), "error");
      } finally {
        setSaving(false);
      }
    },
    [showToast, t],
  );

  const totalPages = Math.max(1, Math.ceil(pageData.totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (pageLoadingRef.current) return;
    pageLoadingRef.current = true;
    getSnapshotsPage({ limit: pageSize, offset: (safePage - 1) * pageSize }).then((data) => {
      setPageData(data);
      pageLoadingRef.current = false;
    });
  }, [pageSize, safePage, pageVersion]);

  const summaries = dashboardData.summaries;
  const lastSummary = summaries[summaries.length - 1];
  const lastTotalAsset = lastSummary?.totalAsset ?? "0";
  const lastAvailableAsset = lastSummary?.availableAsset ?? "0";
  const enabledAccountCount = activeAccounts.length;

  const trend = useMemo(
    () => buildTrendData(summaries, timeRange, customRange, t),
    [summaries, timeRange, customRange, t],
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

  const historyRows = useMemo(
    () =>
      pageData.summaries.map((summary) => {
        const snapshot = pageData.snapshots.find((s) => s.id === summary.snapshotId);
        const prevSummary = previousSummaryFor(summaries, summary.snapshotId);
        const summaryAnalysis = pageData.analyses.find((a) => a.snapshotId === summary.snapshotId);
        const analysisDesc = snapshotAnalysisDesc(summary, prevSummary, summaryAnalysis, t);
        return { summary, snapshot, prevSummary, summaryAnalysis, analysisDesc };
      }),
    [pageData.summaries, pageData.snapshots, pageData.analyses, summaries, t],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-moss border-t-transparent" />
          <p className="mt-3 text-sm text-ink/55">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <UnlockScreen
        currentPath={databaseStatus?.currentPath ?? (databaseStatus?.encrypted ? "" : t("common.loading"))}
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
        openAboutModal={() => setAboutOpen(true)}
        openSettingsModal={() => setSettingsOpen(true)}
      />

      <div className="flex items-center gap-x-4 rounded-md border border-ink/10 bg-subtle px-4 py-2 text-xs">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-ink/50">
          <Database size={14} />
          {t("dashboard.dataFileLabel")}
        </span>
        <span
          className="inline-flex min-w-0 cursor-pointer font-mono text-ink/70 transition-colors hover:text-ink"
          title={databaseStatus?.currentPath ? `${t("dashboard.clickToCopy")}${databaseStatus.currentPath}` : ""}
          onClick={() => {
            const p = databaseStatus?.currentPath;
            if (!p) return;
            navigator.clipboard.writeText(p).then(
              () => showToast(t("common.copiedPath"), "success"),
              () => showToast(t("common.copyFailed"), "error"),
            );
          }}
        >
          <PathDisplay path={databaseStatus?.currentPath ?? ""} unknownText={t("common.unknown")} />
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            databaseStatus?.encrypted
              ? "bg-mint/60 text-moss"
              : "bg-ink/5 text-ink/45"
          }`}
        >
          {databaseStatus?.encrypted ? t("common.encrypted") : t("common.unencrypted")}
        </span>
        {databaseStatus?.encrypted ? (
          <button
            type="button"
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink/50 transition hover:text-coral"
            onClick={handleLock}
          >
            {t("common.lock")}
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MemoStat label={t("dashboard.totalAsset")} value={money(lastTotalAsset)} icon={<WalletCards size={20} />} />
        <MemoStat label={t("dashboard.availableAsset")} value={money(lastAvailableAsset)} icon={<PlayCircle size={20} />} />
        <MemoStat label={t("dashboard.enabledAccounts")} value={String(enabledAccountCount)} icon={<Calculator size={20} />} />
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

      <SnapshotHistory
        pageData={pageData}
        historyRows={historyRows}
        defaultWidths={DEFAULT_COL_WIDTHS}
        colWidths={colWidths}
        onColWidthsChange={setColWidths}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        formatMoney={money}
        onNewSnapshot={openNewSnapshot}
        onAnalysis={openAnalysisModal}
        onEdit={editSnapshot}
        onDelete={removeSnapshot}
      />
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
        platforms={dashboardData.platforms}
        changeAccountPlatform={changeAccountPlatform}
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
        onSave={saveAnalysis}
        addAnalysisItem={addAnalysisItem}
        updateAnalysisItem={updateAnalysisItem}
        removeAnalysisItem={removeAnalysisItem}
        saving={saving}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <AboutModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        showToast={showToast}
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
            <p className="mt-2 text-sm text-ink/70">{t("common.processing")}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
