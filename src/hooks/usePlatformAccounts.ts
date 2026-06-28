import { FormEvent, useState } from "react";
import {
  createAccount,
  createPlatform,
  deleteAccount,
  deletePlatform,
  getDashboardData,
  moveAccount,
  movePlatform,
  updateAccount,
  updateAccountActive,
  updateAccountPlatform,
  updateAccountType,
  updatePlatform,
} from "../lib/api";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { Account, AccountType, DashboardData, Platform } from "../lib/types";

export function usePlatformAccounts({
  platforms,
  accounts,
  setData,
  showToast,
  setSaving,
  setConfigOpen,
}: {
  platforms: Platform[];
  accounts: Account[];
  setData: (data: DashboardData) => void;
  showToast: (text: string, kind: "success" | "error") => void;
  setSaving: (saving: boolean) => void;
  setConfigOpen: (open: boolean) => void;
}) {
  const [platformName, setPlatformName] = useState("");
  const [platformColor, setPlatformColor] = useState("");
  const [platformEdits, setPlatformEdits] = useState<Record<number, string>>({});
  const [accountEdits, setAccountEdits] = useState<Record<number, string>>({});
  const [inlineAccountForms, setInlineAccountForms] = useState<Record<number, { name: string; type: AccountType }>>({});
  const [accountForm, setAccountForm] = useState<{
    platformId: string;
    name: string;
    type: AccountType;
  }>({ platformId: "", name: "", type: "asset_liquid" });

  const setDefaultPlatformId = (refreshedPlatforms: Platform[]) => {
    setAccountForm((current) => ({
      ...current,
      platformId: current.platformId || String(refreshedPlatforms[0]?.id ?? ""),
    }));
  };

  const openConfigModal = () => {
    setConfigOpen(true);
    setPlatformEdits({});
    setAccountEdits({});
  };

  const submitPlatform = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
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
      showToast("平台已添加", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const nextData = await createAccount({
        platformId: Number(accountForm.platformId),
        name: accountForm.name,
        type: accountForm.type,
      });
      setData(nextData);
      setAccountForm((current) => ({ ...current, name: "" }));
      showToast("账户已添加", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleAccountActive = async (account: Account) => {
    setSaving(true);
    try {
      const nextData = await updateAccountActive({
        accountId: account.id,
        isActive: !account.isActive,
      });
      setData(nextData);
      showToast(account.isActive ? "账户已停用" : "账户已启用", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (account: Account) => {
    if (!await confirm(`确定删除账户"${account.name}"吗？已有历史快照的账户不能删除。`)) return;
    setSaving(true);
    try {
      const nextData = await deleteAccount({ accountId: account.id });
      setData(nextData);
      showToast("账户已删除", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const removePlatform = async (platformId: number) => {
    const platform = platforms.find((item) => item.id === platformId);
    if (!platform) return;
    if (
      !await confirm(
        `确定删除平台"${platform.name}"吗？只有平台下所有账户都没有历史快照时才会删除。`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const nextData = await deletePlatform({ platformId });
      setData(nextData);
      setAccountForm((current) => ({
        ...current,
        platformId: String(nextData.platforms[0]?.id ?? ""),
      }));
      showToast("平台已删除", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const savePlatformName = async (platformId: number) => {
    const platform = platforms.find((p) => p.id === platformId);
    const currentName = platform?.name;
    const nextName = (platformEdits[platformId] ?? currentName ?? "").trim();
    if (!currentName || nextName === currentName) return;
    setSaving(true);
    try {
      const nextData = await updatePlatform({ platformId, name: nextName, color: platform?.color });
      setData(nextData);
      setPlatformEdits((current) => ({ ...current, [platformId]: nextName }));
      showToast("平台已更新", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const savePlatformColor = async (platformId: number, color: string) => {
    const platform = platforms.find((p) => p.id === platformId);
    if (!platform) return;
    setSaving(true);
    try {
      const nextData = await updatePlatform({ platformId, name: platform.name, color: color || undefined });
      setData(nextData);
      showToast("平台颜色已更新", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const movePlatformOrder = async (platformId: number, direction: "up" | "down") => {
    setSaving(true);
    try {
      const nextData = await movePlatform({ platformId, direction });
      setData(nextData);
      showToast("平台排序已更新", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const saveAccountName = async (accountId: number) => {
    const currentName = accounts.find((account) => account.id === accountId)?.name;
    const nextName = (accountEdits[accountId] ?? currentName ?? "").trim();
    if (!currentName || nextName === currentName) return;
    setSaving(true);
    try {
      const nextData = await updateAccount({ accountId, name: nextName });
      setData(nextData);
      setAccountEdits((current) => ({ ...current, [accountId]: nextName }));
      showToast("账户已更新", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const changeAccountType = async (accountId: number, type: AccountType) => {
    setSaving(true);
    try {
      const nextData = await updateAccountType({ accountId, type });
      setData(nextData);
      showToast("账户类型已更新", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };
  const changeAccountPlatform = async (accountId: number, platformId: number) => {
    setSaving(true);
    try {
      const nextData = await updateAccountPlatform({ accountId, platformId });
      setData(nextData);
      showToast("账户已迁移", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };


  const moveAccountOrder = async (accountId: number, direction: "up" | "down") => {
    setSaving(true);
    try {
      const nextData = await moveAccount({ accountId, direction });
      setData(nextData);
      showToast("账户排序已更新", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const inlineAddAccount = async (platformId: number) => {
    const form = inlineAccountForms[platformId];
    if (!form?.name.trim() || !form?.type) return;
    setSaving(true);
    try {
      const nextData = await createAccount({
        platformId,
        name: form.name.trim(),
        type: form.type,
      });
      setData(nextData);
      setInlineAccountForms((prev) => {
        const next = { ...prev };
        delete next[platformId];
        return next;
      });
      showToast("账户已添加", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  return {
    platformName,
    setPlatformName,
    platformColor,
    setPlatformColor,
    platformEdits,
    setPlatformEdits,
    accountEdits,
    setAccountEdits,
    accountForm,
    setAccountForm,
    inlineAccountForms,
    setInlineAccountForms,
    setDefaultPlatformId,
    openConfigModal,
    submitPlatform,
    submitAccount,
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
  };
}
