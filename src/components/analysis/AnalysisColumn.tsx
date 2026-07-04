import { AnalysisItemCard } from "./AnalysisItemCard";
import { sumAmounts } from "../../lib/format";
import type { AnalysisItem } from "../../lib/types";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "../Button";

export function AnalysisColumn({
  title,
  type,
  items,
  saving,
  onAdd,
  onChange,
  onRemove,
}: {
  title: string;
  type: "income" | "expense";
  items: AnalysisItem[];
  saving: boolean;
  onAdd: (type: "income" | "expense") => void;
  onChange: (index: number, item: AnalysisItem) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  const visibleItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === type);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-ink">{title}</h3>
      <div className="max-h-[38vh] space-y-3 overflow-y-auto pr-1">
        {visibleItems.map(({ item, index }) => {
          const total = sumAmounts(item.amounts);
          return (
            <AnalysisItemCard
              key={index}
              item={item}
              itemIndex={index}
              total={total}
              saving={saving}
              onChange={onChange}
              onRemove={onRemove}
            />
          );
        })}
        {visibleItems.length === 0 ? (
          <div className="rounded-md bg-subtle px-3 py-6 text-center text-sm text-ink/45">
            {type === "income" ? t("analysis.noIncome") : t("analysis.noExpense")}
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => onAdd(type)}
        disabled={saving}
      >
        <Plus size={16} />
        {type === "income" ? t("analysis.addIncome") : t("analysis.addExpense")}
      </Button>
    </div>
  );
}
