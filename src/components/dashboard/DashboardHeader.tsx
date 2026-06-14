import { Database, Lock, Moon, Sun, WalletCards } from "lucide-react";
import { Button } from "../Button";
import type { DatabaseStatus } from "../../lib/types";

export function DashboardHeader({
  darkMode,
  setDarkMode,
  databaseStatus,
  creating,
  openConfigModal,
  setDataFileOpen,
  setPasswordSetupOpen,
  setPasswordChangeOpen,
  handleLock,
}: {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  databaseStatus: DatabaseStatus | null;
  creating: boolean;
  openConfigModal: () => void;
  setDataFileOpen: (v: boolean) => void;
  setPasswordSetupOpen: (v: boolean) => void;
  setPasswordChangeOpen: (v: boolean) => void;
  handleLock: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-semibold tracking-tight text-ink">资产快照</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          className="size-9 px-0"
          onClick={() => setDarkMode(!darkMode)}
          title="切换明暗"
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
          <Button variant="secondary" onClick={handleLock}>
            <Lock size={18} />
            锁定
          </Button>
        ) : null}
      </div>
    </div>
  );
}
