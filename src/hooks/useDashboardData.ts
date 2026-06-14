import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDashboardData,
  getDatabaseStatus,
  unlockDatabase,
  lockDatabase,
  createSnapshot,
  updateSnapshot,
  deleteSnapshot,
  createPlatform,
  updatePlatform,
  movePlatform,
  deletePlatform,
  createAccount,
  updateAccount,
  updateAccountType,
  updateAccountActive,
  moveAccount,
  deleteAccount,
  getSnapshotAnalysis,
  saveSnapshotAnalysis,
  setDatabasePassword,
  changeDatabasePassword,
  removeDatabasePassword,
  switchDataFile,
  createAndSwitchDataFile,
  backupDataFile,
  getDataFileInfo,
} from "../lib/api";
import type { DashboardData, SnapshotAnalysis } from "../lib/types";

const DASHBOARD_KEY = ["dashboardData"] as const;
const DB_STATUS_KEY = ["databaseStatus"] as const;

export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: DASHBOARD_KEY,
    queryFn: getDashboardData,
  });
}

export function useDatabaseStatus() {
  return useQuery({
    queryKey: DB_STATUS_KEY,
    queryFn: getDatabaseStatus,
    staleTime: 10 * 1000,
  });
}

export function useDataFileInfo() {
  return useQuery({
    queryKey: ["dataFileInfo"] as const,
    queryFn: getDataFileInfo,
    staleTime: 10 * 1000,
  });
}

export function useSnapshotAnalysis(snapshotId: number | null) {
  return useQuery({
    queryKey: ["snapshotAnalysis", snapshotId] as const,
    queryFn: () => getSnapshotAnalysis({ snapshotId: snapshotId! }),
    enabled: snapshotId !== null,
    staleTime: 0,
  });
}

function useDashboardMutation<TVariables>(
  mutationFn: (input: TVariables) => Promise<DashboardData>,
  onSuccessExtra?: (data: DashboardData) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      onSuccessExtra?.(data);
    },
  });
}

export function useCreateSnapshot() {
  return useDashboardMutation(createSnapshot);
}

export function useUpdateSnapshot() {
  return useDashboardMutation(updateSnapshot);
}

export function useDeleteSnapshot() {
  return useDashboardMutation(deleteSnapshot);
}

export function useCreatePlatform() {
  return useDashboardMutation(createPlatform);
}

export function useUpdatePlatform() {
  return useDashboardMutation(updatePlatform);
}

export function useMovePlatform() {
  return useDashboardMutation(movePlatform);
}

export function useDeletePlatform() {
  return useDashboardMutation(deletePlatform);
}

export function useCreateAccount() {
  return useDashboardMutation(createAccount);
}

export function useUpdateAccount() {
  return useDashboardMutation(updateAccount);
}

export function useUpdateAccountType() {
  return useDashboardMutation(updateAccountType);
}

export function useUpdateAccountActive() {
  return useDashboardMutation(updateAccountActive);
}

export function useMoveAccount() {
  return useDashboardMutation(moveAccount);
}

export function useDeleteAccount() {
  return useDashboardMutation(deleteAccount);
}

export function useSaveSnapshotAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSnapshotAnalysis,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: ["snapshotAnalysis", data.snapshotId] });
    },
  });
}

export function useUnlockDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlockDatabase,
    onSuccess: (data) => {
      queryClient.setQueryData(DASHBOARD_KEY, data);
      queryClient.invalidateQueries({ queryKey: DB_STATUS_KEY });
    },
  });
}

export function useLockDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: lockDatabase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DB_STATUS_KEY });
    },
  });
}

export function useSetDatabasePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setDatabasePassword,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DB_STATUS_KEY });
    },
  });
}

export function useChangeDatabasePassword() {
  return useMutation({
    mutationFn: changeDatabasePassword,
  });
}

export function useRemoveDatabasePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeDatabasePassword,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DB_STATUS_KEY });
    },
  });
}

export function useSwitchDataFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: switchDataFile,
    onSuccess: (data) => {
      queryClient.setQueryData(DASHBOARD_KEY, data);
      queryClient.invalidateQueries({ queryKey: DB_STATUS_KEY });
    },
  });
}

export function useCreateAndSwitchDataFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAndSwitchDataFile,
    onSuccess: (data) => {
      queryClient.setQueryData(DASHBOARD_KEY, data);
      queryClient.invalidateQueries({ queryKey: DB_STATUS_KEY });
    },
  });
}

export function useBackupDataFile() {
  return useMutation({
    mutationFn: backupDataFile,
  });
}

