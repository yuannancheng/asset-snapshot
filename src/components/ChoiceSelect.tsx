import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";
import React, { useCallback, useRef } from "react";
import { cn } from "../lib/utils";

type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type ChoiceSelectProps<T extends string> = {
  value: T;
  options: Array<ChoiceOption<T>>;
  placeholder?: string;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function ChoiceSelect<T extends string>({
  value,
  options,
  placeholder = "请选择",
  onChange,
  disabled = false,
}: ChoiceSelectProps<T>) {
  const selected = options.find((option) => option.value === value);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = React.useState<'bottom' | 'top'>('bottom');

  const checkPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setAnchor(spaceBelow < 256 ? 'top' : 'bottom');
  }, []);

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      {({ open }) => {
        if (open) checkPosition();
        return (
      <div className="relative">
        <ListboxButton
          ref={buttonRef}
          className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-ink/10 bg-panel px-3 text-left text-sm text-ink outline-none transition hover:bg-mint/40 focus:border-moss focus:ring-2 focus:ring-moss/15 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className={selected ? "text-ink" : "text-ink/40"}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown size={16} className="shrink-0 text-ink/45" />
        </ListboxButton>
        <ListboxOptions
          anchor={anchor}
          className={cn(
            "z-[100] max-h-64 w-[var(--button-width)] min-w-[120px] overflow-auto rounded-lg border border-ink/10 bg-panel p-1 shadow-panel outline-none whitespace-nowrap",
          )}
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={({ focus, selected: isSelected, disabled }) =>
                cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-ink",
                  focus && "bg-mint",
                  isSelected && "font-medium text-moss",
                  disabled && "cursor-not-allowed opacity-40",
                )
              }
            >
              {({ selected: isSelected }) => (
                <>
                  <span>{option.label}</span>
                  {isSelected ? <Check size={16} /> : null}
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
        );
      }}
    </Listbox>
  );
}
