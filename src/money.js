import { CURRENCY } from "./config";

// "125.5" -> 12550. Returns null if invalid. No floating point involved.
export function parseAmount(input) {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const minor =
    Number(whole) * CURRENCY.minorPerMajor + Number(frac.padEnd(2, "0"));
  return minor > 0 ? minor : null;
}

export function formatAmount(minor) {
  const major = (minor / CURRENCY.minorPerMajor).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY.symbol}${major}`;
}

// "2026-10" -> { from: "2026-10-01", to: "2026-11-01" } (to is exclusive)
export function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  const pad = (n) => String(n).padStart(2, "0");
  return {
    from: `${y}-${pad(m)}-01`,
    to: `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01`,
  };
}

export function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

export const todayLocal = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
