import { useEffect, useMemo, useRef, useState } from "react";
import { getSnapshotAnalysis, saveSnapshotAnalysis } from "../lib/api";
import {
  buildAnalysisDescription,
  emptyAnalysisItem,
  explainedAmount,
  normalizeAnalysisItems,
  previousSummaryFor,
} from "../lib/assetCalculator";
import { roundMoney } from "../lib/format";
import type { AnalysisItem, SnapshotSummary } from "../lib/types";

export function useAnalysis({
  summaries,
  showToast,
  setSaving,
  onSaved,
}: {
  summaries: SnapshotSummary[];
  showToast: (text: string, kind: "success" | "error") => void;
  setSaving: (saving: boolean) => void;
  onSaved?: () => void;
}) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisSnapshotId, setAnalysisSnapshotId] = useState<number | null>(null);
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>([]);
  const analysisLoadedRef = useRef(false);

  // Auto-save analysis on changes
  useEffect(() => {
    if (!analysisOpen || !analysisSnapshotId) return;
    if (!analysisLoadedRef.current) {
      analysisLoadedRef.current = true;
      return;
    }
    const timer = setTimeout(async () => {
      try {
        await saveSnapshotAnalysis({
          snapshotId: analysisSnapshotId,
          items: normalizeAnalysisItems(analysisItems),
        });
      } catch {
        // silent auto-save
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [analysisItems]);

  // Reset analysis loaded flag when opening new analysis
  useEffect(() => {
    if (analysisOpen) return;
    analysisLoadedRef.current = false;
  }, [analysisOpen]);

  const openAnalysisModal = async (summary: SnapshotSummary) => {
    setAnalysisSnapshotId(summary.snapshotId);
    setAnalysisItems([]);
    analysisLoadedRef.current = false;
    setAnalysisOpen(true);
    try {
      const analysis = await getSnapshotAnalysis({ snapshotId: summary.snapshotId });
      setAnalysisItems(analysis.items.length > 0 ? analysis.items : []);
    } catch (reason) {
      showToast(String(reason), "error");
    }
  };

  const saveAnalysis = async () => {
    if (!analysisSnapshotId) return;
    setSaving(true);
    try {
      const nextAnalysis = await saveSnapshotAnalysis({
        snapshotId: analysisSnapshotId,
        items: normalizeAnalysisItems(analysisItems),
      });
      setAnalysisItems(nextAnalysis.items);
      setAnalysisOpen(false);
      analysisLoadedRef.current = false;
      onSaved?.();
      showToast("变动分析已保存", "success");
    } catch (reason) {
      showToast(String(reason), "error");
    } finally {
      setSaving(false);
    }
  };

  const addAnalysisItem = (type: "income" | "expense") => {
    setAnalysisItems((current) => {
      const next = [...current, emptyAnalysisItem(type)];
      const newIndex = next.length - 1;
      setTimeout(() => {
        const el = document.querySelector(`[data-ai="${newIndex}"]`);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        const input = el?.querySelector("input");
        if (input) input.focus();
      }, 100);
      return next;
    });
  };

  const updateAnalysisItem = (index: number, nextItem: AnalysisItem) => {
    setAnalysisItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? nextItem : item)),
    );
  };

  const removeAnalysisItem = (index: number) => {
    setAnalysisItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const closeAnalysisModal = () => {
    setAnalysisOpen(false);
    setAnalysisSnapshotId(null);
    analysisLoadedRef.current = false;
  };

  const analysisSummary = useMemo(
    () => summaries.find((s) => s.snapshotId === analysisSnapshotId),
    [summaries, analysisSnapshotId],
  );
  const analysisPrevious = useMemo(
    () => previousSummaryFor(summaries, analysisSnapshotId ?? 0),
    [summaries, analysisSnapshotId],
  );
  const analysisChange = analysisSummary && analysisPrevious
    ? Number(analysisSummary.totalAsset) - Number(analysisPrevious.totalAsset)
    : 0;
  const analysisGap = roundMoney(analysisChange - explainedAmount(analysisItems));
  const analysisDescription = analysisPrevious
    ? buildAnalysisDescription(analysisItems, analysisChange, analysisGap)
    : "—";

  return {
    analysisOpen,
    analysisSnapshotId,
    analysisItems,
    analysisSummary,
    analysisPrevious,
    analysisChange,
    analysisGap,
    analysisDescription,
    openAnalysisModal,
    saveAnalysis,
    addAnalysisItem,
    updateAnalysisItem,
    removeAnalysisItem,
    closeAnalysisModal,
  };
}
