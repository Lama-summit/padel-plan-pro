// ─── Currency System ─────────────────────────────────────────
// Central currency configuration for the entire application.
// Future-safe: structured to support conversion rates later.

export type CurrencyCode = "EUR" | "USD" | "GBP" | "AUD";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string; // for future Intl formatting
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  EUR: { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
};

export const CURRENCY_OPTIONS: CurrencyCode[] = ["EUR", "USD", "GBP", "AUD"];

export function getCurrencySymbol(code: string): string {
  return CURRENCIES[code as CurrencyCode]?.symbol ?? "€";
}

/**
 * Format a monetary value with the correct currency symbol.
 * Uses K/M abbreviations for compact display.
 * No currency conversion — values are assumed to already be in the target currency.
 */
export function formatCurrency(val: number, currencyCode: string = "EUR"): string {
  const sym = getCurrencySymbol(currencyCode);
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

/**
 * Format for chart axis ticks (compact).
 */
export function formatCurrencyAxis(val: number, currencyCode: string = "EUR"): string {
  const sym = getCurrencySymbol(currencyCode);
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`;
}

/**
 * Format for tooltip values (with locale thousands separator).
 */
export function formatCurrencyFull(val: number, currencyCode: string = "EUR"): string {
  const sym = getCurrencySymbol(currencyCode);
  return `${sym}${val?.toLocaleString()}`;
}
