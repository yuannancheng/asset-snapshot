import { FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "../Button";
import { DatePicker } from "../DatePicker";
import { Input, Label } from "../Field";
import { Modal } from "../Modal";
import { accountTypeLabel } from "../../lib/constants";
import type { Account, Platform } from "../../lib/types";

type SnapshotForm = {
  date: string;
  time: string;
  note: string;
  amounts: Record<number, string>;
};

export function SnapshotModal({
  open,
  editingSnapshotId,
  onClose,
  snapshotForm,
  setSnapshotForm,
  snapshotAccounts,
  submitSnapshot,
  saving,
  platforms,
  platformColorFor,
  openConfigModal,
}: {
  open: boolean;
  editingSnapshotId: number | null;
  onClose: () => void;
  snapshotForm: SnapshotForm;
  setSnapshotForm: (updater: (current: SnapshotForm) => SnapshotForm) => void;
  snapshotAccounts: Account[];
  submitSnapshot: (event: FormEvent) => Promise<void>;
  saving: boolean;
  platforms: Platform[];
  platformColorFor: (platformId: number, index: number) => string;
  openConfigModal: () => void;
}) {
  return (
    <Modal
      open={open}
      title={editingSnapshotId ? "编辑快照" : "新建快照"}
      description="一次快照只记录某个时间点的账户余额。"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="snapshot-form" disabled={saving || snapshotAccounts.length === 0}>
            {editingSnapshotId ? "更新快照" : "保存快照"}
          </Button>
        </>
      }
    >
      <form id="snapshot-form" className="space-y-5" onSubmit={submitSnapshot}>
        <div className="grid gap-4 sm:grid-cols-[140px_90px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="snapshot-date">日期</Label>
            <DatePicker
              value={snapshotForm.date}
              onChange={(value) => setSnapshotForm((current) => ({ ...current, date: value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snapshot-time">时间</Label>
            <input
              id="snapshot-time"
              type="time"
              value={snapshotForm.time}
              className="w-full rounded-md border border-ink/10 bg-panel px-3 py-2 text-sm text-ink outline-none"
              onChange={(event) =>
                setSnapshotForm((current) => ({ ...current, time: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snapshot-note">备注</Label>
            <Input
              id="snapshot-note"
              value={snapshotForm.note}
              placeholder="可选"
              onChange={(event) =>
                setSnapshotForm((current) => ({ ...current, note: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
          {snapshotAccounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ink/15 bg-subtle px-4 py-8 text-center">
              <p className="font-medium text-ink">需要先新建平台和账户</p>
              <p className="mt-2 text-sm leading-6 text-ink/55">
                快照必须至少包含一个启用账户。请先在平台与账户中添加平台，再添加账户。
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  onClose();
                  openConfigModal();
                }}
              >
                <Plus size={18} />
                去新建账户
              </Button>
            </div>
          ) : null}
          {snapshotAccounts.map((account) => {
            const platform = platforms.find((item) => item.id === account.platformId);
            const pIdx = platforms.findIndex((p) => p.id === account.platformId);
            return (
              <div
                key={account.id}
                className="grid gap-3 rounded-lg border border-ink/10 p-3 sm:grid-cols-[1fr_180px]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-full shrink-0"
                    style={{ background: platformColorFor(account.platformId, pIdx) }}
                  />
                  <div>
                    <p className="font-medium text-ink">{account.name}</p>
                    <p className="mt-1 text-sm text-ink/55">
                      {platform?.name} · {accountTypeLabel(account.type)}
                    </p>
                  </div>
                </div>
                <Input
                  inputMode="decimal"
                  value={snapshotForm.amounts[account.id] ?? "0"}
                  onChange={(event) =>
                    setSnapshotForm((current) => ({
                      ...current,
                      amounts: {
                        ...current.amounts,
                        [account.id]: event.target.value,
                      },
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </form>
    </Modal>
  );
}
