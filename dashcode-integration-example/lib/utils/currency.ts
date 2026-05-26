const INR_LOCALE = "en-IN";

export type FormatINROptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: "₹" | "Rs";
};

function getFractionDigits(value: number | string) {
  if (typeof value === "number") {
    if (Number.isInteger(value)) return 0;
    const [, decimals = ""] = value.toString().split(".");
    return Math.min(decimals.length, 2);
  }

  const [, decimals = ""] = value.split(".");
  return Math.min(decimals.replace(/\D/g, "").length, 2);
}

export function parseCurrencyAmount(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/INR/gi, "")
    .replace(/Rs\.?/gi, "")
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .trim();

  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatINR(
  value: number | string,
  options: FormatINROptions = {}
) {
  const amount = parseCurrencyAmount(value);
  const prefix = options.fallback === "Rs" ? "Rs " : "₹";

  if (amount === null) {
    return `${prefix}0`;
  }

  const maximumFractionDigits = options.maximumFractionDigits ?? 2;
  const minimumFractionDigits =
    options.minimumFractionDigits ??
    Math.min(getFractionDigits(value), maximumFractionDigits);

  const formatted = new Intl.NumberFormat(INR_LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);

  return `${prefix}${formatted}`;
}

export function formatCompactINR(value: number) {
  const amount = parseCurrencyAmount(value);

  if (amount === null) return "₹0";

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (absAmount >= 10000000) {
    return `${sign}₹${(absAmount / 10000000).toFixed(
      absAmount >= 100000000 ? 0 : 1
    )}Cr`;
  }

  if (absAmount >= 100000) {
    return `${sign}₹${(absAmount / 100000).toFixed(
      absAmount >= 1000000 ? 0 : 1
    )}L`;
  }

  if (absAmount >= 1000) {
    return `${sign}₹${(absAmount / 1000).toFixed(absAmount >= 10000 ? 0 : 1)}K`;
  }

  return formatINR(amount);
}
