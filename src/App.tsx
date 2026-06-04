import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  Check,
  Database,
  Download,
  FilePlus2,
  FolderOpen,
  History,
  KeyRound,
  Lock,
  Moon,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Unlock,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "./components/Button";
import { ChoiceSelect } from "./components/ChoiceSelect";
import { DatePicker } from "./components/DatePicker";
import { Input, Label } from "./components/Field";
import { Modal } from "./components/Modal";
import { PasswordChangeModal } from "./components/PasswordChangeModal";
import { PasswordSetupModal } from "./components/PasswordSetupModal";
import { Stat } from "./components/Stat";
import { TimeRangeTabs, type TimeRangeKey } from "./components/TimeRangeTabs";
import { UnlockScreen } from "./components/UnlockScreen";
import {
  backupDataFile,
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
  moveAccount,
  movePlatform,
  saveSnapshotAnalysis,
  setDatabasePassword,
  switchDataFile,
  unlockDatabase,
  updateAccount,
  updateAccountActive,
  updatePlatform,
  updateSnapshot,
} from "./lib/api";
import { money, signedAmount } from "./lib/format";
import type {
  Account,
  AccountType,
  AnalysisItem,
  DashboardData,
  DataFileInfo,
  DatabaseStatus,
  SnapshotSummary,
} from "./lib/types";

const platformColors = ["#48634f", "#f47d6b", "#d4a017", "#5b7f95", "#7a6f55"];
const darkPlatformColors = ["#94be9e", "#ff917e", "#e8b845", "#8ab7cf", "#c7b88e"];
const dayMs = 24 * 60 * 60 * 1000;
const dataFileFilters = [{ name: "资产快照数据文件", extensions: ["as", "db", "sqlite", "sqlite3"] }];

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: "asset_liquid", label: "流动资产" },
  { value: "asset_nonliquid", label: "非流动资产" },
  { value: "debt", label: "负债" },
];

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = window.localStorage.getItem("asset-snapshot-theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [data, setData] = useState<DashboardData>({
    platforms: [],
    accounts: [],
    snapshots: [],
    summaries: [],
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [dataFileOpen, setDataFileOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [dataFileInfo, setDataFileInfo] = useState<DataFileInfo | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [locked, setLocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [passwordSetupOpen, setPasswordSetupOpen] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(null);
  const [analysisSnapshotId, setAnalysisSnapshotId] = useState<number | null>(null);
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>([]);
  const [platformName, setPlatformName] = useState("");
  const [platformEdits, setPlatformEdits] = useState<Record<number, string>>({});
  const [accountEdits, setAccountEdits] = useState<Record<number, string>>({});
  const [accountForm, setAccountForm] = useState<{
    platformId: string;
    name: string;
    type: AccountType;
  }>({ platformId: "", name: "", type: "asset_liquid" });
  const [snapshotForm, setSnapshotForm] = useState<{
    date: string;
    note: string;
    amounts: Record<number, string>;
  }>({
    date: new Date().toISOString().slice(0, 10),
    note: "",
    amounts: {},
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [unlockWaitSeconds, setUnlockWaitSeconds] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("3m");
  const [customRange, setCustomRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });

  const loadData = useCallback(async () => {
    const nextData = await getDashboardData();
    setData(nextData);
    setAccountForm((current) => ({
      ...current,
      platformId: current.platformId || String(nextData.platforms[0]?.id ?? ""),
    }));
    setSnapshotForm((current) => ({
      ...current,
      amounts: Object.fromEntries(
        nextData.accounts
          .filter((account) => account.isActive)
          .map((account) => [account.id, current.amounts[account.id] ?? "0"]),
      ),
    }));
  }, []);

  useEffect(() => {
    getDatabaseStatus()
      .then((status) => {
        setDatabaseStatus(status);
        if (status.locked) {
          setLocked(true);
        } else {
          loadData().catch((reason) => setError(String(reason)));
        }
      })
      .catch(() => {
        loadData().catch((reason) => setError(String(reason)));
      });
  }, [loadData]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("asset-snapshot-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (unlockWaitSeconds <= 0) return;
    const timer = setTimeout(() => {
      setUnlockWaitSeconds((current) => current - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [unlockWaitSeconds]);

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
          // Check the new file's encryption/lock status instead of assuming unlocked
          try {
            const status = await getDatabaseStatus();
            setDatabaseStatus(status);
            if (status.locked) {
              setLocked(true);
              setUnlockWaitSeconds(0);
              return;
            }
          } catch {
            // Fall through and load data if status check fails
          }
          setLocked(false);
          await loadData();
          setError(null);
          setMessage("已通过文件打开切换数据文件");
        });
        const errorUnlisten = await listen<string>("data-file-open-error", (event) => {
          setError(event.payload);
        });
        const encryptedUnlisten = await listen<string>("data-file-encrypted", async () => {
          const status = await getDatabaseStatus();
          setDatabaseStatus(status);
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
      .catch((reason) => setError(String(reason)));

    return () => {
      disposed = true;
      unlistenDataFile?.();
      unlistenDataFileError?.();
      unlistenDataFileEncrypted?.();
    };
  }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleUnlock = async (password: string) => {
    setUnlockError(null);
    setUnlockWaitSeconds(0);
    try {
      const nextData = await unlockDatabase({ password });
      setData(nextData);
      setLocked(false);
      setUnlockError(null);
      setUnlockWaitSeconds(0);
      const status = await getDatabaseStatus();
      setDatabaseStatus(status);
    } catch (err) {
      const message = String(err);
      setUnlockError(message);
      // Parse wait seconds from error message (backend returns "... X seconds ...")
      const waitMatch = message.match(/(\d+)\s*seconds/);
      if (waitMatch) {
        setUnlockWaitSeconds(Number(waitMatch[1]));
      }
      // Refresh status to get updated failed attempts / wait info
      try {
        const status = await getDatabaseStatus();
        setDatabaseStatus(status);
      } catch {
        // ignore
      }
    }
  };

  const handleSetPassword = async (password: string) => {
    setError(null);
    setPasswordLoading(true);
    try {
      const status = await setDatabasePassword({ password });
      setDatabaseStatus(status);
      setPasswordSetupOpen(false);
      setMessage("数据库密码已设置。请务必记住您的密码。");
    } catch (err) {
      setError(String(err));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleChangePassword = async (newPassword: string) => {
    setError(null);
    setPasswordLoading(true);
    try {
      await changeDatabasePassword({ newPassword });
      setPasswordChangeOpen(false);
      setMessage("数据库密码已修改。");
    } catch (err) {
      setError(String(err));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLock = async () => {
    setError(null);
    try {
      const status = await lockDatabase();
      setDatabaseStatus(status);
      setLocked(true);
      setUnlockError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const activeAccounts = useMemo(
    () => data.accounts.filter((account) => account.isActive),
    [data.accounts],
  );

  const snapshotAccounts = useMemo(() => {
    if (!editingSnapshotId) return activeAccounts;
    const snapshot = data.snapshots.find((item) => item.id === editingSnapshotId);
    const accountIds = new Set([
      ...(snapshot?.items.map((item) => item.accountId) ?? []),
      ...activeAccounts.map((account) => account.id),
    ]);
    return data.accounts.filter((account) => accountIds.has(account.id));
  }, [activeAccounts, data.accounts, data.snapshots, editingSnapshotId]);

  const submitPlatform = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const nextData = await createPlatform({ name: platformName });
      setData(nextData);
      setAccountForm((current) => ({
        ...current,
        platformId: current.platformId || String(nextData.platforms[0]?.id ?? ""),
      }));
      setPlatformName("");
      setMessage("平台已添加");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const nextData = await createAccount({
        platformId: Number(accountForm.platformId),
        name: accountForm.name,
        type: accountForm.type,
      });
      setData(nextData);
      setAccountForm((current) => ({ ...current, name: "" }));
      setMessage("账户已添加");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const submitSnapshot = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input = {
        date: snapshotForm.date,
        note: snapshotForm.note,
        items: snapshotAccounts.map((account) => ({
          accountId: account.id,
          amount: snapshotForm.amounts[account.id] || "0",
        })),
      };
      const nextData = editingSnapshotId
        ? await updateSnapshot({ snapshotId: editingSnapshotId, ...input })
        : await createSnapshot(input);
      setData(nextData);
      setSnapshotOpen(false);
      setEditingSnapshotId(null);
      setMessage(editingSnapshotId ? "快照已更新" : "快照已保存");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const toggleAccountActive = async (account: Account) => {
    setSaving(true);
    setError(null);
    try {
      const nextData = await updateAccountActive({
        accountId: account.id,
        isActive: !account.isActive,
      });
      setData(nextData);
      setMessage(account.isActive ? "账户已停用" : "账户已启用");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (account: Account) => {
    if (!window.confirm(`确定删除账户“${account.name}”吗？已有历史快照的账户不能删除。`)) return;
    setSaving(true);
    setError(null);
    try {
      const nextData = await deleteAccount({ accountId: account.id });
      setData(nextData);
      setMessage("账户已删除");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const removePlatform = async (platformId: number) => {
    const platform = data.platforms.find((item) => item.id === platformId);
    if (!platform) return;
    if (
      !window.confirm(
        `确定删除平台“${platform.name}”吗？只有平台下所有账户都没有历史快照时才会删除。`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nextData = await deletePlatform({ platformId });
      setData(nextData);
      setAccountForm((current) => ({
        ...current,
        platformId: String(nextData.platforms[0]?.id ?? ""),
      }));
      setMessage("平台已删除");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const savePlatformName = async (platformId: number) => {
    const currentName = data.platforms.find((platform) => platform.id === platformId)?.name;
    const nextName = (platformEdits[platformId] ?? currentName ?? "").trim();
    if (!currentName || nextName === currentName) return;
    setSaving(true);
    setError(null);
    try {
      const nextData = await updatePlatform({ platformId, name: nextName });
      setData(nextData);
      setPlatformEdits((current) => ({ ...current, [platformId]: nextName }));
      setMessage("平台已更新");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const movePlatformOrder = async (platformId: number, direction: "up" | "down") => {
    setSaving(true);
    setError(null);
    try {
      const nextData = await movePlatform({ platformId, direction });
      setData(nextData);
      setMessage("平台排序已更新");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const saveAccountName = async (accountId: number) => {
    const currentName = data.accounts.find((account) => account.id === accountId)?.name;
    const nextName = (accountEdits[accountId] ?? currentName ?? "").trim();
    if (!currentName || nextName === currentName) return;
    setSaving(true);
    setError(null);
    try {
      const nextData = await updateAccount({ accountId, name: nextName });
      setData(nextData);
      setAccountEdits((current) => ({ ...current, [accountId]: nextName }));
      setMessage("账户已更新");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const moveAccountOrder = async (accountId: number, direction: "up" | "down") => {
    setSaving(true);
    setError(null);
    try {
      const nextData = await moveAccount({ accountId, direction });
      setData(nextData);
      setMessage("账户排序已更新");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const editSnapshot = (summary: SnapshotSummary) => {
    const snapshot = data.snapshots.find((item) => item.id === summary.snapshotId);
    if (!snapshot) {
      setError("快照明细不存在");
      return;
    }
    const amounts = Object.fromEntries([
      ...snapshot.items.map((item) => [item.accountId, item.amount] as const),
      ...activeAccounts
        .filter((account) => !snapshot.items.some((item) => item.accountId === account.id))
        .map((account) => [account.id, "0"] as const),
    ]);
    setEditingSnapshotId(snapshot.id);
    setSnapshotForm({
      date: snapshot.date,
      note: snapshot.note ?? "",
      amounts,
    });
    setSnapshotOpen(true);
    setError(null);
    setMessage(null);
  };

  const removeSnapshot = async (summary: SnapshotSummary) => {
    if (!window.confirm(`确定删除 ${summary.date} 的快照吗？`)) return;
    setSaving(true);
    setError(null);
    try {
      const nextData = await deleteSnapshot({ snapshotId: summary.snapshotId });
      setData(nextData);
      setMessage("快照已删除");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const openAnalysisModal = async (summary: SnapshotSummary) => {
    setAnalysisSnapshotId(summary.snapshotId);
    setAnalysisOpen(true);
    setAnalysisItems([]);
    setError(null);
    setMessage(null);
    try {
      const analysis = await getSnapshotAnalysis({ snapshotId: summary.snapshotId });
      setAnalysisItems(analysis.items.length > 0 ? analysis.items : [emptyAnalysisItem("income")]);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const saveAnalysis = async () => {
    if (!analysisSnapshotId) return;
    setSaving(true);
    setError(null);
    try {
      const nextAnalysis = await saveSnapshotAnalysis({
        snapshotId: analysisSnapshotId,
        items: normalizeAnalysisItems(analysisItems),
      });
      setAnalysisItems(nextAnalysis.items);
      setMessage("变动分析已保存");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const addAnalysisItem = (type: "income" | "expense") => {
    setAnalysisItems((current) => [...current, emptyAnalysisItem(type)]);
  };

  const updateAnalysisItem = (index: number, nextItem: AnalysisItem) => {
    setAnalysisItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? nextItem : item)),
    );
  };

  const removeAnalysisItem = (index: number) => {
    setAnalysisItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const autofillAnalysisGap = () => {
    if (!analysisSnapshotId) return;
    const summary = data.summaries.find((item) => item.snapshotId === analysisSnapshotId);
    const previousSummary = previousSummaryFor(data.summaries, analysisSnapshotId);
    if (!summary || !previousSummary) return;

    const change = Number(summary.totalAsset) - Number(previousSummary.totalAsset);
    const gap = roundMoney(change - explainedAmount(analysisItems));
    if (gap === 0) return;

    setAnalysisItems((current) => [
      ...current,
      {
        type: gap > 0 ? "income" : "expense",
        name: gap > 0 ? "其余收入" : "其余支出",
        amounts: [Math.abs(gap).toFixed(2)],
      },
    ]);
  };

  const openSnapshotModal = () => {
    setEditingSnapshotId(null);
    setSnapshotForm((current) => ({
      ...current,
      date: new Date().toISOString().slice(0, 10),
      amounts: Object.fromEntries(activeAccounts.map((account) => [account.id, "0"])),
    }));
    setSnapshotOpen(true);
    setError(null);
    setMessage(null);
  };

  const openDataFileModal = async () => {
    setDataFileOpen(true);
    setError(null);
    setMessage(null);
    try {
      setDataFileInfo(await getDataFileInfo());
    } catch (reason) {
      setError(String(reason));
    }
  };

  const chooseDataFile = async () => {
    setSaving(true);
    setError(null);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        title: "选择资产快照数据文件",
        multiple: false,
        directory: false,
        filters: dataFileFilters,
      });
      if (typeof selected !== "string") return;
      // Skip if the same file is already open (locked or unlocked)
      if (selected === databaseStatus?.currentPath) {
        setDataFileOpen(false);
        setMessage("当前已在使用此数据文件");
        return;
      }
      const nextData = await switchDataFile({ path: selected });
      setData(nextData);
      setDataFileInfo(await getDataFileInfo());
      setDataFileOpen(false);
      const status = await getDatabaseStatus();
      setDatabaseStatus(status);
      setLocked(status.locked);
      setUnlockError(null);
      setMessage("已切换数据文件");
    } catch (reason) {
      // Check backend state to decide whether the target file is encrypted/locked
      try {
        const status = await getDatabaseStatus();
        setDatabaseStatus(status);
        if (status.locked) {
          setLocked(true);
          setUnlockError(null);
          setUnlockWaitSeconds(0);
          setDataFileOpen(false);
          setError(null);
          return;
        }
      } catch {
        // Fall through to showing the error
      }
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const createDataFile = async () => {
    setSaving(true);
    setError(null);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const selected = await save({
        title: "新建资产快照数据文件",
        defaultPath: "asset-snapshot.as",
        filters: dataFileFilters,
      });
      if (!selected) return;
      const nextData = await switchDataFile({ path: selected });
      setData(nextData);
      setDataFileInfo(await getDataFileInfo());
      setDataFileOpen(false);
      const status = await getDatabaseStatus();
      setDatabaseStatus(status);
      setLocked(status.locked);
      setUnlockError(null);
      setMessage("已创建并切换数据文件");
    } catch (reason) {
      try {
        const status = await getDatabaseStatus();
        setDatabaseStatus(status);
        if (status.locked) {
          setLocked(true);
          setUnlockError(null);
          setUnlockWaitSeconds(0);
          setDataFileOpen(false);
          setError(null);
          return;
        }
      } catch {
        // Fall through to showing the error
      }
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const exportBackup = async () => {
    setSaving(true);
    setError(null);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const todayText = new Date().toISOString().slice(0, 10);
      const selected = await save({
        title: "导出数据文件备份",
        defaultPath: `asset-snapshot-backup-${todayText}.as`,
        filters: dataFileFilters,
      });
      if (!selected) return;
      setDataFileInfo(await backupDataFile({ path: selected }));
      setMessage("备份已导出");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const openConfigModal = () => {
    setPlatformEdits(Object.fromEntries(data.platforms.map((platform) => [platform.id, platform.name])));
    setAccountEdits(Object.fromEntries(data.accounts.map((account) => [account.id, account.name])));
    setAccountForm((current) => ({
      ...current,
      platformId:
        data.platforms.some((platform) => String(platform.id) === current.platformId)
          ? current.platformId
          : String(data.platforms[0]?.id ?? ""),
    }));
    setConfigOpen(true);
    setError(null);
    setMessage(null);
  };

  const closeModal = () => {
    setConfigOpen(false);
    setDataFileOpen(false);
    setSnapshotOpen(false);
    setAnalysisOpen(false);
    setEditingSnapshotId(null);
    setAnalysisSnapshotId(null);
    setError(null);
    setMessage(null);
  };

  const latest = data.summaries[data.summaries.length - 1];
  const previous = data.summaries[data.summaries.length - 2];

  const totalDelta = useMemo(() => {
    if (!latest || !previous) return "暂无历史对比";
    return signedAmount(Number(latest.totalAsset) - Number(previous.totalAsset));
  }, [latest, previous]);

  const trend = useMemo(
    () => buildTrendData(data.summaries, timeRange, customRange),
    [customRange, data.summaries, timeRange],
  );
  const chartColors = darkMode ? darkPlatformColors : platformColors;
  const chartStroke = darkMode ? "#ebf1e8" : "#162018";
  const chartGrid = darkMode ? "rgba(235, 241, 232, 0.12)" : "#e6e9e2";
  const chartText = darkMode ? "rgba(235, 241, 232, 0.62)" : "rgba(22, 32, 24, 0.62)";
  const tooltipStyle = {
    backgroundColor: darkMode ? "#181e1b" : "#ffffff",
    border: `1px solid ${darkMode ? "rgba(235, 241, 232, 0.12)" : "rgba(22, 32, 24, 0.12)"}`,
    borderRadius: 8,
    color: chartStroke,
  };

  const distribution: Array<{ name: string; value: number }> =
    latest?.platformAssets.map((item) => ({
      name: item.platformName,
      value: Math.max(Number(item.amount), 0),
    })) ?? [];
  const recentSummaries = [...data.summaries].reverse().slice(0, 8);
  const analysisSummary = analysisSnapshotId
    ? data.summaries.find((summary) => summary.snapshotId === analysisSnapshotId)
    : undefined;
  const analysisPrevious = analysisSnapshotId ? previousSummaryFor(data.summaries, analysisSnapshotId) : undefined;
  const analysisChange =
    analysisSummary && analysisPrevious
      ? roundMoney(Number(analysisSummary.totalAsset) - Number(analysisPrevious.totalAsset))
      : 0;
  const analysisExplained = roundMoney(explainedAmount(analysisItems));
  const analysisGap = roundMoney(analysisChange - analysisExplained);
  const analysisDescription =
    analysisSummary && analysisPrevious
      ? buildAnalysisDescription(analysisItems, analysisChange)
      : "需要至少两次快照才能生成变动说明。";

  if (locked) {
    return (
      <UnlockScreen
        currentPath={databaseStatus?.currentPath ?? ""}
        onUnlock={handleUnlock}
        error={unlockError}
        waitSeconds={unlockWaitSeconds}
      />
    );
  }

  return (
    <main className="min-h-screen bg-app">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-ink/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-moss">本地优先的个人资产工具</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">资产快照</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              className="size-10 px-0"
              title={darkMode ? "切换浅色模式" : "切换暗色模式"}
              onClick={() => setDarkMode((current) => !current)}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Button variant="secondary" onClick={openDataFileModal}>
              <Database size={18} />
              数据文件
            </Button>
            <Button onClick={openSnapshotModal}>
              <FilePlus2 size={18} />
              新建快照
            </Button>
          </div>
        </header>

        <div className="flex items-center gap-x-4 rounded-md border border-ink/10 bg-subtle px-4 py-2 text-xs">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-ink/50">
            <Database size={14} />
            数据文件:
          </span>
          <span
            className="inline-flex min-w-0 cursor-pointer font-mono text-ink/70 transition-colors hover:text-ink"
            title={`点击复制: ${databaseStatus?.currentPath ?? ""}`}
            onClick={() => {
              const path = databaseStatus?.currentPath ?? "";
              if (!path) return;
              navigator.clipboard.writeText(path).then(
                () => {
                  setMessage(null);
                  setError(null);
                  setToast({ text: "已复制文件路径", kind: "success" });
                },
                () => setToast({ text: "复制失败", kind: "error" }),
              );
            }}
          >
            {(() => {
              const path = databaseStatus?.currentPath ?? "";
              const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
              const dir = lastSep >= 0 ? path.slice(0, lastSep + 1) : "";
              const file = lastSep >= 0 ? path.slice(lastSep + 1) : path;
              return (
                <>
                  <span className="min-w-0 truncate">{dir}</span>
                  <span className="shrink-0">{file}</span>
                </>
              );
            })()}
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
              className="shrink-0 rounded px-1.5 py-0.5 text-ink/50 transition-colors hover:bg-ink/10 hover:text-ink"
              onClick={handleLock}
            >
              <Lock size={14} className="inline-block" /> 锁定
            </button>
          ) : null}
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <Stat
            icon={<WalletCards size={20} />}
            label="总资产"
            value={money(latest?.totalAsset ?? 0)}
            helper={`较上次 ${totalDelta}`}
          />
          <Stat
            icon={<WalletCards size={20} />}
            label="可用资产"
            value={money(latest?.availableAsset ?? 0)}
            helper="仅统计流动资产"
          />
          <Stat
            icon={<Plus size={20} />}
            label="已启用账户"
            value={`${data.accounts.filter((account) => account.isActive).length}`}
            helper={`${data.platforms.length} 个平台`}
            iconTitle="管理平台与账户"
            onIconClick={openConfigModal}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="rounded-lg border border-ink/10 bg-panel p-5 shadow-panel">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">趋势分析</h2>
                <p className="mt-1 text-sm text-ink/55">
                  {trend.visibleCount > 0
                    ? `${trend.rangeLabel} · ${trend.granularityLabel} · ${trend.visibleCount} 条记录`
                    : "当前范围暂无快照"}
                </p>
              </div>
              <TimeRangeTabs value={timeRange} onChange={setTimeRange} />
            </div>
            {timeRange === "custom" ? (
              <div className="mb-4 grid gap-3 rounded-md bg-subtle p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                <div className="space-y-2">
                  <Label>开始日期</Label>
                  <DatePicker
                    value={customRange.start}
                    onChange={(value) => setCustomRange((current) => ({ ...current, start: value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>结束日期</Label>
                  <DatePicker
                    value={customRange.end}
                    onChange={(value) => setCustomRange((current) => ({ ...current, end: value }))}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="sm:mt-7"
                  onClick={() =>
                    setCustomRange({
                      start: data.summaries[0]?.date ?? customRange.start,
                      end: latest?.date ?? customRange.end,
                    })
                  }
                >
                  全部
                </Button>
              </div>
            ) : null}
            <div className="h-72">
              {trend.points.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend.points}>
                    <CartesianGrid stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: chartText }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: chartText }}
                      tickFormatter={(value) => `${value / 10000}万`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: chartStroke }}
                      itemStyle={{ color: chartStroke }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
                      formatter={(value) => money(Number(value))}
                    />
                    <Line
                      type="monotone"
                      dataKey="总资产"
                      stroke={chartStroke}
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    {data.platforms.map((platform, index) => (
                      <Line
                        key={platform.id}
                        type="monotone"
                        dataKey={platform.name}
                        stroke={chartColors[index % chartColors.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md bg-subtle text-sm text-ink/50">
                  这个时间范围内还没有快照
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink/65">
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-5 rounded bg-ink" />
                总资产
              </span>
              {data.platforms.map((platform, index) => (
                <span key={platform.id} className="inline-flex items-center gap-2">
                  <span
                    className="h-0.5 w-5 rounded"
                    style={{ backgroundColor: chartColors[index % chartColors.length] }}
                  />
                  {platform.name}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink/10 bg-panel p-5 shadow-panel">
            <h2 className="text-lg font-semibold text-ink">资产分布</h2>
            <p className="mt-1 text-sm text-ink/55">{latest?.date ?? "暂无快照"}</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96}>
                    {distribution.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: chartStroke }}
                    itemStyle={{ color: chartStroke }}
                    formatter={(value) => money(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-lg border border-ink/10 bg-panel p-5 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">历史快照</h2>
                <p className="mt-1 text-sm text-ink/55">最近记录，汇总值实时计算</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-md bg-mint text-moss">
                <History size={20} />
              </div>
            </div>
            <div className="mt-4 divide-y divide-ink/10">
              {recentSummaries.map((summary) => (
                <div key={summary.snapshotId} className="grid gap-3 py-3 sm:grid-cols-[120px_1fr_1fr_auto]">
                  <div>
                    <p className="font-medium text-ink">{summary.date}</p>
                    <p className="mt-1 text-sm text-ink/45">快照</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink/55">总资产</p>
                    <p className="mt-1 font-semibold text-ink">{money(summary.totalAsset)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink/55">可用资产</p>
                    <p className="mt-1 font-semibold text-moss">{money(summary.availableAsset)}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-9 px-0"
                      title="资产变动分析"
                      onClick={() => openAnalysisModal(summary)}
                      disabled={saving}
                    >
                      <Calculator size={17} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-9 px-0"
                      title="编辑快照"
                      onClick={() => editSnapshot(summary)}
                      disabled={saving}
                    >
                      <Pencil size={17} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-9 px-0 text-coral"
                      title="删除快照"
                      onClick={() => removeSnapshot(summary)}
                      disabled={saving}
                    >
                      <Trash2 size={17} />
                    </Button>
                  </div>
                </div>
              ))}
              {recentSummaries.length === 0 ? (
                <div className="py-8 text-center text-sm text-ink/50">暂无快照</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-ink/10 bg-panel p-5 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-ink">账户配置</h2>
              <Button variant="ghost" className="px-3" onClick={openConfigModal}>
                <Plus size={18} />
              </Button>
            </div>
            <div className="mt-4 divide-y divide-ink/10">
              {data.accounts.map((account) => {
                const platform = data.platforms.find((item) => item.id === account.platformId);
                return (
                  <div key={account.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium text-ink">{account.name}</p>
                      <p className="mt-1 text-sm text-ink/55">{platform?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-mint px-2 py-1 text-xs font-medium text-moss">
                        {accountTypeLabel(account.type)}
                      </span>
                      <Button
                        variant="ghost"
                        className="size-9 px-0"
                        title={account.isActive ? "停用账户" : "启用账户"}
                        onClick={() => toggleAccountActive(account)}
                        disabled={saving}
                      >
                        {account.isActive ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-9 px-0 text-coral"
                        title="删除无历史账户"
                        onClick={() => removeAccount(account)}
                        disabled={saving}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Feedback message={message} error={error} />
          </div>
        </section>
      </div>

      <Modal
        open={dataFileOpen}
        title="数据文件"
        description="当前资产数据保存在本地 SQLite 文件中，可以切换文件或导出备份。"
        onClose={closeModal}
      >
        <div className="space-y-5">
          <div className="rounded-md border border-ink/10 bg-subtle p-4">
            <p className="text-sm font-medium text-ink">当前数据库位置</p>
            <p className="mt-2 break-all font-mono text-xs leading-5 text-ink/65">
              {dataFileInfo?.currentPath ?? "正在读取..."}
            </p>
            <p className="mt-2 text-sm text-ink/65">
              加密状态:{" "}
              <span className={databaseStatus?.encrypted ? "font-medium text-moss" : "text-ink/50"}>
                {databaseStatus?.encrypted ? "已加密" : "未加密"}
              </span>
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {databaseStatus?.encrypted ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPasswordChangeOpen(true);
                    setError(null);
                  }}
                  disabled={saving}
                >
                  <KeyRound size={18} />
                  修改密码
                </Button>
                <Button type="button" variant="secondary" onClick={handleLock} disabled={saving}>
                  <Lock size={18} />
                  锁定
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPasswordSetupOpen(true);
                  setError(null);
                }}
                disabled={saving}
              >
                <Unlock size={18} />
                设置密码
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Button type="button" variant="secondary" onClick={chooseDataFile} disabled={saving}>
              <FolderOpen size={18} />
              选择文件
            </Button>
            <Button type="button" variant="secondary" onClick={createDataFile} disabled={saving}>
              <FilePlus2 size={18} />
              新建文件
            </Button>
            <Button type="button" variant="secondary" onClick={exportBackup} disabled={saving}>
              <Download size={18} />
              导出备份
            </Button>
          </div>
          <p className="text-sm leading-6 text-ink/55">
            选择或新建数据文件后，应用会立即切换到该文件，并在下次启动时继续使用它。备份会复制当前数据库文件，不会改变正在使用的数据文件。
          </p>
          <Feedback message={message} error={error} />
        </div>
      </Modal>

      <Modal
        open={configOpen}
        title="平台与账户"
        description="平台表示钱在哪里，账户是每次快照录入金额的单位。"
        onClose={closeModal}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <form className="space-y-3" onSubmit={submitPlatform}>
            <div>
              <h3 className="font-semibold text-ink">管理平台</h3>
              <p className="mt-1 text-sm text-ink/55">平台表示钱在哪里，例如支付宝、招商银行、微信。</p>
            </div>
            <div className="space-y-2">
              {data.platforms.map((platform, index) => {
                const editedName = platformEdits[platform.id] ?? platform.name;
                const changed = editedName.trim() !== platform.name;
                return (
                  <div key={platform.id} className="rounded-md bg-subtle p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editedName}
                        aria-label={`${platform.name} 平台名称`}
                        onChange={(event) =>
                          setPlatformEdits((current) => ({
                            ...current,
                            [platform.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-9 shrink-0 px-0"
                        title="保存平台名称"
                        onClick={() => savePlatformName(platform.id)}
                        disabled={saving || !changed}
                      >
                        <Check size={16} />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-8 px-0"
                        title="平台上移"
                        onClick={() => movePlatformOrder(platform.id, "up")}
                        disabled={saving || index === 0}
                      >
                        <ArrowUp size={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-8 px-0"
                        title="平台下移"
                        onClick={() => movePlatformOrder(platform.id, "down")}
                        disabled={saving || index === data.platforms.length - 1}
                      >
                        <ArrowDown size={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-8 px-0 text-coral"
                        title="删除无历史平台"
                        onClick={() => removePlatform(platform.id)}
                        disabled={saving}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {data.platforms.length === 0 ? (
                <div className="rounded-md bg-subtle px-3 py-6 text-center text-sm text-ink/45">
                  暂无平台
                </div>
              ) : null}
              <div className="rounded-md bg-subtle p-2">
                <Label htmlFor="platform-name" className="sr-only">
                  平台名称
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="platform-name"
                    value={platformName}
                    placeholder="新建平台"
                    onChange={(event) => setPlatformName(event.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    className="size-9 shrink-0 px-0"
                    title="添加平台"
                    disabled={saving || !platformName.trim()}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </form>

          <form className="space-y-3" onSubmit={submitAccount}>
            <div>
              <h3 className="font-semibold text-ink">管理账户</h3>
              <p className="mt-1 text-sm text-ink/55">账户是每次快照录入金额的单位。</p>
            </div>
            <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
              {data.platforms.map((platform) => {
                const accounts = data.accounts.filter((account) => account.platformId === platform.id);
                if (accounts.length === 0) return null;
                return (
                  <div key={platform.id} className="space-y-2">
                    <p className="text-xs font-semibold text-ink/50">{platform.name}</p>
                    {accounts.map((account, index) => {
                      const editedName = accountEdits[account.id] ?? account.name;
                      const changed = editedName.trim() !== account.name;
                      return (
                        <div key={account.id} className="rounded-md bg-subtle p-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={editedName}
                              aria-label={`${account.name} 账户名称`}
                              onChange={(event) =>
                                setAccountEdits((current) => ({
                                  ...current,
                                  [account.id]: event.target.value,
                                }))
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              className="size-9 shrink-0 px-0"
                              title="保存账户名称"
                              onClick={() => saveAccountName(account.id)}
                              disabled={saving || !changed}
                            >
                              <Check size={16} />
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="rounded bg-mint px-2 py-1 text-xs font-medium text-moss">
                              {accountTypeLabel(account.type)}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                className="size-8 px-0"
                                title="账户上移"
                                onClick={() => moveAccountOrder(account.id, "up")}
                                disabled={saving || index === 0}
                              >
                                <ArrowUp size={16} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="size-8 px-0"
                                title="账户下移"
                                onClick={() => moveAccountOrder(account.id, "down")}
                                disabled={saving || index === accounts.length - 1}
                              >
                                <ArrowDown size={16} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="size-8 px-0"
                                title={account.isActive ? "停用账户" : "启用账户"}
                                onClick={() => toggleAccountActive(account)}
                                disabled={saving}
                              >
                                {account.isActive ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="size-8 px-0 text-coral"
                                title="删除无历史账户"
                                onClick={() => removeAccount(account)}
                                disabled={saving}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {data.accounts.length === 0 ? (
                <div className="rounded-md bg-subtle px-3 py-6 text-center text-sm text-ink/45">
                  暂无账户
                </div>
              ) : null}
              <div className="space-y-3 rounded-md bg-subtle p-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor="account-platform">所属平台</Label>
                    <ChoiceSelect
                      value={accountForm.platformId}
                      placeholder="选择平台"
                      options={data.platforms.map((platform) => ({
                        value: String(platform.id),
                        label: platform.name,
                      }))}
                      onChange={(value) => setAccountForm((current) => ({ ...current, platformId: value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="account-type">账户类型</Label>
                    <ChoiceSelect
                      value={accountForm.type}
                      options={accountTypeOptions}
                      onChange={(value) =>
                        setAccountForm((current) => ({ ...current, type: value as AccountType }))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="account-name" className="sr-only">
                    账户名称
                  </Label>
                  <Input
                    id="account-name"
                    value={accountForm.name}
                    placeholder="新建账户，例如余额 / 理财 / 信用卡"
                    onChange={(event) =>
                      setAccountForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    className="size-9 shrink-0 px-0"
                    title="添加账户"
                    disabled={saving || !accountForm.platformId || !accountForm.name.trim()}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
        <Feedback message={message} error={error} />
      </Modal>

      <Modal
        open={snapshotOpen}
        title={editingSnapshotId ? "编辑快照" : "新建快照"}
        description="一次快照只记录某个时间点的账户余额。"
        onClose={closeModal}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal}>
              取消
            </Button>
            <Button type="submit" form="snapshot-form" disabled={saving || snapshotAccounts.length === 0}>
              {editingSnapshotId ? "更新快照" : "保存快照"}
            </Button>
          </>
        }
      >
        <form id="snapshot-form" className="space-y-5" onSubmit={submitSnapshot}>
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="snapshot-date">日期</Label>
              <DatePicker
                value={snapshotForm.date}
                onChange={(value) => setSnapshotForm((current) => ({ ...current, date: value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snapshot-note">备注</Label>
              <Input
                id="snapshot-note"
                value={snapshotForm.note}
                placeholder="可选"
                onChange={(event) =>
                  setSnapshotForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
            {snapshotAccounts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-ink/15 bg-subtle px-4 py-8 text-center">
                <p className="font-medium text-ink">需要先新建平台和账户</p>
                <p className="mt-2 text-sm leading-6 text-ink/55">
                  快照必须至少包含一个启用账户。请先在平台与账户中添加平台，再添加账户。
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => {
                    setSnapshotOpen(false);
                    openConfigModal();
                  }}
                >
                  <Plus size={18} />
                  去新建账户
                </Button>
              </div>
            ) : null}
            {snapshotAccounts.map((account) => {
              const platform = data.platforms.find((item) => item.id === account.platformId);
              return (
                <div
                  key={account.id}
                  className="grid gap-3 rounded-lg border border-ink/10 p-3 sm:grid-cols-[1fr_180px]"
                >
                  <div>
                    <p className="font-medium text-ink">{account.name}</p>
                    <p className="mt-1 text-sm text-ink/55">
                      {platform?.name} · {accountTypeLabel(account.type)}
                    </p>
                  </div>
                  <Input
                    inputMode="decimal"
                    value={snapshotForm.amounts[account.id] ?? "0"}
                    onChange={(event) =>
                      setSnapshotForm((current) => ({
                        ...current,
                        amounts: {
                          ...current.amounts,
                          [account.id]: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
          <Feedback message={message} error={error} />
        </form>
      </Modal>

      <Modal
        open={analysisOpen}
        title="资产变动分析"
        description="解释两次快照之间的重要收入与支出，不记录完整流水。"
        onClose={closeModal}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal}>
              关闭
            </Button>
            <Button
              type="button"
              onClick={saveAnalysis}
              disabled={saving || !analysisSummary || !analysisPrevious}
            >
              保存分析
            </Button>
          </>
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-ink/10 p-3">
                  <p className="text-sm text-ink/55">已解释金额</p>
                  <p className="mt-1 font-semibold text-ink">{signedAmount(analysisExplained)}</p>
                </div>
                <div className="rounded-md border border-ink/10 p-3">
                  <p className="text-sm text-ink/55">未解释金额</p>
                  <p className="mt-1 font-semibold text-coral">{signedAmount(analysisGap)}</p>
                </div>
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={autofillAnalysisGap}
                    disabled={analysisGap === 0}
                  >
                    <Sparkles size={18} />
                    自动补足差额
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <AnalysisColumn
                  title="收入项目"
                  type="income"
                  items={analysisItems}
                  saving={saving}
                  onAdd={() => addAnalysisItem("income")}
                  onChange={updateAnalysisItem}
                  onRemove={removeAnalysisItem}
                />
                <AnalysisColumn
                  title="支出项目"
                  type="expense"
                  items={analysisItems}
                  saving={saving}
                  onAdd={() => addAnalysisItem("expense")}
                  onChange={updateAnalysisItem}
                  onRemove={removeAnalysisItem}
                />
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

          <Feedback message={message} error={error} />
        </div>
      </Modal>

      <PasswordSetupModal
        open={passwordSetupOpen}
        onClose={() => setPasswordSetupOpen(false)}
        onSetPassword={handleSetPassword}
        saving={passwordLoading}
        error={error}
      />

      <PasswordChangeModal
        open={passwordChangeOpen}
        onClose={() => setPasswordChangeOpen(false)}
        onChangePassword={handleChangePassword}
        saving={passwordLoading}
        error={error}
      />

      {toast ? (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg transition-all duration-300 ${
            toast.kind === "success"
              ? "bg-moss text-white"
              : "bg-coral text-white"
          }`}
        >
          {toast.text}
        </div>
      ) : null}
    </main>
  );
}

function AnalysisColumn({
  title,
  type,
  items,
  saving,
  onAdd,
  onChange,
  onRemove,
}: {
  title: string;
  type: "income" | "expense";
  items: AnalysisItem[];
  saving: boolean;
  onAdd: () => void;
  onChange: (index: number, item: AnalysisItem) => void;
  onRemove: (index: number) => void;
}) {
  const visibleItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === type);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-ink">{title}</h3>
        <Button type="button" variant="ghost" className="size-9 px-0" onClick={onAdd} disabled={saving}>
          <Plus size={16} />
        </Button>
      </div>
      <div className="max-h-[38vh] space-y-3 overflow-y-auto pr-1">
        {visibleItems.map(({ item, index }) => {
          const total = sumAmounts(item.amounts);
          return (
            <div key={index} className="rounded-lg border border-ink/10 p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={item.name}
                  placeholder={type === "income" ? "收入名称" : "支出名称"}
                  onChange={(event) => onChange(index, { ...item, name: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="size-9 shrink-0 px-0 text-coral"
                  title="删除项目"
                  onClick={() => onRemove(index)}
                  disabled={saving}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {item.amounts.map((amount, amountIndex) => (
                  <div key={amountIndex} className="flex items-center gap-2">
                    <Input
                      inputMode="decimal"
                      value={amount}
                      placeholder="金额"
                      onChange={(event) => {
                        const amounts = item.amounts.map((current, currentIndex) =>
                          currentIndex === amountIndex ? event.target.value : current,
                        );
                        onChange(index, { ...item, amounts });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-9 shrink-0 px-0"
                      title="删除金额"
                      onClick={() => {
                        const amounts = item.amounts.filter((_, currentIndex) => currentIndex !== amountIndex);
                        onChange(index, { ...item, amounts: amounts.length > 0 ? amounts : [""] });
                      }}
                      disabled={saving}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3"
                    onClick={() => onChange(index, { ...item, amounts: [...item.amounts, ""] })}
                    disabled={saving}
                  >
                    <Plus size={16} />
                    金额
                  </Button>
                  <p className="text-sm font-medium text-ink/65">合计 {money(total)}</p>
                </div>
              </div>
            </div>
          );
        })}
        {visibleItems.length === 0 ? (
          <div className="rounded-md bg-subtle px-3 py-6 text-center text-sm text-ink/45">
            暂无{type === "income" ? "收入" : "支出"}项目
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Feedback({ message, error }: { message: string | null; error: string | null }) {
  if (!message && !error) return null;
  return (
    <div className="mt-4 rounded-md border border-ink/10 bg-subtle px-3 py-2 text-sm">
      {error ? <p className="text-coral">{error}</p> : <p className="text-moss">{message}</p>}
    </div>
  );
}

type TrendPoint = {
  date: string;
  fullDate: string;
  总资产: number;
} & Record<string, string | number>;

function buildTrendData(
  summaries: SnapshotSummary[],
  range: TimeRangeKey,
  customRange: { start: string; end: string },
) {
  const sortedSummaries = [...summaries].sort((left, right) => left.date.localeCompare(right.date));
  const lastSummary = sortedSummaries[sortedSummaries.length - 1];
  const anchorDate = parseDate(lastSummary?.date) ?? today();
  const bounds = rangeBounds(range, customRange, anchorDate);
  const startTime = bounds.start.getTime();
  const endTime = bounds.end.getTime();
  const visibleSummaries = sortedSummaries.filter((summary) => {
    const date = parseDate(summary.date);
    if (!date) return false;
    const time = date.getTime();
    return time >= startTime && time <= endTime;
  });
  const spanDays = Math.max(1, Math.round((endTime - startTime) / dayMs) + 1);
  const granularity = spanDays <= 90 ? "day" : spanDays <= 366 ? "week" : "month";
  const latestByBucket = new Map<string, SnapshotSummary>();

  visibleSummaries.forEach((summary) => {
    const date = parseDate(summary.date);
    if (!date) return;
    latestByBucket.set(bucketKey(date, granularity), summary);
  });

  const bucketedSummaries = [...latestByBucket.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  return {
    points: bucketedSummaries.map((summary) => trendPoint(summary, granularity)),
    visibleCount: visibleSummaries.length,
    rangeLabel: `${formatDate(bounds.start)} 至 ${formatDate(bounds.end)}`,
    granularityLabel:
      granularity === "day" ? "按日展示" : granularity === "week" ? "按周聚合" : "按月聚合",
  };
}

function rangeBounds(
  range: TimeRangeKey,
  customRange: { start: string; end: string },
  anchorDate: Date,
) {
  if (range === "custom") {
    const start = parseDate(customRange.start) ?? anchorDate;
    const end = parseDate(customRange.end) ?? anchorDate;
    return normalizeBounds(start, end);
  }

  const end = new Date(anchorDate);
  const start = new Date(anchorDate);
  if (range === "3m") {
    start.setMonth(start.getMonth() - 3);
  } else if (range === "1y") {
    start.setFullYear(start.getFullYear() - 1);
  } else {
    start.setFullYear(start.getFullYear() - 3);
  }
  return normalizeBounds(start, end);
}

function normalizeBounds(start: Date, end: Date) {
  const normalizedStart = startOfDay(start);
  const normalizedEnd = startOfDay(end);
  if (normalizedStart.getTime() <= normalizedEnd.getTime()) {
    return { start: normalizedStart, end: normalizedEnd };
  }
  return { start: normalizedEnd, end: normalizedStart };
}

function trendPoint(summary: SnapshotSummary, granularity: "day" | "week" | "month"): TrendPoint {
  const date = parseDate(summary.date) ?? today();
  return {
    date: trendLabel(date, granularity),
    fullDate: summary.date,
    总资产: Number(summary.totalAsset),
    ...Object.fromEntries(
      summary.platformAssets.map((item) => [item.platformName, Number(item.amount)]),
    ),
  };
}

function trendLabel(date: Date, granularity: "day" | "week" | "month") {
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}周`;
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function bucketKey(date: Date, granularity: "day" | "week" | "month") {
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    const weekStart = new Date(date);
    const day = weekStart.getDay() || 7;
    weekStart.setDate(weekStart.getDate() - day + 1);
    return formatDate(weekStart);
  }
  return formatDate(date);
}

function parseDate(value?: string) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return startOfDay(date);
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function today() {
  return startOfDay(new Date());
}

function accountTypeLabel(type: AccountType) {
  if (type === "asset_liquid") return "流动资产";
  if (type === "asset_nonliquid") return "非流动资产";
  return "负债";
}

function emptyAnalysisItem(type: "income" | "expense"): AnalysisItem {
  return { type, name: "", amounts: [""] };
}

function normalizeAnalysisItems(items: AnalysisItem[]) {
  return items
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      amounts: item.amounts.map((amount) => amount.trim()).filter(Boolean),
    }))
    .filter((item) => item.name || item.amounts.length > 0);
}

function previousSummaryFor(summaries: SnapshotSummary[], snapshotId: number) {
  const sorted = [...summaries].sort((left, right) => {
    const dateCompare = left.date.localeCompare(right.date);
    return dateCompare === 0 ? left.snapshotId - right.snapshotId : dateCompare;
  });
  const index = sorted.findIndex((summary) => summary.snapshotId === snapshotId);
  return index > 0 ? sorted[index - 1] : undefined;
}

function explainedAmount(items: AnalysisItem[]) {
  return items.reduce((total, item) => {
    const itemTotal = sumAmounts(item.amounts);
    return total + (item.type === "income" ? itemTotal : -itemTotal);
  }, 0);
}

function sumAmounts(amounts: string[]) {
  return roundMoney(
    amounts.reduce((total, amount) => {
      const parsed = Number(amount);
      return Number.isFinite(parsed) ? total + parsed : total;
    }, 0),
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildAnalysisDescription(items: AnalysisItem[], assetChange: number) {
  const parts = normalizeAnalysisItems(items)
    .map((item) => ({
      name: item.name,
      amount: sumAmounts(item.amounts),
    }))
    .filter((item) => item.amount !== 0)
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
    .map((item) => `${item.name}${formatPlainMoney(item.amount)}元`);

  const summary =
    assetChange >= 0
      ? `总资产增加${formatPlainMoney(Math.abs(assetChange))}元。`
      : `总资产减少${formatPlainMoney(Math.abs(assetChange))}元。`;
  return [...parts.map((part) => `${part}，`), summary].join("\n");
}

function formatPlainMoney(value: number) {
  return roundMoney(value).toLocaleString("zh-CN", {
    minimumFractionDigits: Number.isInteger(roundMoney(value)) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
