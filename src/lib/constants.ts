import type { AccountType } from "./types";

export const platformColorDefaults = ["#2F80ED", "#27AE60", "#F2C94C", "#EB5757", "#9B51E0", "#56CCF2", "#F2994A", "#6FCF97"];
export const presetColors = ["#2F80ED", "#27AE60", "#F2C94C", "#EB5757", "#9B51E0", "#56CCF2", "#F2994A", "#6FCF97"];
export const dayMs = 24 * 60 * 60 * 1000;

export function getDataFileFilterName(t: (key: string) => string): string {
  return t("dataFile.filterName");
}

export function getDataFileFilters(t: (key: string) => string) {
  return [{ name: getDataFileFilterName(t), extensions: ["asdb", "db", "sqlite", "sqlite3"] }];
}

export function getAccountTypeOptions(t: (key: string) => string): Array<{ value: AccountType; label: string }> {
  return [
    { value: "asset_liquid", label: t("config.assetLiquid") },
    { value: "asset_nonliquid", label: t("config.assetNonliquid") },
    { value: "debt", label: t("config.debt") },
  ];
}

export function accountTypeLabel(type: AccountType, t: (key: string) => string): string {
  if (type === "asset_liquid") return t("config.assetLiquid");
  if (type === "asset_nonliquid") return t("config.assetNonliquid");
  return t("config.debt");
}

export function getPresetColorLabels(t: (key: string) => string): string[] {
  return [
    t("config.colorBlue"),
    t("config.colorGreen"),
    t("config.colorYellow"),
    t("config.colorRed"),
    t("config.colorPurple"),
    t("config.colorCyan"),
    t("config.colorOrange"),
    t("config.colorLightGreen"),
  ];
}
