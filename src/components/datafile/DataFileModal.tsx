import { Download, FilePlus2, FolderOpen, KeyRound, Lock } from "lucide-react";
import { Button } from "../Button";
import { Modal } from "../Modal";
import {
  backupDataFile,
  createAndSwitchDataFile,
  getDataFileInfo,
  getDatabaseStatus,
  switchDataFile,
} from "../../lib/api";
import { dataFileFilters } from "../../lib/constants";
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
  const currentDir = (databaseStatus?.currentPath ?? "")
    .replace(/[/\\][^/\\]*$/, "");

  return (
    <Modal
      open={open}
      title="数据文件"
      description="资产快照数据存储在 SQLite 文件中，可设置密码加密。"
      onClose={onClose}
      footer={null}
    >
      <div className="space-y-4">
        <div className="rounded-md bg-subtle px-3 py-2 text-sm text-ink/65 break-all">
          当前数据文件：{databaseStatus?.currentPath ?? "加载中..."}
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
                showToast("数据文件已切换", "success");
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
            打开数据文件
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
                showToast("备份已导出", "success");
              } catch (err) {
                showToast(String(err), "error");
              }
            }}
          >
            <Download size={18} />
            导出备份
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!("__TAURI_INTERNALS__" in window)) return;
              try {
                const { save, confirm } = await import("@tauri-apps/plugin-dialog");
                const selected = await save({
                  filters: dataFileFilters,
                  defaultPath: currentDir ? `${currentDir}/asset-snapshot.asdb` : "asset-snapshot.asdb",
                });
                if (!selected) return;
                const currentPath = databaseStatus?.currentPath ?? "";
                const overwriting = currentPath && selected === currentPath;
                if (overwriting && !await confirm("所选路径与当前数据文件相同，确定要用空白数据库覆盖吗？当前数据将丢失。")) return;
                setCreating(true);
                await new Promise(r => requestAnimationFrame(r));
                const nextData = await createAndSwitchDataFile({ path: selected as string });
                setData(nextData);
                setDataFileInfo({ currentPath: selected as string });
                showToast("已创建并使用新数据文件", "success");
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
            新建数据文件
          </Button>
        </div>
        <div className="border-t border-ink/10 pt-4">
          {databaseStatus?.encrypted ? (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setPasswordChangeOpen(true)}>
                <KeyRound size={18} />
                修改密码
              </Button>
              <Button variant="secondary" onClick={handleRemovePassword} disabled={passwordLoading}>
                <Lock size={18} />
                移除密码
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setPasswordSetupOpen(true)}>
              <Lock size={18} />
              设置密码
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
