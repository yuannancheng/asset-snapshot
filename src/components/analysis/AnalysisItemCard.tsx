import { useRef } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "../Button";
import { Input } from "../Field";
import { money, sanitizeAmount } from "../../lib/format";
import type { AnalysisItem } from "../../lib/types";

export function AnalysisItemCard({
  item,
  itemIndex,
  total,
  saving,
  onChange,
  onRemove,
}: {
  item: AnalysisItem;
  itemIndex: number;
  total: number;
  saving: boolean;
  onChange: (index: number, item: AnalysisItem) => void;
  onRemove: (index: number) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleAmountChange = (amountIndex: number, value: string) => {
    const sanitized = sanitizeAmount(value);
    const amounts = item.amounts.map((current, currentIndex) =>
      currentIndex === amountIndex ? sanitized : current,
    );
    onChange(itemIndex, { ...item, amounts });
  };

  const handleAmountKeyDown = (amountIndex: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const isLast = amountIndex === item.amounts.length - 1;
      if (isLast && !item.amounts[amountIndex].trim()) {
        // Last empty input: just focus it (don't add new one)
        amountRefs.current[amountIndex]?.focus();
      } else {
        // Non-last or last is non-empty: add new empty and focus
        const nextAmounts = isLast
          ? [...item.amounts, ""]
          : item.amounts;
        onChange(itemIndex, { ...item, amounts: nextAmounts });
        setTimeout(() => {
          amountRefs.current[nextAmounts.length - 1]?.focus();
        }, 50);
      }
    }
  };

  const handleAmountBlur = (amountIndex: number) => {
    const isLast = amountIndex === item.amounts.length - 1;
    if (isLast && item.amounts[amountIndex].trim()) {
      // Last non-empty input lost focus: add new empty
      const nextAmounts = [...item.amounts, ""];
      onChange(itemIndex, { ...item, amounts: nextAmounts });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      amountRefs.current[0]?.focus();
    }
  };

  const removeAmount = (amountIndex: number) => {
    const amounts = item.amounts.filter((_, currentIndex) => currentIndex !== amountIndex);
    onChange(itemIndex, { ...item, amounts: amounts.length > 0 ? amounts : [""] });
  };

  return (
    <div className="rounded-lg border border-ink/10 p-3" data-ai={itemIndex}>
      <div className="flex items-center gap-2">
        <Input
          ref={nameRef}
          value={item.name}
          placeholder={item.type === "income" ? "收入名称" : "支出名称"}
          onChange={(event) => onChange(itemIndex, { ...item, name: event.target.value })}
          onKeyDown={handleNameKeyDown}
        />
        <Button
          type="button"
          variant="ghost"
          className="size-9 shrink-0 px-0 text-coral"
          title="删除项目"
          onClick={() => onRemove(itemIndex)}
          disabled={saving}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {item.amounts.map((amount, amountIndex) => {
          const isLast = amountIndex === item.amounts.length - 1;
          const isEmpty = !amount.trim();
          return (
            <div key={amountIndex} className="flex items-center gap-2">
              <Input
                ref={(el) => { amountRefs.current[amountIndex] = el; }}
                inputMode="decimal"
                value={amount}
                placeholder="金额"
                onChange={(event) => handleAmountChange(amountIndex, event.target.value)}
                onKeyDown={(e) => handleAmountKeyDown(amountIndex, e)}
                onBlur={() => handleAmountBlur(amountIndex)}
              />
              {(!isEmpty || !isLast) ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="size-9 shrink-0 px-0"
                  title="删除金额"
                  onClick={() => removeAmount(amountIndex)}
                  disabled={saving}
                >
                  <X size={16} />
                </Button>
              ) : (
                <div className="size-9 shrink-0" />
              )}
            </div>
          );
        })}
        <p className="text-sm font-medium text-ink/65 text-right">合计 {money(total)}</p>
      </div>
    </div>
  );
}
