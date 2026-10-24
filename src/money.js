import { CURRENCY } from "./config";

export const MAX_AMOUNT_MINOR = 100_000_000 * CURRENCY.minorPerMajor;

// "125.5" -> 12550. Returns null if invalid. No floating point involved.
export function parseAmount(input) {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const minor =
    Number(whole) * CURRENCY.minorPerMajor + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 && minor <= MAX_AMOUNT_MINOR
    ? minor
    : null;
}

// Quantities are stored as integer thousandths so "1.5 kg" is 1500 and no
// floating point is involved. Up to 3 decimals, must be > 0.
export const QTY_SCALE = 1000;
const MAX_QTY_MILLI = 100_000 * QTY_SCALE; // 100,000 units

// "1.5" -> 1500. Returns null if invalid.
export function parseQuantity(input) {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const milli = Number(whole) * QTY_SCALE + Number(frac.padEnd(3, "0"));
  return milli > 0 && milli <= MAX_QTY_MILLI ? milli : null;
}

// 1500 -> "1.5", 2000 -> "2"
export function formatQuantity(milli) {
  return String(Number((milli / QTY_SCALE).toFixed(3)));
}

// unit price (minor units) x quantity (thousandths) -> minor units,
// rounded half-up with integer maths. Returns null if it can't be
// represented safely.
export function lineTotal(unitMinor, qtyMilli) {
  const product = unitMinor * qtyMilli;
  if (!Number.isSafeInteger(product)) return null;
  return Math.floor((product + QTY_SCALE / 2) / QTY_SCALE);
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
  const options = {
    day: "numeric",
    month: "short",
  };
  if (Number(dateStr.slice(0, 4)) !== new Date().getFullYear())
    options.year = "numeric";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", options);
}

export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
