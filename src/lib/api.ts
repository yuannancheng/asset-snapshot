import type {
  AccountType,
  DashboardData,
  DataFileInfo,
  DatabaseStatus,
  SnapshotAnalysis,
  PaginatedSnapshots,
} from "./types";

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("请在 Tauri 桌面应用中编辑数据，浏览器预览仅展示界面。");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function getDashboardData() {
  try {
    return await invokeCommand<DashboardData>("get_dashboard_data");
  } catch {
    return {
      platforms: [],
      accounts: [],
      snapshots: [],
      summaries: [],
      analyses: [],
    };
  }

}
export async function getSnapshotsPage(input: { limit: number; offset: number }) {
  try {
    return await invokeCommand<PaginatedSnapshots>("get_snapshots_page", { input });
  } catch {
    return { snapshots: [], summaries: [], analyses: [], totalCount: 0 };
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

export async function removeDatabasePassword() {
  return invokeCommand<DatabaseStatus>("remove_database_password");
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

export async function createAndSwitchDataFile(input: { path: string }) {
  return invokeCommand<DashboardData>("create_and_switch_data_file", { input });
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
  snapshotTime?: string;
  note?: string;
  items: Array<{ accountId: number; amount: string }>;
}) {
  return invokeCommand<DashboardData>("create_snapshot", { input });
}

export async function updateSnapshot(input: {
  snapshotId: number;
  date: string;
  snapshotTime?: string;
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

export async function updatePlatform(input: { platformId: number; name: string; color?: string }) {
  return invokeCommand<DashboardData>("update_platform", { input });
}

export async function movePlatform(input: { platformId: number; direction: "up" | "down" }) {
  return invokeCommand<DashboardData>("move_platform", { input });
}

export async function updateAccount(input: { accountId: number; name: string }) {
  return invokeCommand<DashboardData>("update_account", { input });
}

export async function updateAccountType(input: { accountId: number; type: AccountType }) {
  return invokeCommand<DashboardData>("update_account_type", { input });
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
