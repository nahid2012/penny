import { parseAmount, parseQuantity, lineTotal, isRealDate } from "./money";

// Pure receipt logic: no React, no database. The editor uses it for live
// totals and validation, db.js uses primaryCategoryId, tests cover it all.

let counter = 0;
export const newItem = (categoryId) => ({
  key: `i${++counter}`,
  name: "",
  categoryId,
  price: "",
  qty: "1",
});

// One draft row (all strings, as typed) -> parsed numbers + per-field errors.
export function evaluateItem(it) {
  const errors = {};
  if (!it.name.trim()) errors.name = "Name this item";

  if (!Number.isInteger(Number(it.categoryId)) || it.categoryId === "")
    errors.category = "Pick a category";

  const unitPriceMinor = parseAmount(it.price);
  if (unitPriceMinor === null)
    errors.price = it.price.trim() ? "Invalid price" : "Enter a price";

  const quantityMilli = parseQuantity(it.qty);
  if (quantityMilli === null)
    errors.qty = it.qty.trim() ? "Invalid quantity" : "Enter a quantity";

  let lineTotalMinor = null;
  if (unitPriceMinor !== null && quantityMilli !== null) {
    const t = lineTotal(unitPriceMinor, quantityMilli);
    if (t === null || t <= 0) errors.qty = "Total is too small";
    else lineTotalMinor = t;
  }

  return {
    errors,
    ok: Object.keys(errors).length === 0,
    unitPriceMinor,
    quantityMilli,
    lineTotalMinor,
  };
}

// Whole draft -> { rows, totalMinor, errors, ok, value }.
// `value` is what db.js expects, and is only set when everything is valid.
export function evaluateReceipt({ title, date, notes, items }) {
  const rows = items.map(evaluateItem);
  const errors = {};
  if (!title.trim()) errors.title = "Give the receipt a title";
  if (!isRealDate(date)) errors.date = "Pick a valid date";
  if (items.length === 0) errors.items = "Add at least one item";

  const totalMinor = rows.reduce((sum, r) => sum + (r.lineTotalMinor ?? 0), 0);
  const ok = Object.keys(errors).length === 0 && rows.every((r) => r.ok);

  return {
    rows,
    totalMinor,
    errors,
    ok,
    value: ok
      ? {
          title: title.trim(),
          date,
          notes: notes.trim() || null,
          items: items.map((it, i) => ({
            name: it.name.trim(),
            categoryId: Number(it.categoryId),
            unitPriceMinor: rows[i].unitPriceMinor,
            quantityMilli: rows[i].quantityMilli,
            lineTotalMinor: rows[i].lineTotalMinor,
          })),
        }
      : null,
  };
}

// Totals per category, biggest first. Works on saved items or built lines.
export function categoryTotals(items) {
  const m = new Map();
  for (const it of items)
    m.set(it.categoryId, (m.get(it.categoryId) ?? 0) + it.lineTotalMinor);
  return [...m]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total || a.categoryId - b.categoryId);
}

// The receipt row in `expenses` needs *a* category (the column is NOT NULL).
// We use the category that makes up most of the receipt. It's only a display
// fallback: all category statistics read the items, never this value.
export const primaryCategoryId = (items) => categoryTotals(items)[0].categoryId;
