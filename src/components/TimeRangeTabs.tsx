import { Tab } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";

export type TimeRangeKey = "1y" | "3y" | "5y" | "custom";

type TimeRangeTabsProps = {
  value: TimeRangeKey;
  onChange: (value: TimeRangeKey) => void;
};

export function TimeRangeTabs({ value, onChange }: TimeRangeTabsProps) {
  const { t } = useTranslation();

  const ranges: Array<{ value: TimeRangeKey; label: string }> = [
    { value: "1y", label: t("timeRange.last1y") },
    { value: "3y", label: t("timeRange.last3y") },
    { value: "5y", label: t("timeRange.last5y") },
    { value: "custom", label: t("timeRange.custom") },
  ];

  const selectedIndex = Math.max(
    ranges.findIndex((range) => range.value === value),
    0,
  );

  return (
    <Tab.Group selectedIndex={selectedIndex} onChange={(index) => onChange(ranges[index].value)}>
      <Tab.List className="inline-flex flex-wrap rounded-md border border-ink/10 bg-panel p-1">
        {ranges.map((range) => (
          <Tab
            key={range.value}
            className={({ selected }) =>
              cn(
                "h-8 rounded px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-coral/40",
                selected ? "bg-ink text-app" : "text-ink/65 hover:bg-ink/5",
              )
            }
          >
            {range.label}
          </Tab>
        ))}
      </Tab.List>
    </Tab.Group>
  );
}
