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
  Database,
  FilePlus2,
  History,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { Button } from "./components/Button";
import { ChoiceSelect } from "./components/ChoiceSelect";
import { DatePicker } from "./components/DatePicker";
import { Input, Label } from "./components/Field";
import { Modal } from "./components/Modal";
import { Stat } from "./components/Stat";
import { TimeRangeTabs, type TimeRangeKey } from "./components/TimeRangeTabs";
import {
  createAccount,
  createPlatform,
  createSnapshot,
  deleteAccount,
  deletePlatform,
  deleteSnapshot,
  getDashboardData,
  updateAccountActive,
  updateSnapshot,
} from "./lib/api";
import { money, signedAmount } from "./lib/format";
import type { Account, AccountType, DashboardData, SnapshotSummary } from "./lib/types";

const platformColors = ["#48634f", "#f47d6b", "#d4a017", "#5b7f95", "#7a6f55"];
const dayMs = 24 * 60 * 60 * 1000;

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: "asset_liquid", label: "流动资产" },
  { value: "asset_nonliquid", label: "非流动资产" },
  { value: "debt", label: "负债" },
];

export default function App() {
  const [data, setData] = useState<DashboardData>({
    platforms: [],
    accounts: [],
    snapshots: [],
    summaries: [],
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(null);
  const [platformName, setPlatformName] = useState("");
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
  const [saving, setSaving] = useState(false);
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
    loadData().catch((reason) => setError(String(reason)));
  }, [loadData]);

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

  const openConfigModal = () => {
    setConfigOpen(true);
    setError(null);
    setMessage(null);
  };

  const closeModal = () => {
    setConfigOpen(false);
    setSnapshotOpen(false);
    setEditingSnapshotId(null);
    setError(null);
    setMessage(null);
  };

  const accountTypeLabel = (type: AccountType) => {
    if (type === "asset_liquid") return "流动资产";
    if (type === "asset_nonliquid") return "非流动资产";
    return "负债";
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

  const distribution: Array<{ name: string; value: number }> = latest?.platformAssets.map((item) => ({
    name: item.platformName,
    value: Math.max(Number(item.amount), 0),
  })) ?? [];

  const recentSummaries = [...data.summaries].reverse().slice(0, 8);

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-ink/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-moss">本地优先的个人资产工具</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">资产快照</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary">
              <Database size={18} />
              数据文件
            </Button>
            <Button onClick={openSnapshotModal}>
              <FilePlus2 size={18} />
              新建快照
            </Button>
          </div>
        </header>

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
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-panel">
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
              <div className="mb-4 grid gap-3 rounded-md bg-[#f7f8f5] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                <div className="space-y-2">
                  <Label htmlFor="trend-start">开始日期</Label>
                  <DatePicker
                    value={customRange.start}
                    onChange={(value) => setCustomRange((current) => ({ ...current, start: value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trend-end">结束日期</Label>
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
                    <CartesianGrid stroke="#e6e9e2" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 10000}万`} />
                    <Tooltip
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
                      formatter={(value) => money(Number(value))}
                    />
                    <Line
                      type="monotone"
                      dataKey="总资产"
                      stroke="#162018"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    {data.platforms.map((platform, index) => (
                      <Line
                        key={platform.id}
                        type="monotone"
                        dataKey={platform.name}
                        stroke={platformColors[index % platformColors.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md bg-[#f7f8f5] text-sm text-ink/50">
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
                    style={{ backgroundColor: platformColors[index % platformColors.length] }}
                  />
                  {platform.name}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold text-ink">资产分布</h2>
            <p className="mt-1 text-sm text-ink/55">{latest?.date ?? "暂无快照"}</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96}>
                    {distribution?.map((entry, index) => (
                      <Cell key={entry.name} fill={platformColors[index % platformColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => money(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-panel">
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
                <div
                  key={summary.snapshotId}
                  className="grid gap-3 py-3 sm:grid-cols-[120px_1fr_1fr_auto]"
                >
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

          <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-panel">
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
        open={configOpen}
        title="平台与账户"
        description="平台表示钱在哪里，账户是每次快照录入金额的单位。"
        onClose={closeModal}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <form className="space-y-4" onSubmit={submitPlatform}>
            <div>
              <h3 className="font-semibold text-ink">添加平台</h3>
              <p className="mt-1 text-sm text-ink/55">例如支付宝、招商银行、微信。</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-name">平台名称</Label>
              <Input
                id="platform-name"
                value={platformName}
                placeholder="平台名称"
                onChange={(event) => setPlatformName(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              <Plus size={18} />
              添加平台
            </Button>

            <div className="space-y-2 border-t border-ink/10 pt-4">
              <h4 className="text-sm font-semibold text-ink">删除无历史平台</h4>
              <div className="space-y-2">
                {data.platforms.map((platform) => (
                  <div key={platform.id} className="flex items-center justify-between gap-3 rounded-md bg-[#f7f8f5] px-3 py-2">
                    <span className="text-sm text-ink">{platform.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-8 px-0 text-coral"
                      title="删除平台"
                      onClick={() => removePlatform(platform.id)}
                      disabled={saving}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                {data.platforms.length === 0 ? (
                  <p className="text-sm text-ink/45">暂无平台</p>
                ) : null}
              </div>
            </div>
          </form>

          <form className="space-y-4" onSubmit={submitAccount}>
            <div>
              <h3 className="font-semibold text-ink">添加账户</h3>
              <p className="mt-1 text-sm text-ink/55">账户类型决定汇总计算规则。</p>
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="account-name">账户名称</Label>
              <Input
                id="account-name"
                value={accountForm.name}
                placeholder="余额 / 理财 / 信用卡"
                onChange={(event) =>
                  setAccountForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-type">账户类型</Label>
              <ChoiceSelect
                value={accountForm.type}
                options={accountTypeOptions}
                onChange={(value) => setAccountForm((current) => ({ ...current, type: value }))}
              />
            </div>
            <Button type="submit" disabled={saving || !accountForm.platformId}>
              <Plus size={18} />
              添加账户
            </Button>
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
    </main>
  );
}

function Feedback({ message, error }: { message: string | null; error: string | null }) {
  if (!message && !error) return null;
  return (
    <div className="mt-4 rounded-md border border-ink/10 bg-[#f7f8f5] px-3 py-2 text-sm">
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
  if (range === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (range === "3m") {
    start.setMonth(start.getMonth() - 3);
  } else {
    start.setFullYear(start.getFullYear() - 1);
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
