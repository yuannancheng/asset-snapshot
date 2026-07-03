export function money(value: string | number) {
  const numberValue = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(numberValue || 0);
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
