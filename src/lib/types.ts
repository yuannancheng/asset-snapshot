export type AccountType = "asset_liquid" | "asset_nonliquid" | "debt";

export type Platform = {
  id: number;
  name: string;
  sortOrder: number;
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

export type DashboardData = {
  platforms: Platform[];
  accounts: Account[];
  snapshots: Snapshot[];
  summaries: SnapshotSummary[];
};
