import { FormEvent, useMemo, useState } from "react";
import i18n from "../i18n";
import { createSnapshot, updateSnapshot } from "../lib/api";
import type { Account, DashboardData, Snapshot } from "../lib/types";

type SnapshotForm = {
  date: string;
  time: string;
  note: string;
  amounts: Record<number, string>;
};

/** How many of the latest snapshots are searched for a reference amount. */
const RECENT_SNAPSHOT_WINDOW = 3;

export type RecentAmount = {
  amount: string;
  date: string;
  time?: string;
};

export function useSnapshotForm({
  activeAccounts,
  accounts,
  snapshots,
  setData,
  showToast,
  setSaving,
  onSnapshotMutated,
}: {
  activeAccounts: Account[];
  accounts: Account[];
  snapshots: Snapshot[];
  setData: (data: DashboardData) => void;
  showToast: (text: string, kind: "success" | "error") => void;
  setSaving: (saving: boolean) => void;
  onSnapshotMutated?: () => void;
}) {
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(null);
  const [snapshotForm, setSnapshotForm] = useState<SnapshotForm>({
    date: new Date().toISOString().slice(0, 10),
    time: "00:00",
    note: "",
    amounts: Object.fromEntries(
      activeAccounts.map((account) => [account.id, "0"]),
    ),
  });

  const snapshotAccounts = useMemo(() => {
    if (!editingSnapshotId) return activeAccounts;
    const snapshot = snapshots.find((item) => item.id === editingSnapshotId);
    const accountIds = new Set([
      ...(snapshot?.items.map((item) => item.accountId) ?? []),
      ...activeAccounts.map((account) => account.id),
    ]);
    return accounts.filter((account) => accountIds.has(account.id));
  }, [activeAccounts, accounts, snapshots, editingSnapshotId]);

  // For every account that has a non-zero balance in one of the latest
  // snapshots, remember the newest of those balances so the modal can offer it
  // as a one-click fill-in. When an existing snapshot is edited, only the
  // periods before it count as sources.
  const recentAmounts = useMemo(() => {
    const editedIndex = editingSnapshotId
      ? snapshots.findIndex((snapshot) => snapshot.id === editingSnapshotId)
      : -1;
    const end = editedIndex === -1 ? snapshots.length : editedIndex;
    const recent = snapshots.slice(Math.max(0, end - RECENT_SNAPSHOT_WINDOW), end);
    const result: Record<number, RecentAmount> = {};
    for (const snapshot of recent) {
      for (const item of snapshot.items) {
        if (Number(item.amount) === 0) continue;
        result[item.accountId] = {
          amount: item.amount,
          date: snapshot.date,
          time: snapshot.snapshotTime,
        };
      }
    }
    return result;
  }, [snapshots, editingSnapshotId]);

  const openNewSnapshot = () => {
    setEditingSnapshotId(null);
    setSnapshotForm({
      date: new Date().toISOString().slice(0, 10),
      time: "00:00",
      note: "",
      amounts: Object.fromEntries(
        activeAccounts.map((account) => [account.id, "0"]),
      ),
    });
    setSnapshotOpen(true);
  };

  const openEditSnapshot = (snapshot: Snapshot) => {
    const amounts = Object.fromEntries([
      ...snapshot.items.map((item) => [item.accountId, item.amount] as const),
      ...activeAccounts
        .filter((account) => !snapshot.items.some((item) => item.accountId === account.id))
        .map((account) => [account.id, "0"] as const),
    ]);
    setEditingSnapshotId(snapshot.id);
    setSnapshotForm({
      date: snapshot.date,
      time: snapshot.snapshotTime ?? "00:00",
      note: snapshot.note ?? "",
      amounts,
    });
    setSnapshotOpen(true);
  };

  const closeModal = () => {
    setSnapshotOpen(false);
    setEditingSnapshotId(null);
  };

  const submitSnapshot = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const input = {
        date: snapshotForm.date,
        snapshotTime: snapshotForm.time,
        note: snapshotForm.note,
        items: snapshotAccounts.map((account) => ({
          accountId: account.id,
          amount: snapshotForm.amounts[account.id] || "0",
        })),
      };
      const nextData = editingSnapshotId
        ? await updateSnapshot({ snapshotId: editingSnapshotId, ...input })
        : await createSnapshot(input);
      setData(nextData);
      setSnapshotOpen(false);
      setEditingSnapshotId(null);
      showToast(editingSnapshotId ? i18n.t("snapshot.snapshotUpdated") : i18n.t("snapshot.snapshotSaved"), "success");
      onSnapshotMutated?.();
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  return {
    snapshotOpen,
    editingSnapshotId,
    snapshotForm,
    setSnapshotForm,
    snapshotAccounts,
    recentAmounts,
    openNewSnapshot,
    openEditSnapshot,
    closeModal,
    submitSnapshot,
  };
}
