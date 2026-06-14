import { useEffect, useState } from "react";
import {
  changeDatabasePassword,
  getDatabaseStatus,
  lockDatabase,
  removeDatabasePassword,
  setDatabasePassword,
  unlockDatabase,
} from "../lib/api";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { DashboardData, DatabaseStatus } from "../lib/types";

export function usePassword({
  setData,
  setLocked,
  setDatabaseStatus,
  showToast,
  setDataFileOpen,
  setPasswordSetupOpen,
  setPasswordChangeOpen,
}: {
  setData: (data: DashboardData) => void;
  setLocked: (locked: boolean) => void;
  setDatabaseStatus: (status: DatabaseStatus) => void;
  showToast: (text: string, kind: "success" | "error") => void;
  setDataFileOpen: (open: boolean) => void;
  setPasswordSetupOpen: (open: boolean) => void;
  setPasswordChangeOpen: (open: boolean) => void;
}) {
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockWaitSeconds, setUnlockWaitSeconds] = useState(0);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (unlockWaitSeconds <= 0) return;
    const timer = setTimeout(() => {
      setUnlockWaitSeconds((current) => current - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [unlockWaitSeconds]);

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
      setDataFileOpen(false);
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
    setPasswordLoading(true);
    await new Promise(r => requestAnimationFrame(r));
    try {
      const status = await setDatabasePassword({ password });
      setDatabaseStatus(status);
      setPasswordSetupOpen(false);
      showToast("数据库密码已设置。请务必记住您的密码。", "success");
    } catch (err) {
      showToast(String(err), "error");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleChangePassword = async (newPassword: string) => {
    setPasswordLoading(true);
    await new Promise(r => requestAnimationFrame(r));
    try {
      await changeDatabasePassword({ newPassword });
      setPasswordChangeOpen(false);
      showToast("数据库密码已修改。", "success");
    } catch (err) {
      showToast(String(err), "error");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRemovePassword = async () => {
    if (!await confirm("确定要移除数据库密码吗？数据将不再加密。")) return;
    setPasswordLoading(true);
    await new Promise(r => requestAnimationFrame(r));
    try {
      const status = await removeDatabasePassword();
      setDatabaseStatus(status);
      const freshStatus = await getDatabaseStatus();
      setDatabaseStatus(freshStatus);
      showToast("数据库密码已移除", "success");
    } catch (err) {
      showToast(String(err), "error");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLock = async () => {
    try {
      const status = await lockDatabase();
      setDatabaseStatus(status);
      setLocked(true);
      setUnlockError(null);
    } catch (err) {
      showToast(String(err), "error");
    }
  };

  return {
    setUnlockError,
    setUnlockWaitSeconds,
    unlockError,
    unlockWaitSeconds,
    passwordLoading,
    handleUnlock,
    handleSetPassword,
    handleChangePassword,
    handleRemovePassword,
    handleLock,
  };
}
