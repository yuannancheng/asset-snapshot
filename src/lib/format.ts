import i18n from "../i18n";

const CURRENCY_STORAGE_KEY = "asset-snapshot-currency";
const VALID_ISO_CODES = new Set([
  "CNY", "USD", "EUR", "GBP", "JPY", "HKD", "KRW", "TWD",
  "AUD", "CAD", "CHF", "SGD", "INR", "BRL", "RUB", "MXN",
  "SEK", "NOK", "DKK", "NZD", "THB", "MYR", "PHP", "IDR",
  "VND", "AED", "SAR", "TRY", "ZAR", "PLN", "CZK", "HUF",
]);

export function getCurrencySetting(): string {
  try {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored) return stored;
  } catch { /* ignore */ }
  return "CNY";
}

export function setCurrencySetting(code: string): void {
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch { /* ignore */ }
}

export function isIsoCurrency(code: string): boolean {
  return VALID_ISO_CODES.has(code);
}

function getLocale(): string {
  const lang = i18n.language;
  if (lang === "zh" || lang.startsWith("zh-")) return "zh-CN";
  return "en-US";
}

export function money(value: string | number) {
  const numberValue = typeof value === "string" ? Number(value) : value;
  const locale = getLocale();
  const currency = getCurrencySetting();
  if (isIsoCurrency(currency)) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numberValue || 0);
  }
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(Math.abs(numberValue || 0));
  const sign = numberValue < 0 ? "-" : "";
  return `${sign}${currency}${formatted}`;
}

export function signedAmount(value: string | number) {
  const numberValue = typeof value === "string" ? Number(value) : value;
  const prefix = numberValue > 0 ? "+" : "";
  return `${prefix}${money(numberValue)}`;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function sanitizeAmount(value: string) {
  return value.replace(/[^0-9.]/g, "");
}

export function sumAmounts(amounts: string[]) {
  return roundMoney(
    amounts.reduce((total, amount) => {
      const parsed = Number(amount);
      return Number.isFinite(parsed) ? total + parsed : total;
    }, 0),
  );
}

export function formatPlainMoney(value: number) {
  const rounded = roundMoney(value);
  const fractionDigits = Number.isInteger(rounded) ? 0 : 2;
  const parts = rounded.toFixed(fractionDigits).split(".");
  return parts[1] ? `${parts[0]}.${parts[1]}` : parts[0];
}
