import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
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
  updateAccountType,
  updatePlatform,
  updateSnapshot,
} from "./lib/api";
import { money, signedAmount } from "./lib/format";
import { formatDate, parseDate, startOfDay, today } from "./lib/date";
import type {
  Account,
  AccountType,
  AnalysisItem,
  DashboardData,
  DataFileInfo,
  DatabaseStatus,
  SnapshotSummary,
} from "./lib/types";

const platformColorDefaults = ["#2F80ED", "#27AE60", "#F2C94C", "#EB5757", "#9B51E0", "#56CCF2", "#F2994A", "#6FCF97"];
const presetColors = ["#2F80ED", "#27AE60", "#F2C94C", "#EB5757", "#9B51E0", "#56CCF2", "#F2994A", "#6FCF97"];
const presetColorLabels = ["蓝", "绿", "黄", "红", "紫", "青", "橙", "浅绿"];
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
  const [platformColor, setPlatformColor] = useState("");
  const [platformEdits, setPlatformEdits] = useState<Record<number, string>>({});
  const [accountEdits, setAccountEdits] = useState<Record<number, string>>({});
  const [accountForm, setAccountForm] = useState<{
    platformId: string;
    name: string;
    type: AccountType;
  }>({ platformId: "", name: "", type: "asset_liquid" });
  const [snapshotForm, setSnapshotForm] = useState<{
    date: string;
    time: string;
    note: string;
    amounts: Record<number, string>;
  }>({
    date: new Date().toISOString().slice(0, 10),
    time: "00:00",
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
  }, [darkMode]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const stored = window.localStorage.getItem("asset-snapshot-theme");
      if (!stored) {
        setDarkMode(e.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((current) => {
      const next = !current;
      window.localStorage.setItem("asset-snapshot-theme", next ? "dark" : "light");
      return next;
    });
  };

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
          try {
            const status = await getDatabaseStatus();
            setDatabaseStatus(status);
            if (status.locked) {
              setLocked(true);
              setUnlockWaitSeconds(0);
              return;
            }
          } catch {
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
      const waitMatch = message.match(/(\d+)\s*seconds/);
      if (waitMatch) {
        setUnlockWaitSeconds(Number(waitMatch[1]));
      }
      try {
        const status = await getDatabaseStatus();
        setDatabaseStatus(status);
      } catch {
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
      if (platformColor) {
        const newPlatform = nextData.platforms[nextData.platforms.length - 1];
        if (newPlatform) {
          await updatePlatform({ platformId: newPlatform.id, name: newPlatform.name, color: platformColor });
        }
      }
      const refreshedData = await getDashboardData();
      setData(refreshedData);
      setAccountForm((current) => ({
        ...current,
        platformId: current.platformId || String(refreshedData.platforms[0]?.id ?? ""),
      }));
      setPlatformName("");
      setPlatformColor("");
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
        snapshotTime: snapshotForm.time,
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
    if (!window.confirm(`确定删除账户"${account.name}"吗？已有历史快照的账户不能删除。`)) return;
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
        `确定删除平台"${platform.name}"吗？只有平台下所有账户都没有历史快照时才会删除。`,
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
    const platform = data.platforms.find((p) => p.id === platformId);
    const currentName = platform?.name;
    const nextName = (platformEdits[platformId] ?? currentName ?? "").trim();
    if (!currentName || nextName === currentName) return;
    setSaving(true);
    setError(null);
    try {
      const nextData = await updatePlatform({ platformId, name: nextName, color: platform?.color });
      setData(nextData);
      setPlatformEdits((current) => ({ ...current, [platformId]: nextName }));
      setMessage("平台已更新");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  const savePlatformColor = async (platformId: number, color: string) => {
    const platform = data.platforms.find((p) => p.id === platformId);
    if (!platform) return;
    setSaving(true);
    setError(null);
    try {
      const nextData = await updatePlatform({ platformId, name: platform.name, color: color || undefined });
      setData(nextData);
      setMessage("平台颜色已更新");
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

  const changeAccountType = async (accountId: number, type: AccountType) => {
    setSaving(true);
    setError(null);
    try {
      const nextData = await updateAccountType({ accountId, type });
      setData(nextData);
      setMessage("账户类型已更新");
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
      time: snapshot.snapshotTime ?? "00:00",
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
      setAnalysisItems(analysis.items.length > 0 ? analysis.items : []);
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

  const closeModal = () => {
    setSnapshotOpen(false);
    setEditingSnapshotId(null);
    setError(null);
    setMessage(null);
  };

  const closeAnalysisModal = () => {
    setAnalysisOpen(false);
    setAnalysisSnapshotId(null);
    setError(null);
    setMessage(null);
  };

  const openConfigModal = () => {
    setConfigOpen(true);
    setPlatformEdits({});
    setAccountEdits({});
  };

  const platformColorFor = (platformId: number, index: number) => {
    const platform = data.platforms.find((p) => p.id === platformId);
    if (platform?.color) return platform.color;
    return platformColorDefaults[index % platformColorDefaults.length];
  };

  const summaries = data.summaries;
  const lastDate = summaries[summaries.length - 1]?.date ?? "";
  const lastTotalAsset = summaries[summaries.length - 1]?.totalAsset ?? "0";
  const lastAvailableAsset = summaries[summaries.length - 1]?.availableAsset ?? "0";
  const enabledAccountCount = activeAccounts.length;
  const trend = buildTrendData(summaries, timeRange, customRange);

  const platformGroups = useMemo(() => {
    const map = new Map<number, { platform: typeof data.platforms[0]; accounts: Account[] }>();
    data.platforms.forEach((p) => map.set(p.id, { platform: p, accounts: [] }));
    data.accounts.forEach((a) => {
      const group = map.get(a.platformId);
      if (group) group.accounts.push(a);
    });
    return [...map.values()];
  }, [data.platforms, data.accounts]);

  const analysisSummary = data.summaries.find((s) => s.snapshotId === analysisSnapshotId);
  const analysisPrevious = previousSummaryFor(data.summaries, analysisSnapshotId ?? 0);
  const analysisChange = analysisSummary && analysisPrevious
    ? Number(analysisSummary.totalAsset) - Number(analysisPrevious.totalAsset)
    : 0;
  const analysisExplained = explainedAmount(analysisItems);
  const analysisGap = roundMoney(analysisChange - analysisExplained);
  const analysisDescription = analysisPrevious
    ? buildAnalysisDescription(analysisItems, analysisChange, analysisGap)
    : "";

  if (locked) {
    return (
      <UnlockScreen
        currentPath={databaseStatus?.currentPath ?? "加载中..."}
        error={unlockError}
        waitSeconds={unlockWaitSeconds}
        onUnlock={handleUnlock}
      />
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink">资产快照</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            className="size-9 px-0"
            onClick={toggleDarkMode}
            title={window.localStorage.getItem("asset-snapshot-theme") ? "手动切换明暗" : "跟随系统（可点击切换）"}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          <Button variant="secondary" onClick={openConfigModal}>
            <WalletCards size={18} />
            平台与账户
          </Button>
          <Button variant="secondary" onClick={() => setDataFileOpen(true)}>
            <Database size={18} />
            数据文件
          </Button>
          {databaseStatus?.encrypted ? (
            <>
              <Button variant="secondary" onClick={() => setPasswordChangeOpen(true)}>
                <KeyRound size={18} />
                修改密码
              </Button>
              <Button variant="secondary" onClick={handleLock}>
                <Lock size={18} />
                锁定
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setPasswordSetupOpen(true)}>
              <Lock size={18} />
              设置密码
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="总资产" value={money(lastTotalAsset)} icon={<WalletCards size={20} />} />
        <Stat label="可用资产" value={money(lastAvailableAsset)} icon={<PlayCircle size={20} />} />
        <Stat label="启用账户" value={String(enabledAccountCount)} icon={<Calculator size={20} />} />
      </div>

      <div className="rounded-xl bg-panel p-4 shadow-panel sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">资产趋势</h2>
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
          </div>
        ) : null}
        {trend.points.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink/45">暂无数据</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-ink) / 0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="rgb(var(--color-ink) / 0.25)" />
                <YAxis tick={{ fontSize: 12 }} stroke="rgb(var(--color-ink) / 0.25)" />
                <Tooltip
                  contentStyle={{
                    background: "rgb(var(--color-panel))",
                    border: "1px solid rgb(var(--color-ink) / 0.1)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "rgb(var(--color-ink))",
                  }}
                />
                <Line type="monotone" dataKey="总资产" stroke="#48634f" strokeWidth={2} dot={false} />
                {data.platforms.map((platform, idx) => (
                  <Line
                    key={platform.id}
                    type="monotone"
                    dataKey={platform.name}
                    stroke={platformColorFor(platform.id, idx)}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-3 text-xs text-ink/45">
              {trend.rangeLabel} · {trend.points.length} 个节点
            </p>
          </>
        )}
      </div>

      <div className="space-y-6">
        <div className="rounded-xl bg-panel p-4 shadow-panel sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-ink">历史快照</h2>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingSnapshotId(null);
                setSnapshotForm({
                  date: new Date().toISOString().slice(0, 10),
                  time: "00:00",
                  note: "",
                  amounts: Object.fromEntries(
                    activeAccounts.map((account) => [account.id, "0"]),
                  ),
                });
                setSnapshotOpen(true);
                setError(null);
                setMessage(null);
              }}
            >
              <Plus size={18} />
              新建快照
            </Button>
          </div>

          <div className="mb-6 rounded-xl bg-subtle p-4 sm:p-6">
            <h3 className="mb-3 text-sm font-medium text-ink/55">资产分布</h3>
            {lastDate ? (
              <div className="flex flex-wrap items-start gap-8">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={summaries[summaries.length - 1]?.platformAssets.map((pa, idx) => ({
                        name: pa.platformName,
                        value: Number(pa.amount),
                        color: platformColorFor(pa.platformId, idx),
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                    >
                      {summaries[summaries.length - 1]?.platformAssets.map((pa, idx) => (
                        <Cell key={pa.platformName} fill={platformColorFor(pa.platformId, idx)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgb(var(--color-panel))",
                        border: "1px solid rgb(var(--color-ink) / 0.1)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "rgb(var(--color-ink))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 text-sm">
                  {summaries[summaries.length - 1]?.platformAssets.map((pa, idx) => (
                    <div key={pa.platformName} className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ background: platformColorFor(pa.platformId, idx) }}
                      />
                      <span className="text-ink/65">{pa.platformName}</span>
                      <span className="font-medium text-ink">{money(pa.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-ink/45">暂无快照数据</div>
            )}
          </div>

          {summaries.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink/45">还没有历史快照，点击上方按钮创建第一个。</div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_100px_100px_120px] gap-3 text-xs font-medium text-ink/45">
                <span>日期</span>
                <span>总资产</span>
                <span>可用资产</span>
                <span>备注</span>
                <span>变动分析</span>
                <span>操作</span>
              </div>
              {[...summaries].reverse().map((summary) => {
                const snapshot = data.snapshots.find((s) => s.id === summary.snapshotId);
                return (
                  <div
                    key={summary.snapshotId}
                    className="grid grid-cols-[minmax(0,1fr)_120px_120px_100px_100px_120px] items-center gap-3 rounded-lg border border-ink/10 px-4 py-2.5 text-sm"
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
                    <div>
                      <Button
                        variant="ghost"
                        className="size-9 px-0"
                        title="查看变动分析"
                        onClick={() => openAnalysisModal(summary)}
                      >
                        <Calculator size={16} />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Feedback message={message} error={error} />

      <Modal
        open={dataFileOpen}
        title="数据文件"
        description="资产快照数据存储在 SQLite 文件中，可设置密码加密。"
        onClose={() => setDataFileOpen(false)}
        footer={null}
      >
        <div className="space-y-4">
          <div className="rounded-md bg-subtle px-3 py-2 text-sm text-ink/65">
            当前数据文件：{dataFileInfo?.currentPath ?? "加载中..."}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={async () => {
                if (!("__TAURI_INTERNALS__" in window)) return;
                try {
                  const { open } = await import("@tauri-apps/plugin-dialog");
                  const selected = await open({ filters: dataFileFilters, multiple: false });
                  if (!selected) return;
                  const nextData = await switchDataFile({ path: selected as string });
                  setData(nextData);
                  setLocked(false);
                  const info = await getDataFileInfo();
                  setDataFileInfo(info);
                  const status = await getDatabaseStatus();
                  setDatabaseStatus(status);
                  setMessage("数据文件已切换");
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              <FolderOpen size={18} />
              打开数据文件
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!("__TAURI_INTERNALS__" in window)) return;
                try {
                  const { save } = await import("@tauri-apps/plugin-dialog");
                  const selected = await save({
                    filters: dataFileFilters,
                    defaultPath: "asset-snapshot.db",
                  });
                  if (!selected) return;
                  const info = await backupDataFile({ path: selected as string });
                  setDataFileInfo(info);
                  setMessage("备份已导出");
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              <Download size={18} />
              导出备份
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!("__TAURI_INTERNALS__" in window)) return;
                try {
                  const { save } = await import("@tauri-apps/plugin-dialog");
                  const selected = await save({
                    filters: dataFileFilters,
                    defaultPath: "asset-snapshot.db",
                  });
                  if (!selected) return;
                  const info = await backupDataFile({ path: selected as string });
                  const nextData = await switchDataFile({ path: (selected as string) });
                  setData(nextData);
                  setDataFileInfo(info);
                  setMessage("已创建并使用新数据文件");
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              <FilePlus2 size={18} />
              新建数据文件
            </Button>
          </div>
          <Feedback message={message} error={error} />
        </div>
      </Modal>

      <Modal
        open={configOpen}
        title="平台与账户"
        description="管理你的资产平台和账户。"
        onClose={() => {
          setConfigOpen(false);
          setPlatformEdits({});
          setAccountEdits({});
        }}
        footer={null}
      >
        <div className="space-y-6">
          <form className="flex flex-wrap items-end gap-3" onSubmit={submitPlatform}>
            <div className="min-w-[120px] flex-1">
              <Label>新建平台</Label>
              <Input
                value={platformName}
                placeholder="平台名称"
                onChange={(event) => setPlatformName(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              {presetColors.map((color, idx) => (
                <button
                  key={color}
                  type="button"
                  className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    platformColor === color ? "border-ink scale-110" : "border-transparent"
                  }`}
                  style={{ background: color }}
                  title={presetColorLabels[idx]}
                  onClick={() => setPlatformColor(color)}
                />
              ))}
              <input
                type="color"
                className="ml-1 size-7 cursor-pointer rounded-full border border-ink/15 bg-transparent p-0"
                value={platformColor || "#000000"}
                onChange={(event) => setPlatformColor(event.target.value)}
                title="自定义颜色"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={saving || !platformName.trim()}>
              <Plus size={16} />
              添加
            </Button>
          </form>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {platformGroups.map(({ platform, accounts }, pIdx) => (
              <div key={platform.id} className="rounded-lg bg-subtle p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-full shrink-0"
                    style={{ background: platformColorFor(platform.id, pIdx) }}
                  />
                  <span className="font-semibold text-ink">{platform.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      className="size-7 px-0"
                      title="上移"
                      onClick={() => movePlatformOrder(platform.id, "up")}
                      disabled={saving}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      className="size-7 px-0"
                      title="下移"
                      onClick={() => movePlatformOrder(platform.id, "down")}
                      disabled={saving}
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      className="size-7 px-0 text-coral"
                      title="删除平台"
                      onClick={() => removePlatform(platform.id)}
                      disabled={saving}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`size-4 rounded-full border transition-transform hover:scale-125 ${
                          (platform.color || platformColorDefaults[pIdx % platformColorDefaults.length]) === color
                            ? "border-ink/50 scale-125"
                            : "border-transparent"
                        }`}
                        style={{ background: color }}
                        title={presetColorLabels[presetColors.indexOf(color)]}
                        onClick={() => savePlatformColor(platform.id, color)}
                      />
                    ))}
                  </div>
                </div>
                <div className="mb-1">
                  <Input
                    value={platformEdits[platform.id] ?? platform.name}
                    placeholder="编辑平台名称"
                    onChange={(event) =>
                      setPlatformEdits((current) => ({ ...current, [platform.id]: event.target.value }))
                    }
                    onBlur={() => savePlatformName(platform.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") savePlatformName(platform.id);
                    }}
                  />
                </div>
                {accounts.length === 0 ? (
                  <p className="py-2 text-xs text-ink/35">暂无账户</p>
                ) : (
                  <div className="ml-4 space-y-1.5">
                    {accounts.map((account) => (
                      <div key={account.id} className="flex items-center gap-2 rounded-md p-1.5">
                        <div className="flex-1">
                          <Input
                            value={accountEdits[account.id] ?? account.name}
                            placeholder="账户名称"
                            onChange={(event) =>
                              setAccountEdits((current) => ({
                                ...current,
                                [account.id]: event.target.value,
                              }))
                            }
                            onBlur={() => saveAccountName(account.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") saveAccountName(account.id);
                            }}
                          />
                        </div>
                        <ChoiceSelect
                          value={account.type}
                          options={accountTypeOptions}
                          onChange={(value) => changeAccountType(account.id, value)}
                        />
                        <Button
                          variant="ghost"
                          className="size-8 px-0"
                          title={account.isActive ? "停用" : "启用"}
                          onClick={() => toggleAccountActive(account)}
                          disabled={saving}
                        >
                          {account.isActive ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          className="size-7 px-0"
                          title="上移"
                          onClick={() => moveAccountOrder(account.id, "up")}
                          disabled={saving}
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="size-7 px-0"
                          title="下移"
                          onClick={() => moveAccountOrder(account.id, "down")}
                          disabled={saving}
                        >
                          <ArrowDown size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="size-7 px-0 text-coral"
                          title="删除账户"
                          onClick={() => removeAccount(account)}
                          disabled={saving}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form className="flex flex-wrap items-end gap-3" onSubmit={submitAccount}>
            <div className="min-w-[100px]">
              <Label>平台</Label>
              <select
                className="w-full rounded-md border border-ink/10 bg-panel px-3 py-2 text-sm text-ink outline-none"
                value={accountForm.platformId}
                onChange={(event) =>
                  setAccountForm((current) => ({ ...current, platformId: event.target.value }))
                }
              >
                <option value="" disabled>
                  选择平台
                </option>
                {data.platforms.map((platform) => (
                  <option key={platform.id} value={String(platform.id)}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[100px] flex-1">
              <Label>账户名称</Label>
              <Input
                value={accountForm.name}
                placeholder="新账户"
                onChange={(event) =>
                  setAccountForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="min-w-[120px]">
              <Label>类型</Label>
              <ChoiceSelect
                value={accountForm.type}
                options={accountTypeOptions}
                onChange={(value) => setAccountForm((current) => ({ ...current, type: value }))}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={saving || !accountForm.platformId || !accountForm.name.trim()}
            >
              <Plus size={16} />
              添加
            </Button>
          </form>
          <Feedback message={message} error={error} />
        </div>
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
          <div className="grid gap-4 sm:grid-cols-[140px_90px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="snapshot-date">日期</Label>
              <DatePicker
                value={snapshotForm.date}
                onChange={(value) => setSnapshotForm((current) => ({ ...current, date: value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snapshot-time">时间</Label>
              <input
                id="snapshot-time"
                type="time"
                value={snapshotForm.time}
                className="w-full rounded-md border border-ink/10 bg-panel px-3 py-2 text-sm text-ink outline-none"
                onChange={(event) =>
                  setSnapshotForm((current) => ({ ...current, time: event.target.value }))
                }
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
        onClose={closeAnalysisModal}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeAnalysisModal}>
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
              <div className="grid gap-3 sm:grid-cols-2">
                {analysisGap > 0 ? (
                  <div className="rounded-md border border-ink/10 p-3">
                    <p className="text-sm text-ink/55">未解释收入</p>
                    <p className="mt-1 font-semibold text-moss">{signedAmount(analysisGap)}</p>
                  </div>
                ) : analysisGap < 0 ? (
                  <div className="rounded-md border border-ink/10 p-3">
                    <p className="text-sm text-ink/55">未解释支出</p>
                    <p className="mt-1 font-semibold text-coral">{signedAmount(analysisGap)}</p>
                  </div>
                ) : (
                  <div className="rounded-md border border-ink/10 p-3">
                    <p className="text-sm text-ink/55">未解释金额</p>
                    <p className="mt-1 font-semibold text-ink">0</p>
                  </div>
                )}
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
  onChange,
  onRemove,
}: {
  title: string;
  type: "income" | "expense";
  items: AnalysisItem[];
  saving: boolean;
  onChange: (index: number, item: AnalysisItem) => void;
  onRemove: (index: number) => void;
}) {
  const visibleItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === type);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-ink">{title}</h3>
      <div className="max-h-[38vh] space-y-3 overflow-y-auto pr-1">
        {visibleItems.map(({ item, index }) => {
          const total = sumAmounts(item.amounts);
          return (
            <AnalysisItemCard
              key={index}
              item={item}
              itemIndex={index}
              total={total}
              saving={saving}
              onChange={onChange}
              onRemove={onRemove}
            />
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

function AnalysisItemCard({
  item,
  itemIndex,
  total,
  saving,
  onChange,
  onRemove,
}: {
  item: AnalysisItem;
  itemIndex: number;
  total: number;
  saving: boolean;
  onChange: (index: number, item: AnalysisItem) => void;
  onRemove: (index: number) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRefs = useRef<(HTMLInputElement | null)[]>([]);

  const addAmount = () => {
    onChange(itemIndex, { ...item, amounts: [...item.amounts, ""] });
  };

  const handleAmountChange = (amountIndex: number, value: string) => {
    const amounts = item.amounts.map((current, currentIndex) =>
      currentIndex === amountIndex ? value : current,
    );
    onChange(itemIndex, { ...item, amounts });
  };

  const handleAmountBlur = (amountIndex: number) => {
    if (amountIndex === item.amounts.length - 1 && item.amounts[amountIndex].trim()) {
      onChange(itemIndex, { ...item, amounts: [...item.amounts, ""] });
    }
  };

  const handleAmountKeyDown = (amountIndex: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onChange(itemIndex, { ...item, amounts: [...item.amounts, ""] });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      amountRefs.current[0]?.focus();
    }
  };

  const removeAmount = (amountIndex: number) => {
    const amounts = item.amounts.filter((_, currentIndex) => currentIndex !== amountIndex);
    onChange(itemIndex, { ...item, amounts: amounts.length > 0 ? amounts : [""] });
  };

  return (
    <div className="rounded-lg border border-ink/10 p-3">
      <div className="flex items-center gap-2">
        <Input
          ref={nameRef}
          value={item.name}
          placeholder={item.type === "income" ? "收入名称" : "支出名称"}
          onChange={(event) => onChange(itemIndex, { ...item, name: event.target.value })}
          onKeyDown={handleNameKeyDown}
        />
        <Button
          type="button"
          variant="ghost"
          className="size-9 shrink-0 px-0 text-coral"
          title="删除项目"
          onClick={() => onRemove(itemIndex)}
          disabled={saving}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {item.amounts.map((amount, amountIndex) => (
          <div key={amountIndex} className="flex items-center gap-2">
            <Input
              ref={(el) => { amountRefs.current[amountIndex] = el; }}
              inputMode="decimal"
              value={amount}
              placeholder="金额"
              onChange={(event) => handleAmountChange(amountIndex, event.target.value)}
              onBlur={() => handleAmountBlur(amountIndex)}
              onKeyDown={(e) => handleAmountKeyDown(amountIndex, e)}
            />
            <Button
              type="button"
              variant="ghost"
              className="size-9 shrink-0 px-0"
              title="删除金额"
              onClick={() => removeAmount(amountIndex)}
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
            onClick={addAmount}
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

  return {
    points: visibleSummaries.map((summary) => trendPoint(summary)),
    visibleCount: visibleSummaries.length,
    rangeLabel: `${formatDate(bounds.start)} 至 ${formatDate(bounds.end)}`,
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

function trendPoint(summary: SnapshotSummary): TrendPoint {
  const date = parseDate(summary.date) ?? today();
  return {
    date: `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`,
    fullDate: summary.date,
    总资产: Number(summary.totalAsset),
    ...Object.fromEntries(
      summary.platformAssets.map((item) => [item.platformName, Number(item.amount)]),
    ),
  };
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

function buildAnalysisDescription(items: AnalysisItem[], assetChange: number, gap: number) {
  const parts = normalizeAnalysisItems(items)
    .map((item) => ({
      name: item.name,
      amount: sumAmounts(item.amounts),
    }))
    .filter((item) => item.amount !== 0)
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
    .map((item) => `${item.name}${formatPlainMoney(item.amount)}元`);

  if (gap > 0) {
    parts.push(`其余收入${formatPlainMoney(gap)}元`);
  } else if (gap < 0) {
    parts.push(`其余支出${formatPlainMoney(Math.abs(gap))}元`);
  }

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

