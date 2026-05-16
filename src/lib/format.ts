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
