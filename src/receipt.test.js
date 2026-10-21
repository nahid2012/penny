import { describe, it, expect } from "vitest";
import {
  evaluateItem,
  evaluateReceipt,
  categoryTotals,
  primaryCategoryId,
} from "./receipt";

const item = (over = {}) => ({
  key: "k",
  name: "Rice",
  categoryId: 1,
  price: "100",
  qty: "1",
  ...over,
});
const draft = (items, over = {}) => ({
  title: "Bazar",
  date: "2026-10-21",
  notes: "",
  items,
  ...over,
});

describe("evaluateItem", () => {
  it("multiplies price by quantity, including decimals", () => {
    expect(evaluateItem(item({ price: "45", qty: "3" })).lineTotalMinor).toBe(
      13500,
    );
    expect(
      evaluateItem(item({ price: "120", qty: "1.5" })).lineTotalMinor,
    ).toBe(18000);
    expect(
      evaluateItem(item({ price: "19.99", qty: "1.5" })).lineTotalMinor,
    ).toBe(2999);
  });
  it("reports field errors", () => {
    const r = evaluateItem(item({ name: " ", price: "", qty: "0" }));
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(["name", "price", "qty"]);
  });
  it("rejects a line that rounds to zero", () => {
    expect(evaluateItem(item({ price: "0.01", qty: "0.001" })).ok).toBe(false);
  });
});

describe("evaluateReceipt", () => {
  it("grand total is the exact sum of line totals", () => {
    const r = evaluateReceipt(
      draft([
        item({ price: "45", qty: "3" }),
        item({ price: "120.50", qty: "0.5", categoryId: 2 }),
      ]),
    );
    expect(r.ok).toBe(true);
    expect(r.totalMinor).toBe(13500 + 6025);
    expect(r.value.items.reduce((s, i) => s + i.lineTotalMinor, 0)).toBe(
      r.totalMinor,
    );
  });
  it("needs a title, a real date and at least one item", () => {
    const r = evaluateReceipt(draft([], { title: " ", date: "2026-02-30" }));
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(["date", "items", "title"]);
    expect(r.value).toBeNull();
  });
  it("blocks saving when any item is invalid", () => {
    expect(evaluateReceipt(draft([item(), item({ price: "x" })])).ok).toBe(
      false,
    );
  });
  it("trims text and turns empty notes into null", () => {
    const r = evaluateReceipt(
      draft([item({ name: "  Rice " })], { notes: "  " }),
    );
    expect(r.value.notes).toBeNull();
    expect(r.value.items[0].name).toBe("Rice");
  });
});

describe("categories", () => {
  const lines = [
    { categoryId: 1, lineTotalMinor: 500 },
    { categoryId: 2, lineTotalMinor: 900 },
    { categoryId: 1, lineTotalMinor: 600 },
  ];
  it("sums per category, biggest first", () => {
    expect(categoryTotals(lines)).toEqual([
      { categoryId: 1, total: 1100 },
      { categoryId: 2, total: 900 },
    ]);
  });
  it("picks the dominant category as the receipt's display category", () => {
    expect(primaryCategoryId(lines)).toBe(1);
  });
});
