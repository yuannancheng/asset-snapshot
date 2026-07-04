import { FormEvent, useRef } from "react";
import { Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { DatePicker } from "../DatePicker";
import { Input, Label } from "../Field";
import { sanitizeAmount } from "../../lib/format";
import { Modal } from "../Modal";
import { accountTypeLabel, getAccountTypeOptions } from "../../lib/constants";
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
  const { t } = useTranslation();
  const timeRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const amountRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const lastAccountIdx = snapshotAccounts.length - 1;

  const focusNextAmount = (currentIdx: number) => {
    const nextAccount = snapshotAccounts[currentIdx + 1];
    if (!nextAccount) return;
    const el = amountRefs.current[nextAccount.id];
    if (!el) return;
    el.focus();
    const container = el.closest<HTMLElement>('.overflow-y-auto');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const bottomGap = containerRect.bottom - elRect.bottom;
    if (bottomGap < 64) {
      container.scrollBy({ top: 64 - bottomGap, behavior: 'smooth' });
    }
  };

  return (
    <Modal
      open={open}
      title={editingSnapshotId ? t("snapshot.editTitle") : t("snapshot.newTitle")}
      description={t("snapshot.description")}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="snapshot-form" disabled={saving || snapshotAccounts.length === 0}>
            {editingSnapshotId ? t("snapshot.updateSnapshot") : t("snapshot.saveSnapshot")}
          </Button>
        </>
      }
    >
      <form id="snapshot-form" className="relative space-y-5" onSubmit={submitSnapshot}>
        {saving ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-panel/75">
            <div className="flex items-center gap-3 text-sm text-ink/70">
              <Loader2 size={20} className="animate-spin text-mint" />
              {t("common.saving")}
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[140px_90px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="snapshot-date">{t("snapshot.date")}</Label>
            <DatePicker
              value={snapshotForm.date}
              onChange={(value) => setSnapshotForm((current) => ({ ...current, date: value }))}
              onEnter={() => timeRef.current?.focus()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snapshot-time">{t("snapshot.time")}</Label>
            <input
              id="snapshot-time"
              ref={timeRef}
              type="time"
              value={snapshotForm.time}
              className="w-full rounded-md border border-ink/10 bg-panel px-3 py-2 text-sm text-ink outline-none"
              onChange={(event) =>
                setSnapshotForm((current) => ({ ...current, time: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  noteRef.current?.focus();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snapshot-note">{t("snapshot.note")}</Label>
            <Input
              id="snapshot-note"
              ref={noteRef}
              value={snapshotForm.note}
              placeholder={t("snapshot.notePlaceholder")}
              onChange={(event) =>
                setSnapshotForm((current) => ({ ...current, note: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  const firstAccount = snapshotAccounts[0];
                  if (firstAccount) {
                    amountRefs.current[firstAccount.id]?.focus();
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
          {snapshotAccounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ink/15 bg-subtle px-4 py-8 text-center">
              <p className="font-medium text-ink">{t("snapshot.noAccountsTitle")}</p>
              <p className="mt-2 text-sm leading-6 text-ink/55">
                {t("snapshot.noAccountsDesc")}
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
                {t("snapshot.goCreateAccount")}
              </Button>
            </div>
          ) : null}
          {snapshotAccounts.map((account, idx) => {
            const platform = platforms.find((item) => item.id === account.platformId);
            const pIdx = platforms.findIndex((p) => p.id === account.platformId);
            const isLast = idx === lastAccountIdx;
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
                      {platform?.name} · {accountTypeLabel(account.type, t)}
                    </p>
                  </div>
                </div>
                <Input
                  selectOnFocus
                  inputMode="decimal"
                  min="0"
                  ref={(el) => { amountRefs.current[account.id] = el; }}
                  value={snapshotForm.amounts[account.id] ?? "0"}
                  onChange={(event) =>
                    setSnapshotForm((current) => ({
                      ...current,
                      amounts: {
                        ...current.amounts,
                        [account.id]: sanitizeAmount(event.target.value),
                      },
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isLast) {
                      event.preventDefault();
                      event.stopPropagation();
                      focusNextAmount(idx);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      </form>
    </Modal>
  );
}
