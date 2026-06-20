import type { AccountType } from "./types";

export const platformColorDefaults = ["#2F80ED", "#27AE60", "#F2C94C", "#EB5757", "#9B51E0", "#56CCF2", "#F2994A", "#6FCF97"];
export const presetColors = ["#2F80ED", "#27AE60", "#F2C94C", "#EB5757", "#9B51E0", "#56CCF2", "#F2994A", "#6FCF97"];
export const presetColorLabels = ["蓝", "绿", "黄", "红", "紫", "青", "橙", "浅绿"];
export const dayMs = 24 * 60 * 60 * 1000;
export const dataFileFilters = [{ name: "资产快照数据文件", extensions: ["asdb", "db", "sqlite", "sqlite3"] }];

export const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: "asset_liquid", label: "流动资产" },
  { value: "asset_nonliquid", label: "非流动资产" },
  { value: "debt", label: "负债" },
];

export function accountTypeLabel(type: AccountType) {
  if (type === "asset_liquid") return "流动资产";
  if (type === "asset_nonliquid") return "非流动资产";
  return "负债";
}

