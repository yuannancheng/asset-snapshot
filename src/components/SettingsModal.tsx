import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Modal } from "./Modal";
import { ChoiceSelect } from "./ChoiceSelect";
import { Label } from "./Field";
import { getCurrencySetting, setCurrencySetting } from "../lib/format";
import { cn } from "../lib/utils";

const LANGUAGE_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

const CURRENCY_PRESETS = [
  { value: "CNY", label: "CNY (\u00A5)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (\u20AC)" },
  { value: "GBP", label: "GBP (\u00A3)" },
  { value: "JPY", label: "JPY (\u00A5)" },
  { value: "HKD", label: "HKD (HK$)" },
  { value: "KRW", label: "KRW (\u20A9)" },
  { value: "TWD", label: "TWD (NT$)" },
];

const isPreset = (v: string) => CURRENCY_PRESETS.some((o) => o.value === v);

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [currency, setCurrency] = useState(() => {
    const stored = getCurrencySetting();
    return isPreset(stored) ? stored : stored;
  });
  const [customCurrency, setCustomCurrency] = useState(() => {
    const stored = getCurrencySetting();
    return isPreset(stored) ? "" : stored;
  });

  useEffect(() => {
    if (!open) return;
    const stored = getCurrencySetting();
    if (isPreset(stored)) {
      setCurrency(stored);
      setCustomCurrency("");
    } else {
      setCurrency(stored);
      setCustomCurrency(stored);
    }
  }, [open]);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const handleCurrencyChange = (value: string) => {
    if (value === "") return;
    setCurrency(value);
    setCustomCurrency("");
    setCurrencySetting(value);
  };

  const handleCustomCurrencyChange = (value: string) => {
    setCustomCurrency(value);
    if (value) {
      setCurrency(value);
      setCurrencySetting(value);
    } else {
      setCurrency("");
    }
  };

  const isCustomSelected = !isPreset(currency) && currency !== "";

  return (
    <Modal
      open={open}
      title={t("settings.title")}
      onClose={onClose}
      footer={null}
    >
      <div className="space-y-6 pb-2">
        {/* Language */}
        <div className="flex items-center justify-between gap-3">
          <Label>{t("settings.language")}</Label>
          <ChoiceSelect
            value={i18n.language === "zh" || i18n.language.startsWith("zh-") ? "zh" : "en"}
            options={LANGUAGE_OPTIONS}
            onChange={handleLanguageChange}
            align="end"
          />
        </div>

        {/* Currency */}
        <div className="flex items-center justify-between gap-3">
          <Label>{t("settings.currency")}</Label>
          <ChoiceSelect
            className="w-48"
            value={currency}
            options={CURRENCY_PRESETS}
            onChange={handleCurrencyChange}
            align="end"
            footer={
              <div
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-ink",
                  isCustomSelected && "font-medium text-moss bg-mint/30",
                )}
                onClick={() => inputRef.current?.focus()}
              >
                <input
                  ref={inputRef}
                  value={customCurrency}
                  placeholder={t("settings.currencyCustomPlaceholder")}
                  onChange={(e) => handleCustomCurrencyChange(e.target.value)}
                  className="min-w-0 flex-1 overflow-hidden text-ellipsis border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-ink/35"
                />
                {isCustomSelected ? <Check size={16} className="ml-auto shrink-0" /> : null}
              </div>
            }
          />
        </div>
      </div>
    </Modal>
  );
}
