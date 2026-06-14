export type AccountType = "asset_liquid" | "asset_nonliquid" | "debt";

export type Platform = {
  id: number;
  name: string;
  sortOrder: number;
  color?: string;
};

export type Account = {
  id: number;
  platformId: number;
  name: string;
  type: AccountType;
  sortOrder: number;
  isActive: boolean;
};

export type SnapshotItem = {
  accountId: number;
  amount: string;
};

export type Snapshot = {
  id: number;
  date: string;
  snapshotTime?: string;
  note?: string;
  items: SnapshotItem[];
};

export type SnapshotSummary = {
  snapshotId: number;
  date: string;
  totalAsset: string;
  availableAsset: string;
  platformAssets: Array<{
    platformId: number;
    platformName: string;
    amount: string;
  }>;
};

export type AnalysisItemType = "income" | "expense";

export type AnalysisItem = {
  type: AnalysisItemType;
  name: string;
  amounts: string[];
};

export type SnapshotAnalysis = {
  snapshotId: number;
  items: AnalysisItem[];
};

export type DashboardData = {
  platforms: Platform[];
  accounts: Account[];
  snapshots: Snapshot[];
  summaries: SnapshotSummary[];
  analyses: SnapshotAnalysis[];
};

export type DataFileInfo = {
  currentPath: string;
};

export type DatabaseStatus = {
  currentPath: string;
  encrypted: boolean;
  locked: boolean;
  failedAttempts: number;
  waitSeconds: number;
};

export type SetPasswordInput = {
  password: string;
};

export type UnlockInput = {
  password: string;
};

export type ChangePasswordInput = {
  newPassword: string;
};


export type CreateAndSwitchDataFileInput = {
  path: string;
};
