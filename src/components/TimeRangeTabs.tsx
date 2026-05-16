import { Tab } from "@headlessui/react";
import { cn } from "../lib/utils";

export type TimeRangeKey = "30d" | "3m" | "1y" | "custom";

const ranges: Array<{ value: TimeRangeKey; label: string }> = [
  { value: "30d", label: "最近30天" },
  { value: "3m", label: "最近3个月" },
  { value: "1y", label: "最近1年" },
  { value: "custom", label: "自定义" },
];

type TimeRangeTabsProps = {
  value: TimeRangeKey;
  onChange: (value: TimeRangeKey) => void;
};

export function TimeRangeTabs({ value, onChange }: TimeRangeTabsProps) {
  const selectedIndex = Math.max(
    ranges.findIndex((range) => range.value === value),
    0,
  );

  return (
    <Tab.Group selectedIndex={selectedIndex} onChange={(index) => onChange(ranges[index].value)}>
      <Tab.List className="inline-flex flex-wrap rounded-md border border-ink/10 bg-white p-1">
        {ranges.map((range) => (
          <Tab
            key={range.value}
            className={({ selected }) =>
              cn(
                "h-8 rounded px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-coral/40",
                selected ? "bg-ink text-white" : "text-ink/65 hover:bg-ink/5",
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
