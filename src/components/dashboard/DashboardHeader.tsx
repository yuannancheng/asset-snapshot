import { Database, Info, Lock, Moon, Settings, Sun, WalletCards } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  openAboutModal,
  openSettingsModal,
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
  openAboutModal: () => void;
  openSettingsModal: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-semibold tracking-tight text-ink">{t("common.appName")}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={openConfigModal}>
          <WalletCards size={18} />
          {t("config.title")}
        </Button>
        <Button variant="secondary" onClick={() => setDataFileOpen(true)}>
          <Database size={18} />
          {t("dataFile.title")}
        </Button>
        {databaseStatus?.encrypted ? (
          <Button variant="secondary" onClick={handleLock}>
            <Lock size={18} />
            {t("common.lock")}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="size-9 px-0"
          onClick={() => setDarkMode(!darkMode)}
          title={t("common.darkModeToggle")}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
        <Button
          variant="ghost"
          className="size-9 px-0"
          onClick={openSettingsModal}
          title={t("common.settings")}
        >
          <Settings size={18} />
        </Button>
        <Button
          variant="ghost"
          className="size-9 px-0"
          onClick={openAboutModal}
          title={t("common.about")}
        >
          <Info size={18} />
        </Button>
      </div>
    </div>
  );
}
