import type {
  Account,
  AccountType,
  DashboardData,
  DataFileInfo,
  DatabaseStatus,
  Platform,
  Snapshot,
  SnapshotAnalysis,
  SnapshotSummary,
} from "./types";

const samplePlatforms: Platform[] = [
  { id: 1, name: "支付宝", sortOrder: 1 },
  { id: 2, name: "招商银行", sortOrder: 2 },
  { id: 3, name: "微信", sortOrder: 3 },
];

const sampleAccounts: Account[] = [
  { id: 1, platformId: 1, name: "余额", type: "asset_liquid", sortOrder: 1, isActive: true },
  { id: 2, platformId: 1, name: "理财", type: "asset_nonliquid", sortOrder: 2, isActive: true },
  { id: 3, platformId: 2, name: "储蓄卡", type: "asset_liquid", sortOrder: 1, isActive: true },
  { id: 4, platformId: 3, name: "零钱", type: "asset_liquid", sortOrder: 1, isActive: true },
  { id: 5, platformId: 1, name: "花呗", type: "debt", sortOrder: 3, isActive: true },
];

const sampleSummaries: SnapshotSummary[] = [
  {
    snapshotId: 1,
    date: "2026-01-31",
    totalAsset: "68900.00",
    availableAsset: "38200.00",
    platformAssets: [
      { platformId: 1, platformName: "支付宝", amount: "21400.00" },
      { platformId: 2, platformName: "招商银行", amount: "43100.00" },
      { platformId: 3, platformName: "微信", amount: "4400.00" },
    ],
  },
  {
    snapshotId: 2,
    date: "2026-02-28",
    totalAsset: "72450.00",
    availableAsset: "40150.00",
    platformAssets: [
      { platformId: 1, platformName: "支付宝", amount: "22600.00" },
      { platformId: 2, platformName: "招商银行", amount: "44750.00" },
      { platformId: 3, platformName: "微信", amount: "5100.00" },
    ],
  },
  {
    snapshotId: 3,
    date: "2026-03-31",
    totalAsset: "75880.00",
    availableAsset: "43880.00",
    platformAssets: [
      { platformId: 1, platformName: "支付宝", amount: "24100.00" },
      { platformId: 2, platformName: "招商银行", amount: "46230.00" },
      { platformId: 3, platformName: "微信", amount: "5550.00" },
    ],
  },
];

const sampleSnapshots: Snapshot[] = [
  {
    id: 1,
    date: "2026-01-31",
    note: "初始化示例",
    items: [
      { accountId: 1, amount: "7200.00" },
      { accountId: 2, amount: "16800.00" },
      { accountId: 5, amount: "2600.00" },
      { accountId: 3, amount: "43100.00" },
      { accountId: 4, amount: "4400.00" },
    ],
  },
  {
    id: 2,
    date: "2026-02-28",
    note: "初始化示例",
    items: [
      { accountId: 1, amount: "8200.00" },
      { accountId: 2, amount: "17600.00" },
      { accountId: 5, amount: "3200.00" },
      { accountId: 3, amount: "44750.00" },
      { accountId: 4, amount: "5100.00" },
    ],
  },
  {
    id: 3,
    date: "2026-03-31",
    note: "初始化示例",
    items: [
      { accountId: 1, amount: "9400.00" },
      { accountId: 2, amount: "18100.00" },
      { accountId: 5, amount: "3400.00" },
      { accountId: 3, amount: "46230.00" },
      { accountId: 4, amount: "5550.00" },
    ],
  },
];

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("请在 Tauri 桌面应用中编辑数据，浏览器预览仅展示界面。");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function getDashboardData() {
  try {
    return await invokeCommand<{
      platforms: Platform[];
      accounts: Account[];
      snapshots: Snapshot[];
      summaries: SnapshotSummary[];
    }>("get_dashboard_data");
  } catch {
    return {
      platforms: samplePlatforms,
      accounts: sampleAccounts,
      snapshots: sampleSnapshots,
      summaries: sampleSummaries,
    };
  }
}

export async function getDataFileInfo() {
  try {
    return await invokeCommand<DataFileInfo>("get_data_file_info");
  } catch {
    return { currentPath: "浏览器预览模式未连接本地数据库" };
  }
}

export async function getDatabaseStatus() {
  try {
    return await invokeCommand<DatabaseStatus>("get_database_status");
  } catch {
    return { currentPath: "", encrypted: false, locked: false, failedAttempts: 0, waitSeconds: 0 };
  }
}

export async function setDatabasePassword(input: { password: string }) {
  return invokeCommand<DatabaseStatus>("set_database_password", { input });
}

export async function unlockDatabase(input: { password: string }) {
  return invokeCommand<DashboardData>("unlock_database", { input });
}

export async function changeDatabasePassword(input: { newPassword: string }) {
  return invokeCommand<void>("change_database_password", { input });
}

export async function lockDatabase() {
  return invokeCommand<DatabaseStatus>("lock_database");
}

export async function switchDataFile(input: { path: string; password?: string }) {
  return invokeCommand<DashboardData>("switch_data_file", { input });
}

export async function backupDataFile(input: { path: string }) {
  return invokeCommand<DataFileInfo>("backup_data_file", { input });
}

export async function createPlatform(input: { name: string }) {
  return invokeCommand<DashboardData>("create_platform", { input });
}

export async function createAccount(input: {
  platformId: number;
  name: string;
  type: AccountType;
}) {
  return invokeCommand<DashboardData>("create_account", { input });
}

export async function createSnapshot(input: {
  date: string;
  note?: string;
  items: Array<{ accountId: number; amount: string }>;
}) {
  return invokeCommand<DashboardData>("create_snapshot", { input });
}

export async function updateSnapshot(input: {
  snapshotId: number;
  date: string;
  note?: string;
  items: Array<{ accountId: number; amount: string }>;
}) {
  return invokeCommand<DashboardData>("update_snapshot", { input });
}

export async function deleteSnapshot(input: { snapshotId: number }) {
  return invokeCommand<DashboardData>("delete_snapshot", { input });
}

export async function updateAccountActive(input: { accountId: number; isActive: boolean }) {
  return invokeCommand<DashboardData>("update_account_active", { input });
}

export async function updatePlatform(input: { platformId: number; name: string }) {
  return invokeCommand<DashboardData>("update_platform", { input });
}

export async function movePlatform(input: { platformId: number; direction: "up" | "down" }) {
  return invokeCommand<DashboardData>("move_platform", { input });
}

export async function updateAccount(input: { accountId: number; name: string }) {
  return invokeCommand<DashboardData>("update_account", { input });
}

export async function moveAccount(input: { accountId: number; direction: "up" | "down" }) {
  return invokeCommand<DashboardData>("move_account", { input });
}

export async function deleteAccount(input: { accountId: number }) {
  return invokeCommand<DashboardData>("delete_account", { input });
}

export async function deletePlatform(input: { platformId: number }) {
  return invokeCommand<DashboardData>("delete_platform", { input });
}

export async function getSnapshotAnalysis(input: { snapshotId: number }) {
  try {
    return await invokeCommand<SnapshotAnalysis>("get_snapshot_analysis", { input });
  } catch {
    return { snapshotId: input.snapshotId, items: [] };
  }
}

export async function saveSnapshotAnalysis(input: SnapshotAnalysis) {
  return invokeCommand<SnapshotAnalysis>("save_snapshot_analysis", { input });
}
