import { Download, FilePlus2, FolderOpen, KeyRound, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { Modal } from "../Modal";
import {
  backupDataFile,
  createAndSwitchDataFile,
  getDataFileInfo,
  getDatabaseStatus,
  switchDataFile,
} from "../../lib/api";
import { getDataFileFilters } from "../../lib/constants";
import type { DashboardData, DataFileInfo, DatabaseStatus } from "../../lib/types";

export function DataFileModal({
  open,
  onClose,
  databaseStatus,
  setCreating,
  setData,
  setLocked,
  setDataFileInfo,
  setDatabaseStatus,
  showToast,
  handleRemovePassword,
  passwordLoading,
  setPasswordChangeOpen,
  setPasswordSetupOpen,
}: {
  open: boolean;
  onClose: () => void;
  databaseStatus: DatabaseStatus | null;
  setCreating: (v: boolean) => void;
  setData: (data: DashboardData) => void;
  setLocked: (v: boolean) => void;
  setDataFileInfo: (info: DataFileInfo) => void;
  setDatabaseStatus: (status: DatabaseStatus) => void;
  showToast: (text: string, kind: "success" | "error") => void;
  handleRemovePassword: () => void;
  passwordLoading: boolean;
  setPasswordChangeOpen: (v: boolean) => void;
  setPasswordSetupOpen: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const currentDir = (databaseStatus?.currentPath ?? "")
    .replace(/[/\\][^/\\]*$/, "");

  const dataFileFilters = getDataFileFilters(t);

  return (
    <Modal
      open={open}
      title={t("dataFile.title")}
      description={t("dataFile.description")}
      onClose={onClose}
      footer={null}
    >
      <div className="space-y-4">
        <div className="rounded-md bg-subtle px-3 py-2 text-sm text-ink/65 break-all">
          {t("dataFile.currentFilePrefix")}{databaseStatus?.currentPath ?? t("common.loading")}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={async () => {
              if (!("__TAURI_INTERNALS__" in window)) return;
              try {
                const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
                const selected = await openDialog({ filters: dataFileFilters, multiple: false, defaultPath: currentDir });
                if (!selected) return;
                setCreating(true);
                await new Promise(r => requestAnimationFrame(r));
                const nextData = await switchDataFile({ path: selected as string });
                setData(nextData);
                setLocked(false);
                const info = await getDataFileInfo();
                setDataFileInfo(info);
                const status = await getDatabaseStatus();
                setDatabaseStatus(status);
                showToast(t("dataFile.switched"), "success");
                onClose();
                setCreating(false);
              } catch (err) {
                const msg = String(err);
                if (msg.includes("authentication")) {
                  const status = await getDatabaseStatus();
                  setDatabaseStatus(status);
                  setLocked(true);
                } else {
                  showToast(msg, "error");
                }
                setCreating(false);
              }
            }}
          >
            <FolderOpen size={18} />
            {t("dataFile.openFile")}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!("__TAURI_INTERNALS__" in window)) return;
              try {
                const { save } = await import("@tauri-apps/plugin-dialog");
                const selected = await save({
                  filters: dataFileFilters,
                  defaultPath: currentDir ? `${currentDir}/asset-snapshot.asdb` : "asset-snapshot.asdb",
                });
                if (!selected) return;
                const info = await backupDataFile({ path: selected as string });
                setDataFileInfo(info);
                showToast(t("dataFile.backupExported"), "success");
              } catch (err) {
                showToast(String(err), "error");
              }
            }}
          >
            <Download size={18} />
            {t("dataFile.exportBackup")}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!("__TAURI_INTERNALS__" in window)) return;
              try {
                const { save, confirm: tauriConfirm } = await import("@tauri-apps/plugin-dialog");
                const selected = await save({
                  filters: dataFileFilters,
                  defaultPath: currentDir ? `${currentDir}/asset-snapshot.asdb` : "asset-snapshot.asdb",
                });
                if (!selected) return;
                const currentPath = databaseStatus?.currentPath ?? "";
                const overwriting = currentPath && selected === currentPath;
                if (overwriting && !await tauriConfirm(t("dataFile.confirmOverwrite"))) return;
                setCreating(true);
                await new Promise(r => requestAnimationFrame(r));
                const nextData = await createAndSwitchDataFile({ path: selected as string });
                setData(nextData);
                setDataFileInfo({ currentPath: selected as string });
                showToast(t("dataFile.createdAndSwitched"), "success");
                onClose();
                const newStatus = await getDatabaseStatus();
                setDatabaseStatus(newStatus);
                setCreating(false);
              } catch (err) {
                showToast(String(err), "error");
                setCreating(false);
              }
            }}
          >
            <FilePlus2 size={18} />
            {t("dataFile.newFile")}
          </Button>
        </div>
        <div className="border-t border-ink/10 pt-4">
          {databaseStatus?.encrypted ? (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setPasswordChangeOpen(true)}>
                <KeyRound size={18} />
                {t("dataFile.changePassword")}
              </Button>
              <Button variant="secondary" onClick={handleRemovePassword} disabled={passwordLoading}>
                <Lock size={18} />
                {t("dataFile.removePassword")}
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setPasswordSetupOpen(true)}>
              <Lock size={18} />
              {t("dataFile.setPassword")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
