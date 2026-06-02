import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils";
import { ChoiceSelect } from "./ChoiceSelect";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

export function DatePicker({ value, onChange }: DatePickerProps) {
  const selectedDate = parseDate(value) ?? new Date();
  const [inputValue, setInputValue] = useState(value);
  const [touched, setTouched] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const yearChoices = useMemo(
    () =>
      yearOptions(visibleMonth.getFullYear()).map((year) => ({
        value: String(year),
        label: `${year} 年`,
      })),
    [visibleMonth],
  );
  const monthChoices = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: String(index),
        label: `${index + 1} 月`,
      })),
    [],
  );
  const hasError = touched && !parseDate(inputValue);

  useEffect(() => {
    setInputValue(value);
    const nextSelectedDate = parseDate(value);
    if (nextSelectedDate) {
      setVisibleMonth(new Date(nextSelectedDate.getFullYear(), nextSelectedDate.getMonth(), 1));
    }
  }, [value]);

  const shiftMonth = (amount: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const commitDate = (nextValue: string) => {
    const nextDate = parseDate(nextValue);
    if (!nextDate) return;
    setTouched(false);
    setInputValue(nextValue);
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    onChange(nextValue);
  };

  return (
    <Popover className="relative">
      <div
        className={cn(
          "flex h-10 w-full items-center rounded-md border bg-panel text-sm text-ink transition focus-within:ring-2",
          hasError
            ? "border-coral focus-within:ring-coral/20"
            : "border-ink/10 focus-within:border-moss focus-within:ring-moss/15",
        )}
      >
        <input
          className="h-full min-w-0 flex-1 rounded-l-md bg-transparent px-3 outline-none placeholder:text-ink/35"
          value={inputValue}
          placeholder="YYYY-MM-DD"
          inputMode="numeric"
          onChange={(event) => {
            const nextValue = event.target.value;
            setInputValue(nextValue);
            if (parseDate(nextValue)) {
              commitDate(nextValue);
            }
          }}
          onBlur={() => setTouched(true)}
        />
        <PopoverButton
          type="button"
          className="flex h-full w-10 items-center justify-center rounded-r-md text-ink/45 transition hover:bg-mint/40 focus:outline-none"
        >
          <CalendarDays size={16} />
        </PopoverButton>
      </div>
      {hasError ? <p className="mt-1 text-xs text-coral">日期格式应为 YYYY-MM-DD</p> : null}
      <PopoverPanel className="absolute z-[70] mt-2 w-72 rounded-lg border border-ink/10 bg-panel p-3 shadow-panel">
        {({ close }) => (
          <>
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-md text-ink/65 transition hover:bg-mint"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <p className="text-sm font-semibold text-ink">
                {visibleMonth.getFullYear()} 年 {visibleMonth.getMonth() + 1} 月
              </p>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-md text-ink/65 transition hover:bg-mint"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <ChoiceSelect
                value={String(visibleMonth.getFullYear())}
                options={yearChoices}
                onChange={(nextYear) =>
                  setVisibleMonth((current) => new Date(Number(nextYear), current.getMonth(), 1))
                }
              />
              <ChoiceSelect
                value={String(visibleMonth.getMonth())}
                options={monthChoices}
                onChange={(nextMonth) =>
                  setVisibleMonth((current) => new Date(current.getFullYear(), Number(nextMonth), 1))
                }
              />
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-ink/45">
              {weekDays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {days.map((date) => {
                const dateValue = formatDate(date);
                const isSelected = dateValue === value;
                const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();

                return (
                  <button
                    key={dateValue}
                    type="button"
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-md text-sm transition",
                      isCurrentMonth ? "text-ink" : "text-ink/30",
                      isSelected ? "bg-ink font-semibold text-app" : "hover:bg-mint",
                    )}
                    onClick={() => {
                      commitDate(dateValue);
                      close();
                    }}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  );
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function yearOptions(centerYear: number) {
  return Array.from({ length: 21 }, (_, index) => centerYear - 10 + index);
}
